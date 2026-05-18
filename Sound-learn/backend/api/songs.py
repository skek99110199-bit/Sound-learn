"""기준곡 reference pitch 추출 API.

지원 방식:
  POST /api/songs/upload-reference  — 오디오 파일 업로드 (WAV, MP3 등)
  POST /api/songs/youtube           — YouTube URL (yt-dlp + ffmpeg 필요)

처리 흐름:
  파일 업로드: 임시 파일 저장 → extract_pitch() → voiced frame 필터링 → 반환
  YouTube   : yt-dlp 다운로드 → WAV 변환 → extract_pitch() → voiced frame 필터링 → 반환

  yt-dlp 호출은 동기 블로킹 함수이므로 asyncio.run_in_executor로 스레드 풀에서 실행한다.
  (FastAPI의 async 이벤트 루프를 블로킹하지 않기 위함)
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from core.pitch_engine import extract_pitch

router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
MAX_YOUTUBE_DURATION_SEC = 600  # 10분


# ── 공통 응답 모델 ────────────────────────────────────────────────────────────

class ReferencePitchFrame(BaseModel):
    time: float
    midi_note: float
    frequency: float


class ReferencePitchResponse(BaseModel):
    song_id: str
    title: str
    frames: list[ReferencePitchFrame]


def _voiced_frames(raw: list[dict]) -> list[ReferencePitchFrame]:
    """pitch 추출 결과에서 무성 구간(None)을 제거해 반환한다."""
    return [
        ReferencePitchFrame(**f)
        for f in raw
        if f["midi_note"] is not None and f["frequency"] is not None
    ]


# ── 파일 업로드 ───────────────────────────────────────────────────────────────

@router.post("/songs/upload-reference", response_model=ReferencePitchResponse)
async def upload_reference_audio(file: UploadFile = File(...)):
    """오디오 파일(WAV/MP3 등)을 업로드해 reference pitch를 추출한다."""
    suffix = Path(file.filename or "audio").suffix.lower() or ".wav"
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))})",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        raw = extract_pitch(tmp_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Pitch 추출 실패: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    title = Path(file.filename or "업로드 파일").stem
    return ReferencePitchResponse(
        song_id="upload",
        title=title,
        frames=_voiced_frames(raw),
    )


# ── YouTube ───────────────────────────────────────────────────────────────────

class YouTubeRequest(BaseModel):
    url: str


def _download_and_extract(url: str) -> tuple[list[dict], str]:
    """YouTube URL에서 오디오를 다운로드하고 pitch를 추출한다 (동기, 스레드 실행)."""
    try:
        import yt_dlp
    except ImportError as exc:
        raise RuntimeError("yt-dlp가 설치되지 않았습니다. pip install yt-dlp") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        # 1) 메타데이터 조회 (길이 제한 확인)
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
            except Exception as exc:
                raise ValueError(f"YouTube 영상을 찾을 수 없습니다: {exc}") from exc

        if (info.get("duration") or 0) > MAX_YOUTUBE_DURATION_SEC:
            raise ValueError("영상이 너무 깁니다 (최대 10분까지 지원).")

        title: str = info.get("title") or "YouTube 음원"

        # 2) 오디오 다운로드 → WAV 변환 (ffmpeg 필요)
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"),
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
            "quiet": True,
            "no_warnings": True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as exc:
            raise RuntimeError(
                f"다운로드 실패: {exc}\n"
                "ffmpeg가 설치되어 있는지 확인하세요 (https://ffmpeg.org/download.html)"
            ) from exc

        wav_path = os.path.join(tmpdir, "audio.wav")
        if not os.path.exists(wav_path):
            # ffmpeg 없이 다운로드된 원본 파일로 대체 시도
            files = [f for f in os.listdir(tmpdir) if not f.endswith(".part")]
            if not files:
                raise RuntimeError("오디오 파일 다운로드에 실패했습니다.")
            wav_path = os.path.join(tmpdir, files[0])

        # 3) Pitch 추출
        try:
            frames = extract_pitch(wav_path)
        except Exception as exc:
            raise RuntimeError(f"Pitch 추출 실패: {exc}") from exc

    return frames, title


@router.post("/songs/youtube", response_model=ReferencePitchResponse)
async def get_youtube_reference(req: YouTubeRequest):
    """YouTube URL에서 reference pitch를 추출해 반환한다."""
    loop = asyncio.get_running_loop()
    try:
        raw, title = await loop.run_in_executor(None, _download_and_extract, req.url)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"서버 오류: {exc}") from exc

    return ReferencePitchResponse(
        song_id="youtube",
        title=title,
        frames=_voiced_frames(raw),
    )
