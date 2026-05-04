from pydantic import BaseModel


class FeedbackPitchSummary(BaseModel):
    voiced_frames: int
    total_frames: int
    min_frequency: float | None = None
    max_frequency: float | None = None
    min_midi: float | None = None
    max_midi: float | None = None
    avg_frequency: float | None = None


class FeedbackJudgementSummary(BaseModel):
    correct_frames: int
    total_compared_frames: int
    accuracy_percent: float
    avg_cent_error: float | None = None
    max_positive_cent_error: float | None = None
    max_negative_cent_error: float | None = None


class FeedbackAlignmentFrame(BaseModel):
    user_time: float
    reference_time: float
    user_midi: float
    reference_midi: float
    user_frequency: float
    reference_frequency: float
    cent_error: float
    is_correct: bool


class FeedbackSegment(BaseModel):
    start_time: float
    end_time: float
    avg_cent_error: float
    max_abs_cent_error: float
    direction: str
    frame_count: int


class FeedbackInputSummary(BaseModel):
    duration_sec: float
    accuracy_percent: float
    correct_frames: int
    total_compared_frames: int
    avg_cent_error: float | None
    max_positive_cent_error: float | None
    max_negative_cent_error: float | None
    pitch_range: dict[str, float | None]
    pitch_tendency: str
    unstable_segments: list[FeedbackSegment]


def build_feedback_summary(
    duration_sec: float,
    pitch_summary: FeedbackPitchSummary,
    judgement: FeedbackJudgementSummary,
    alignment: list[FeedbackAlignmentFrame],
) -> FeedbackInputSummary:
    errors = [frame for frame in alignment if not frame.is_correct]
    unstable_segments = _build_unstable_segments(errors)

    return FeedbackInputSummary(
        duration_sec=round(duration_sec, 3),
        accuracy_percent=round(judgement.accuracy_percent, 2),
        correct_frames=judgement.correct_frames,
        total_compared_frames=judgement.total_compared_frames,
        avg_cent_error=judgement.avg_cent_error,
        max_positive_cent_error=judgement.max_positive_cent_error,
        max_negative_cent_error=judgement.max_negative_cent_error,
        pitch_range={
            "min_midi": pitch_summary.min_midi,
            "max_midi": pitch_summary.max_midi,
            "min_frequency": pitch_summary.min_frequency,
            "max_frequency": pitch_summary.max_frequency,
        },
        pitch_tendency=_resolve_pitch_tendency(judgement.avg_cent_error),
        unstable_segments=unstable_segments[:3],
    )


def _resolve_pitch_tendency(avg_cent_error: float | None) -> str:
    if avg_cent_error is None or abs(avg_cent_error) < 20:
        return "mostly_centered"
    if avg_cent_error > 0:
        return "tends_sharp"
    return "tends_flat"


def _build_unstable_segments(
    error_frames: list[FeedbackAlignmentFrame],
    max_gap_sec: float = 0.18,
) -> list[FeedbackSegment]:
    if not error_frames:
        return []

    sorted_frames = sorted(error_frames, key=lambda frame: frame.user_time)
    groups: list[list[FeedbackAlignmentFrame]] = []
    current: list[FeedbackAlignmentFrame] = [sorted_frames[0]]

    for frame in sorted_frames[1:]:
        prev = current[-1]
        if frame.user_time - prev.user_time <= max_gap_sec:
            current.append(frame)
        else:
            groups.append(current)
            current = [frame]
    groups.append(current)

    segments = [_summarize_segment(group) for group in groups]
    return sorted(segments, key=lambda segment: segment.max_abs_cent_error, reverse=True)


def _summarize_segment(group: list[FeedbackAlignmentFrame]) -> FeedbackSegment:
    cent_errors = [frame.cent_error for frame in group]
    avg_cent_error = sum(cent_errors) / len(cent_errors)
    max_abs_cent_error = max(abs(value) for value in cent_errors)

    if avg_cent_error > 20:
        direction = "sharp"
    elif avg_cent_error < -20:
        direction = "flat"
    else:
        direction = "mixed"

    return FeedbackSegment(
        start_time=round(group[0].user_time, 3),
        end_time=round(group[-1].user_time, 3),
        avg_cent_error=round(avg_cent_error, 2),
        max_abs_cent_error=round(max_abs_cent_error, 2),
        direction=direction,
        frame_count=len(group),
    )
