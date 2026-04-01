import uuid
from io import BytesIO
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from fastapi import APIRouter, HTTPException, UploadFile

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".webm"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
NORMALIZED_SR = 22050
TEMP_DIR = Path(__file__).parent.parent / "temp"

router = APIRouter()


@router.post("/upload")
async def upload_audio(file: UploadFile):
    # 확장자 검증
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

    # librosa로 로드 (원본 sr 먼저 확인, 이후 22050Hz로 리샘플링)
    audio_bytes = BytesIO(content)
    y_original, original_sr = librosa.load(audio_bytes, sr=None, mono=True)

    audio_bytes.seek(0)
    y_normalized, _ = librosa.load(audio_bytes, sr=NORMALIZED_SR, mono=True)

    duration_sec = round(len(y_normalized) / NORMALIZED_SR, 3)

    # 임시 저장 (uuid prefix로 충돌 및 경로 순회 방지)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name  # 경로 구성요소 제거
    saved_name = f"{uuid.uuid4().hex}_{safe_filename.rsplit('.', 1)[0]}.wav"
    saved_path = TEMP_DIR / saved_name

    sf.write(str(saved_path), y_normalized, NORMALIZED_SR)

    return {
        "filename": file.filename,
        "saved_path": f"temp/{saved_name}",
        "duration_sec": duration_sec,
        "original_sr": int(original_sr),
        "normalized_sr": NORMALIZED_SR,
    }
