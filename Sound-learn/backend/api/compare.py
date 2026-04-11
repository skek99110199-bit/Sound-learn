from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.aligner import align_midi_sequences, calculate_cent_error, midi_to_hz

router = APIRouter()

CENT_TOLERANCE = 100.0


class ComparePitchFrame(BaseModel):
    time: float
    midi_note: float | None
    frequency: float | None = None


class CompareRequest(BaseModel):
    user_pitch: list[ComparePitchFrame] = Field(min_length=1)
    reference_pitch: list[ComparePitchFrame] = Field(min_length=1)


class AlignmentFrame(BaseModel):
    user_time: float
    reference_time: float
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


class CompareResponse(BaseModel):
    user_pitch: list[ComparePitchFrame]
    reference_pitch: list[ComparePitchFrame]
    alignment: list[AlignmentFrame]
    judgement: JudgementSummary


def _normalize_frames(frames: list[ComparePitchFrame]) -> list[ComparePitchFrame]:
    return [frame for frame in frames if frame.midi_note is not None]


def _resolve_frequency(frame: ComparePitchFrame) -> float:
    if frame.frequency is not None:
        return frame.frequency
    if frame.midi_note is None:
        raise ValueError("midi_note 또는 frequency가 필요합니다.")
    return midi_to_hz(frame.midi_note)


@router.post("/compare", response_model=CompareResponse)
async def compare_pitch(request: CompareRequest):
    user_frames = _normalize_frames(request.user_pitch)
    reference_frames = _normalize_frames(request.reference_pitch)

    if not user_frames:
        raise HTTPException(status_code=422, detail="비교 가능한 user_pitch 유성 프레임이 없습니다.")
    if not reference_frames:
        raise HTTPException(status_code=422, detail="비교 가능한 reference_pitch 프레임이 없습니다.")

    path = align_midi_sequences(
        [frame.midi_note for frame in user_frames if frame.midi_note is not None],
        [frame.midi_note for frame in reference_frames if frame.midi_note is not None],
    )

    if not path:
        raise HTTPException(status_code=422, detail="DTW 정렬 결과를 생성할 수 없습니다.")

    alignment: list[AlignmentFrame] = []
    cent_errors: list[float] = []

    for user_index, reference_index in path:
        user = user_frames[user_index]
        reference = reference_frames[reference_index]

        if user.midi_note is None or reference.midi_note is None:
            continue

        user_frequency = _resolve_frequency(user)
        reference_frequency = _resolve_frequency(reference)
        cent_error = round(calculate_cent_error(user_frequency, reference_frequency), 2)
        is_correct = abs(cent_error) <= CENT_TOLERANCE

        alignment.append(
            AlignmentFrame(
                user_time=round(user.time, 3),
                reference_time=round(reference.time, 3),
                user_midi=round(user.midi_note, 1),
                reference_midi=round(reference.midi_note, 1),
                user_frequency=round(user_frequency, 2),
                reference_frequency=round(reference_frequency, 2),
                cent_error=cent_error,
                is_correct=is_correct,
            )
        )
        cent_errors.append(cent_error)

    if not alignment:
        raise HTTPException(status_code=422, detail="정렬 후 비교 가능한 frame이 없습니다.")

    correct_frames = sum(1 for frame in alignment if frame.is_correct)
    total_compared_frames = len(alignment)

    judgement = JudgementSummary(
        correct_frames=correct_frames,
        total_compared_frames=total_compared_frames,
        accuracy_percent=round((correct_frames / total_compared_frames) * 100, 2),
        avg_cent_error=round(sum(cent_errors) / len(cent_errors), 2) if cent_errors else None,
        max_positive_cent_error=round(max(cent_errors), 2) if cent_errors else None,
        max_negative_cent_error=round(min(cent_errors), 2) if cent_errors else None,
    )

    return CompareResponse(
        user_pitch=request.user_pitch,
        reference_pitch=request.reference_pitch,
        alignment=alignment,
        judgement=judgement,
    )
