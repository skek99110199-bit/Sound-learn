from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.aligner import align_midi_sequences, calculate_cent_error, midi_to_hz

router = APIRouter()

CENT_TOLERANCE = 100.0
ERROR_SEGMENT_MAX_GAP_SEC = 0.18


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


class ErrorSegment(BaseModel):
    start_time: float
    end_time: float
    avg_cent_error: float
    max_abs_cent_error: float
    direction: str
    frame_count: int


class CompareResponse(BaseModel):
    user_pitch: list[ComparePitchFrame]
    reference_pitch: list[ComparePitchFrame]
    alignment: list[AlignmentFrame]
    judgement: JudgementSummary
    error_segments: list[ErrorSegment]


def _normalize_frames(frames: list[ComparePitchFrame]) -> list[ComparePitchFrame]:
    return [frame for frame in frames if frame.midi_note is not None]


def _resolve_frequency(frame: ComparePitchFrame) -> float:
    if frame.frequency is not None:
        return frame.frequency
    if frame.midi_note is None:
        raise ValueError("midi_note or frequency is required.")
    return midi_to_hz(frame.midi_note)


def _build_error_segments(
    alignment: list[AlignmentFrame],
    max_gap_sec: float = ERROR_SEGMENT_MAX_GAP_SEC,
) -> list[ErrorSegment]:
    error_frames = [frame for frame in alignment if not frame.is_correct]
    if not error_frames:
        return []

    sorted_frames = sorted(error_frames, key=lambda frame: frame.user_time)
    groups: list[list[AlignmentFrame]] = []
    current = [sorted_frames[0]]

    for frame in sorted_frames[1:]:
        previous = current[-1]
        if frame.user_time - previous.user_time <= max_gap_sec:
            current.append(frame)
        else:
            groups.append(current)
            current = [frame]
    groups.append(current)

    return [_summarize_error_group(group) for group in groups]


def _summarize_error_group(group: list[AlignmentFrame]) -> ErrorSegment:
    cent_errors = [frame.cent_error for frame in group]
    avg_cent_error = sum(cent_errors) / len(cent_errors)
    max_abs_cent_error = max(abs(value) for value in cent_errors)

    if avg_cent_error > 20:
        direction = "sharp"
    elif avg_cent_error < -20:
        direction = "flat"
    else:
        direction = "mixed"

    return ErrorSegment(
        start_time=round(group[0].user_time, 3),
        end_time=round(group[-1].user_time, 3),
        avg_cent_error=round(avg_cent_error, 2),
        max_abs_cent_error=round(max_abs_cent_error, 2),
        direction=direction,
        frame_count=len(group),
    )


@router.post("/compare", response_model=CompareResponse)
async def compare_pitch(request: CompareRequest):
    user_frames = _normalize_frames(request.user_pitch)
    reference_frames = _normalize_frames(request.reference_pitch)

    if not user_frames:
        raise HTTPException(status_code=422, detail="No voiced user_pitch frames are available.")
    if not reference_frames:
        raise HTTPException(status_code=422, detail="No voiced reference_pitch frames are available.")

    path = align_midi_sequences(
        [frame.midi_note for frame in user_frames if frame.midi_note is not None],
        [frame.midi_note for frame in reference_frames if frame.midi_note is not None],
    )

    if not path:
        raise HTTPException(status_code=422, detail="DTW alignment could not be created.")

    alignment: list[AlignmentFrame] = []
    cent_errors: list[float] = []
    timing_errors: list[float] = []

    try:
        for user_index, reference_index in path:
            user = user_frames[user_index]
            reference = reference_frames[reference_index]

            if user.midi_note is None or reference.midi_note is None:
                continue

            user_frequency = _resolve_frequency(user)
            reference_frequency = _resolve_frequency(reference)
            cent_error = round(calculate_cent_error(user_frequency, reference_frequency), 2)
            timing_error = round(user.time - reference.time, 3)
            is_correct = abs(cent_error) <= CENT_TOLERANCE

            alignment.append(
                AlignmentFrame(
                    user_time=round(user.time, 3),
                    reference_time=round(reference.time, 3),
                    timing_error_sec=timing_error,
                    user_midi=round(user.midi_note, 1),
                    reference_midi=round(reference.midi_note, 1),
                    user_frequency=round(user_frequency, 2),
                    reference_frequency=round(reference_frequency, 2),
                    cent_error=cent_error,
                    is_correct=is_correct,
                )
            )
            cent_errors.append(cent_error)
            timing_errors.append(timing_error)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not alignment:
        raise HTTPException(status_code=422, detail="No comparable frames remained after alignment.")

    correct_frames = sum(1 for frame in alignment if frame.is_correct)
    total_compared_frames = len(alignment)

    judgement = JudgementSummary(
        correct_frames=correct_frames,
        total_compared_frames=total_compared_frames,
        accuracy_percent=round((correct_frames / total_compared_frames) * 100, 2),
        avg_cent_error=round(sum(cent_errors) / len(cent_errors), 2) if cent_errors else None,
        max_positive_cent_error=round(max(cent_errors), 2) if cent_errors else None,
        max_negative_cent_error=round(min(cent_errors), 2) if cent_errors else None,
        avg_abs_timing_error_sec=round(
            sum(abs(value) for value in timing_errors) / len(timing_errors),
            3,
        ) if timing_errors else None,
        max_abs_timing_error_sec=round(
            max(abs(value) for value in timing_errors),
            3,
        ) if timing_errors else None,
    )

    return CompareResponse(
        user_pitch=request.user_pitch,
        reference_pitch=request.reference_pitch,
        alignment=alignment,
        judgement=judgement,
        error_segments=_build_error_segments(alignment),
    )
