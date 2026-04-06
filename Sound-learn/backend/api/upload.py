import logging
import uuid
from io import BytesIO
from pathlib import Path

import librosa
import soundfile as sf
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from core.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE, SAMPLE_RATE, TEMP_DIR
from core.pitch_engine import extract_pitch

logger = logging.getLogger("sound-learn")

router = APIRouter()


# ── Pydantic 응답 모델 ──────────────────────────────────────────────────────
class PitchFrame(BaseModel):
    time: float
    frequency: float | None
    midi_note: float | None


class PitchSummary(BaseModel):
    voiced_frames: int
    total_frames: int
    min_frequency: float | None
    max_frequency: float | None
    min_midi: float | None
    max_midi: float | None
    avg_frequency: float | None


class UploadResponse(BaseModel):
    filename: str
    duration_sec: float
    original_sr: int
    normalized_sr: int
    pitch: list[PitchFrame]
    summary: PitchSummary


# ── 엔드포인트 ───────────────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResponse)
async def upload_audio(file: UploadFile):
    # 파일명 및 확장자 검증
    if not file.filename:
        raise HTTPException(status_code=422, detail="파일명이 없습니다.")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # 파일 읽기 및 크기 제한
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail="파일 크기가 50MB를 초과합니다.",
        )

    # librosa로 로드 (원본 sr 보존 후 22050Hz로 리샘플링)
    try:
        audio_bytes = BytesIO(content)
        y_original, original_sr = librosa.load(audio_bytes, sr=None, mono=True)
    except Exception as e:
        logger.warning("오디오 디코딩 실패: %s — %s", file.filename, e)
        raise HTTPException(
            status_code=422,
            detail="오디오 파일을 디코딩할 수 없습니다.",
        )

    y_normalized = (
        librosa.resample(y_original, orig_sr=original_sr, target_sr=SAMPLE_RATE)
        if original_sr != SAMPLE_RATE
        else y_original
    )

    duration_sec = round(len(y_normalized) / SAMPLE_RATE, 3)

    # 임시 저장 (uuid prefix로 충돌 및 경로 순회 방지)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name  # 경로 구성요소 제거
    saved_name = f"{uuid.uuid4().hex}_{safe_filename.rsplit('.', 1)[0]}.wav"
    saved_path = TEMP_DIR / saved_name

    sf.write(str(saved_path), y_normalized, SAMPLE_RATE)

    # 피치 추출 후 임시 파일 삭제
    try:
        pitch_data = extract_pitch(str(saved_path))
    except RuntimeError as e:
        logger.error("피치 추출 실패: %s — %s", file.filename, e)
        raise HTTPException(
            status_code=500,
            detail="피치 분석 중 오류가 발생했습니다.",
        )
    finally:
        saved_path.unlink(missing_ok=True)

    # 요약 통계 계산
    voiced = [f for f in pitch_data if f["frequency"] is not None]
    frequencies = [f["frequency"] for f in voiced]
    midis = [f["midi_note"] for f in voiced]

    summary = PitchSummary(
        voiced_frames=len(voiced),
        total_frames=len(pitch_data),
        min_frequency=round(min(frequencies), 2) if frequencies else None,
        max_frequency=round(max(frequencies), 2) if frequencies else None,
        min_midi=min(midis) if midis else None,
        max_midi=max(midis) if midis else None,
        avg_frequency=round(sum(frequencies) / len(frequencies), 2) if frequencies else None,
    )

    logger.info(
        "분석 완료: %s (%.1f초, %d 프레임, 유성 %d)",
        file.filename,
        duration_sec,
        len(pitch_data),
        len(voiced),
    )

    return UploadResponse(
        filename=file.filename,
        duration_sec=duration_sec,
        original_sr=int(original_sr),
        normalized_sr=SAMPLE_RATE,
        pitch=pitch_data,
        summary=summary,
    )
