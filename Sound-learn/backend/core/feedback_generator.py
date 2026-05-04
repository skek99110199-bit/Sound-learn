import json
import os

from pydantic import BaseModel

from core.config import OPENAI_MODEL
from core.feedback_summary import FeedbackInputSummary


class FeedbackFocusSegment(BaseModel):
    start_time: float
    end_time: float
    issue: str
    tip: str


class FeedbackResponse(BaseModel):
    overall: str
    strengths: list[str]
    improvements: list[str]
    practice_tips: list[str]
    focus_segments: list[FeedbackFocusSegment]
    score_label: str


class FeedbackGenerationError(RuntimeError):
    pass


FEEDBACK_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "overall": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "improvements": {"type": "array", "items": {"type": "string"}},
        "practice_tips": {"type": "array", "items": {"type": "string"}},
        "focus_segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_time": {"type": "number"},
                    "end_time": {"type": "number"},
                    "issue": {"type": "string"},
                    "tip": {"type": "string"},
                },
                "required": ["start_time", "end_time", "issue", "tip"],
                "additionalProperties": False,
            },
        },
        "score_label": {
            "type": "string",
            "enum": ["excellent", "good", "needs_practice", "poor"],
        },
    },
    "required": [
        "overall",
        "strengths",
        "improvements",
        "practice_tips",
        "focus_segments",
        "score_label",
    ],
    "additionalProperties": False,
}


def generate_ai_feedback(summary: FeedbackInputSummary) -> FeedbackResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise FeedbackGenerationError("OPENAI_API_KEY is not configured.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise FeedbackGenerationError(
            "openai package is not installed. Run pip install -r requirements.txt."
        ) from exc

    client = OpenAI(api_key=api_key)

    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are a concise vocal coach for Korean learners. "
                        "Use the numeric singing analysis to produce practical feedback. "
                        "Respond in Korean. Keep each item short and actionable."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(summary.model_dump(), ensure_ascii=False),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "sound_learn_feedback",
                    "strict": True,
                    "schema": FEEDBACK_JSON_SCHEMA,
                }
            },
        )
    except Exception as exc:
        raise FeedbackGenerationError(f"OpenAI feedback generation failed: {exc}") from exc

    try:
        return FeedbackResponse.model_validate_json(response.output_text)
    except Exception as exc:
        raise FeedbackGenerationError("OpenAI response did not match feedback schema.") from exc
