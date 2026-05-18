"""
사용자 pitch와 레퍼런스 pitch를 비교하는 API.

처리 파이프라인:
  1. 무성음 제거: voiced frame만 추출 (midi_note = None인 프레임 제외)
  2. 자동 오프셋 탐색: Subsequence DTW로 레퍼런스에서 사용자와 잘 맞는 구간 검색
                       → 사용자가 곡 중간부터 불러도 자동 매칭
  3. 프레임 정렬: 일반 DTW로 사용자-레퍼런스 프레임을 1:1 대응
  4. 오차 계산: 각 프레임의 cent 오차(음정)·타이밍 오차(박자) 계산
  5. 소절 분석: 레퍼런스 소절 경계를 감지하고 소절별 정확도 집계
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.aligner import align_midi_sequences, calculate_cent_error, find_best_offset, midi_to_hz
from core.phrase_detector import compute_phrase_results, detect_phrases

router = APIRouter()

# ±100 cent(반음 1개) 이내면 '정답' 판정
# 100 cent = 반음 1개, 200 cent = 온음 1개
CENT_TOLERANCE = 100.0


# ── 요청 / 응답 모델 ──────────────────────────────────────────────────────────

class ComparePitchFrame(BaseModel):
    time: float = Field(ge=0)
    midi_note: float | None = Field(default=None, ge=0, le=127)
    frequency: float | None = Field(default=None, gt=0)


class CompareRequest(BaseModel):
    user_pitch: list[ComparePitchFrame] = Field(min_length=1)
    reference_pitch: list[ComparePitchFrame] = Field(min_length=1)


class AlignmentFrame(BaseModel):
    user_time: float
    reference_time: float
    timing_error_sec: float
    user_midi: float
    reference_midi: float
    user_frequency: float
    reference_frequency: float
    cent_error: float
    is_correct: bool


class JudgementSummary(BaseModel):
    correct_frames: int
    total_compared_frames: int
    accuracy_percent: float
    avg_cent_error: float | None
    max_positive_cent_error: float | None
    max_negative_cent_error: float | None
    avg_abs_timing_error_sec: float | None
    max_abs_timing_error_sec: float | None


class PhraseResult(BaseModel):
    index: int
    ref_start_time: float
    ref_end_time: float
    user_start_time: float
    user_end_time: float
    accuracy_percent: float
    avg_cent_error: float | None
    direction: str   # 'sharp' | 'flat' | 'mixed'
    frame_count: int
    is_good: bool


class CompareResponse(BaseModel):
    user_pitch: list[ComparePitchFrame]
    reference_pitch: list[ComparePitchFrame]
    alignment: list[AlignmentFrame]
    judgement: JudgementSummary
    phrase_results: list[PhraseResult] = []
    detected_offset_sec: float | None = None


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _only_voiced(frames: list[ComparePitchFrame]) -> list[ComparePitchFrame]:
    """midi_note가 None인 무성 프레임을 제거한다.

    무성음(숨 쉬는 구간, 침묵)은 pitch 비교 대상이 아니므로 제외한다.
    """
    return [f for f in frames if f.midi_note is not None]


def _resolve_frequency(frame: ComparePitchFrame) -> float:
    """frame에서 주파수(Hz)를 반환한다.

    frequency 필드가 있으면 그대로 사용하고,
    없으면 midi_note를 Hz로 변환해 대체한다.
    """
    if frame.frequency is not None:
        return frame.frequency
    return midi_to_hz(frame.midi_note)  # type: ignore[arg-type]


def _build_judgement(
    alignment: list[AlignmentFrame],
    cent_errors: list[float],
    timing_errors: list[float],
) -> JudgementSummary:
    """alignment 전체의 통계 요약을 생성한다.

    - accuracy_percent: 정답 프레임 / 전체 비교 프레임 × 100
    - avg_cent_error: 양수면 전반적으로 높게 부름, 음수면 낮게 부름
    - timing errors: 박자 오차 (음정과 독립적으로 계산)
    """
    correct = sum(1 for f in alignment if f.is_correct)
    total = len(alignment)
    return JudgementSummary(
        correct_frames=correct,
        total_compared_frames=total,
        accuracy_percent=round(correct / total * 100, 2),
        avg_cent_error=round(sum(cent_errors) / len(cent_errors), 2) if cent_errors else None,
        max_positive_cent_error=round(max(cent_errors), 2) if cent_errors else None,
        max_negative_cent_error=round(min(cent_errors), 2) if cent_errors else None,
        avg_abs_timing_error_sec=round(
            sum(abs(v) for v in timing_errors) / len(timing_errors), 3
        ) if timing_errors else None,
        max_abs_timing_error_sec=round(
            max(abs(v) for v in timing_errors), 3
        ) if timing_errors else None,
    )


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.post("/compare", response_model=CompareResponse)
async def compare_pitch(request: CompareRequest):
    """
    사용자 pitch와 레퍼런스 pitch를 비교해 결과를 반환한다.

    처리 순서:
      1. 무성음 제거
      2. Subsequence DTW로 레퍼런스 내 최적 매칭 구간 탐색
      3. 일반 DTW로 프레임 단위 정렬
      4. 각 프레임의 cent 오차·타이밍 오차 계산
      5. 소절 경계 감지 + 소절별 통계 집계
    """
    # ── 1. 무성음 제거 ────────────────────────────────────────────────────────
    user_frames = _only_voiced(request.user_pitch)
    ref_frames  = _only_voiced(request.reference_pitch)

    if not user_frames:
        raise HTTPException(status_code=422, detail="유성 user_pitch 프레임이 없습니다.")
    if not ref_frames:
        raise HTTPException(status_code=422, detail="유성 reference_pitch 프레임이 없습니다.")

    # MIDI 번호만 추출해 알고리즘에 전달 (시간 정보는 별도로 유지)
    user_notes = [f.midi_note for f in user_frames]
    ref_notes  = [f.midi_note for f in ref_frames]

    # ── 2. Subsequence DTW — 레퍼런스 내 최적 구간 탐색 ──────────────────────
    # 사용자가 곡 중간부터 불렀을 때 자동으로 해당 구간을 찾아준다.
    # 예: 전주 없이 1절부터 불렀다면 레퍼런스 앞부분이 슬라이스됨
    start_idx, end_idx = find_best_offset(user_notes, ref_notes)
    sliced_ref = ref_frames[start_idx:end_idx] if end_idx > start_idx else ref_frames

    # 탐지된 레퍼런스 시작 시각 (프론트에서 "X초 지점부터 매칭" 표시에 사용)
    detected_offset_sec = round(sliced_ref[0].time, 2) if sliced_ref else None
    # 타이밍 오차 계산 시 레퍼런스 기준 시간을 0으로 정규화하기 위한 오프셋
    time_offset         = sliced_ref[0].time if sliced_ref else 0.0
    sliced_notes        = [f.midi_note for f in sliced_ref]

    # ── 3. 일반 DTW — 프레임 단위 정렬 ──────────────────────────────────────
    # 길이가 다른 두 시퀀스를 1:1 프레임으로 매핑하는 경로를 구함
    path = align_midi_sequences(user_notes, sliced_notes)
    if not path:
        raise HTTPException(status_code=422, detail="DTW alignment을 생성할 수 없습니다.")

    # ── 4. 프레임별 오차 계산 ─────────────────────────────────────────────────
    alignment: list[AlignmentFrame] = []
    cent_errors: list[float] = []
    timing_errors: list[float] = []

    try:
        for user_idx, ref_idx in path:
            u = user_frames[user_idx]
            r = sliced_ref[ref_idx]

            u_freq  = _resolve_frequency(u)
            r_freq  = _resolve_frequency(r)

            # cent 오차: 양수 = 높게 부름(sharp), 음수 = 낮게 부름(flat)
            cent_err   = round(calculate_cent_error(u_freq, r_freq), 2)
            # 타이밍 오차: 양수 = 늦게 부름, 음수 = 일찍 부름
            # r.time - time_offset 으로 레퍼런스를 0 기준으로 정규화
            timing_err = round(u.time - (r.time - time_offset), 3)
            is_correct = abs(cent_err) <= CENT_TOLERANCE

            alignment.append(AlignmentFrame(
                user_time=round(u.time, 3),
                reference_time=round(r.time, 3),  # 절대 시간 유지 (phrase 비교에 사용)
                timing_error_sec=timing_err,
                user_midi=round(u.midi_note, 1),       # type: ignore[arg-type]
                reference_midi=round(r.midi_note, 1),  # type: ignore[arg-type]
                user_frequency=round(u_freq, 2),
                reference_frequency=round(r_freq, 2),
                cent_error=cent_err,
                is_correct=is_correct,
            ))
            cent_errors.append(cent_err)
            timing_errors.append(timing_err)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not alignment:
        raise HTTPException(status_code=422, detail="비교 가능한 프레임이 없습니다.")

    # ── 5. 소절 단위 집계 ─────────────────────────────────────────────────────
    # sliced_ref의 pitch frame으로 소절 경계를 감지한 뒤,
    # alignment 결과를 소절별로 묶어 정확도·방향성을 계산한다.
    ref_dicts   = [{"time": f.time, "midi_note": f.midi_note} for f in sliced_ref]
    phrases     = detect_phrases(ref_dicts)
    phrase_results = [
        PhraseResult(**r) for r in compute_phrase_results(alignment, phrases)
    ]

    return CompareResponse(
        user_pitch=request.user_pitch,
        # 응답에는 매칭된 레퍼런스 구간만 포함 (전체 레퍼런스 아님)
        reference_pitch=[
            ComparePitchFrame(time=f.time, midi_note=f.midi_note, frequency=f.frequency)
            for f in sliced_ref
        ],
        alignment=alignment,
        judgement=_build_judgement(alignment, cent_errors, timing_errors),
        phrase_results=phrase_results,
        detected_offset_sec=detected_offset_sec,
    )
