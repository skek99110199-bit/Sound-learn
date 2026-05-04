from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.feedback_generator import (
    FeedbackGenerationError,
    FeedbackResponse,
    generate_ai_feedback,
)
from core.feedback_summary import (
    FeedbackAlignmentFrame,
    FeedbackJudgementSummary,
    FeedbackPitchSummary,
    build_feedback_summary,
)

router = APIRouter()


class FeedbackRequest(BaseModel):
    duration_sec: float = Field(ge=0)
    pitch_summary: FeedbackPitchSummary
    judgement: FeedbackJudgementSummary
    alignment: list[FeedbackAlignmentFrame] = Field(min_length=1)
    filename: str | None = None
    song_title: str | None = None
    practice_goal: str | None = None


class FeedbackApiResponse(BaseModel):
    input_summary: dict
    feedback: FeedbackResponse


@router.post("/feedback", response_model=FeedbackApiResponse)
async def create_feedback(request: FeedbackRequest):
    if request.judgement.total_compared_frames <= 0:
        raise HTTPException(status_code=422, detail="No compared frames are available.")

    summary = build_feedback_summary(
        duration_sec=request.duration_sec,
        pitch_summary=request.pitch_summary,
        judgement=request.judgement,
        alignment=request.alignment,
    )

    try:
        feedback = generate_ai_feedback(summary)
    except FeedbackGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return FeedbackApiResponse(
        input_summary=summary.model_dump(),
        feedback=feedback,
    )
