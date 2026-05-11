"""사용자 pitch와 레퍼런스 pitch를 비교하는 API."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.aligner import align_midi_sequences, calculate_cent_error, find_best_offset, midi_to_hz
from core.phrase_detector import compute_phrase_results, detect_phrases

router = APIRouter()

CENT_TOLERANCE = 100.0  # ±100 cent 이내면 정답으로 판정


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
    """midi_note가 None인 무성 프레임을 제거한다."""
    return [f for f in frames if f.midi_note is not None]


def _resolve_frequency(frame: ComparePitchFrame) -> float:
    """frame에서 frequency를 반환한다. 없으면 midi_note로 계산한다."""
    if frame.frequency is not None:
        return frame.frequency
    return midi_to_hz(frame.midi_note)  # type: ignore[arg-type]


def _build_judgement(
    alignment: list[AlignmentFrame],
    cent_errors: list[float],
    timing_errors: list[float],
) -> JudgementSummary:
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
    user_frames = _only_voiced(request.user_pitch)
    ref_frames  = _only_voiced(request.reference_pitch)

    if not user_frames:
        raise HTTPException(status_code=422, detail="유성 user_pitch 프레임이 없습니다.")
    if not ref_frames:
        raise HTTPException(status_code=422, detail="유성 reference_pitch 프레임이 없습니다.")

    user_notes = [f.midi_note for f in user_frames]
    ref_notes  = [f.midi_note for f in ref_frames]

    # ── Subsequence DTW: 레퍼런스에서 최적 구간 자동 탐색 ──────────────────────
    start_idx, end_idx = find_best_offset(user_notes, ref_notes)
    sliced_ref = ref_frames[start_idx:end_idx] if end_idx > start_idx else ref_frames

    detected_offset_sec = round(sliced_ref[0].time, 2) if sliced_ref else None
    time_offset         = sliced_ref[0].time if sliced_ref else 0.0
    sliced_notes        = [f.midi_note for f in sliced_ref]

    path = align_midi_sequences(user_notes, sliced_notes)
    if not path:
        raise HTTPException(status_code=422, detail="DTW alignment을 생성할 수 없습니다.")

    # ── Alignment 계산 ────────────────────────────────────────────────────────
    alignment: list[AlignmentFrame] = []
    cent_errors: list[float] = []
    timing_errors: list[float] = []

    try:
        for user_idx, ref_idx in path:
            u = user_frames[user_idx]
            r = sliced_ref[ref_idx]

            u_freq  = _resolve_frequency(u)
            r_freq  = _resolve_frequency(r)
            cent_err    = round(calculate_cent_error(u_freq, r_freq), 2)
            timing_err  = round(u.time - (r.time - time_offset), 3)
            is_correct  = abs(cent_err) <= CENT_TOLERANCE

            alignment.append(AlignmentFrame(
                user_time=round(u.time, 3),
                reference_time=round(r.time, 3),
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

    # ── 소절 단위 집계 ────────────────────────────────────────────────────────
    ref_dicts   = [{"time": f.time, "midi_note": f.midi_note} for f in sliced_ref]
    phrases     = detect_phrases(ref_dicts)
    phrase_results = [
        PhraseResult(**r) for r in compute_phrase_results(alignment, phrases)
    ]

    return CompareResponse(
        user_pitch=request.user_pitch,
        reference_pitch=[
            ComparePitchFrame(time=f.time, midi_note=f.midi_note, frequency=f.frequency)
            for f in sliced_ref
        ],
        alignment=alignment,
        judgement=_build_judgement(alignment, cent_errors, timing_errors),
        phrase_results=phrase_results,
        detected_offset_sec=detected_offset_sec,
    )
