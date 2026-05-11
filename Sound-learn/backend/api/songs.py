"""기준곡 목록 조회 및 reference pitch 반환 API."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.midi_parser import parse_midi_to_frames

router = APIRouter()

SONGS_DIR = Path(__file__).parent.parent / "songs"

# 곡 메타데이터 (파일명 → 표시 정보)
SONG_CATALOG: dict[str, dict] = {
    "twinkle": {
        "id": "twinkle",
        "title": "반짝반짝 작은별",
        "artist": "동요",
        "filename": "twinkle.mid",
    },
    "butterfly": {
        "id": "butterfly",
        "title": "나비야",
        "artist": "동요",
        "filename": "butterfly.mid",
    },
    "school_bell": {
        "id": "school_bell",
        "title": "학교종",
        "artist": "동요",
        "filename": "school_bell.mid",
    },
}


class SongMeta(BaseModel):
    id: str
    title: str
    artist: str


class SongListResponse(BaseModel):
    songs: list[SongMeta]


class ReferencePitchFrame(BaseModel):
    time: float
    midi_note: float
    frequency: float


class ReferencePitchResponse(BaseModel):
    song_id: str
    title: str
    frames: list[ReferencePitchFrame]


@router.get("/songs", response_model=SongListResponse)
def list_songs():
    """사용 가능한 기준곡 목록 반환."""
    return SongListResponse(
        songs=[
            SongMeta(id=s["id"], title=s["title"], artist=s["artist"])
            for s in SONG_CATALOG.values()
        ]
    )


@router.get("/songs/{song_id}/reference", response_model=ReferencePitchResponse)
def get_reference_pitch(song_id: str):
    """기준곡의 reference pitch 데이터 반환."""
    if song_id not in SONG_CATALOG:
        raise HTTPException(status_code=404, detail=f"'{song_id}' 곡을 찾을 수 없습니다.")

    meta = SONG_CATALOG[song_id]
    midi_path = SONGS_DIR / meta["filename"]

    if not midi_path.exists():
        raise HTTPException(status_code=404, detail="MIDI 파일이 없습니다.")

    try:
        raw_frames = parse_midi_to_frames(midi_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MIDI 파싱 실패: {exc}") from exc

    return ReferencePitchResponse(
        song_id=song_id,
        title=meta["title"],
        frames=[ReferencePitchFrame(**f) for f in raw_frames],
    )
