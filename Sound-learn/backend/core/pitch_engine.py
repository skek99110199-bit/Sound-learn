import math

import librosa
import numpy as np

from core.config import FMAX, FMIN, HOP_LENGTH, SAMPLE_RATE

# ── 로컬 상수 (표시 정밀도) ──────────────────────────────────────────────────
MIDI_ROUND = 1         # MIDI 노트 소수점 자리수 (Piano Roll 스무딩용)
FREQ_ROUND = 2         # Hz 소수점 자리수


# ── 공개 진입점 ──────────────────────────────────────────────────────────────
def extract_pitch(file_path: str) -> list[dict]:
    """
    22050Hz 정규화된 WAV 파일에서 시간대별 Pitch를 추출한다.

    Args:
        file_path: backend/temp/ 하위 WAV 파일의 절대 또는 상대 경로

    Returns:
        프레임별 딕셔너리 리스트.
        무성 구간(묵음, 노이즈)은 frequency와 midi_note가 null.

        예시:
        [
          {"time": 0.023, "frequency": 220.0,  "midi_note": 57.0},
          {"time": 0.046, "frequency": 261.63, "midi_note": 60.0},
          {"time": 0.069, "frequency": null,   "midi_note": null},
          ...
        ]

    Raises:
        RuntimeError: 오디오 파일 로드 또는 피치 추출 실패 시
    """
    y, sr = _load_audio(file_path)
    f0, voiced_flag = _run_pyin(y, sr)
    f0, voiced_flag = _smooth_pitch(f0, voiced_flag)
    return _build_frames(f0, voiced_flag, sr)


# ── 내부 함수 ────────────────────────────────────────────────────────────────
def _smooth_pitch(
    f0: np.ndarray,
    voiced_flag: np.ndarray,
    max_jump_semitones: float = 6.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    노이즈 제거 및 단발 프레임 보간.

    1) 단발 유성 프레임 제거 — 전후가 모두 무성인 1프레임짜리 유성 구간은 노이즈로 간주
    2) 단발 무성 프레임 보간 — 전후가 모두 유성인 1프레임짜리 무성 구간은 선형 보간
    3) 주파수 점프 필터 — 인접 프레임 대비 ±max_jump_semitones 초과 시 null 처리
    """
    f0 = f0.copy()
    voiced = voiced_flag.copy()
    n = len(f0)

    # 1) 단발 유성 프레임 제거 (전후 모두 무성)
    for i in range(1, n - 1):
        if voiced[i] and not voiced[i - 1] and not voiced[i + 1]:
            voiced[i] = False
            f0[i] = np.nan

    # 2) 단발 무성 프레임 보간 (전후 모두 유성)
    for i in range(1, n - 1):
        if not voiced[i] and voiced[i - 1] and voiced[i + 1]:
            if not np.isnan(f0[i - 1]) and not np.isnan(f0[i + 1]):
                f0[i] = (f0[i - 1] + f0[i + 1]) / 2
                voiced[i] = True

    # 3) 주파수 점프 필터 (±6반음 초과)
    for i in range(1, n):
        if voiced[i] and voiced[i - 1]:
            if not np.isnan(f0[i]) and not np.isnan(f0[i - 1]) and f0[i - 1] > 0:
                semitone_diff = abs(12 * np.log2(f0[i] / f0[i - 1]))
                if semitone_diff > max_jump_semitones:
                    voiced[i] = False
                    f0[i] = np.nan

    return f0, voiced


def _load_audio(file_path: str) -> tuple[np.ndarray, int]:
    """오디오 파일을 22050Hz 모노로 로드한다."""
    try:
        y, sr = librosa.load(file_path, sr=SAMPLE_RATE, mono=True)
    except Exception as e:
        raise RuntimeError(f"오디오 로드 실패: {e}") from e
    return y, sr


def _run_pyin(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    """
    librosa.pyin으로 f0와 유성음 플래그를 추출한다.

    pyin은 HMM 기반 후처리로 piptrack보다 보컬 추적 정확도가 높으며
    무성 구간(묵음/노이즈)을 NaN으로 마킹한다.
    """
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=FMIN,
        fmax=FMAX,
        sr=sr,
        hop_length=HOP_LENGTH,
    )
    return f0, voiced_flag


def _hz_to_midi(freq: float) -> float:
    """
    Hz → MIDI 노트 번호 변환.
    공식: P = 69 + 12 × log2(f / 440)
    """
    return round(69 + 12 * math.log2(freq / 440), MIDI_ROUND)


def _build_frames(
    f0: np.ndarray,
    voiced_flag: np.ndarray,
    sr: int,
) -> list[dict]:
    """
    f0 배열과 voiced_flag 배열을 결과 JSON 배열로 변환한다.

    무성 판정 기준 (둘 중 하나라도 해당하면 null):
      - voiced_flag[i] == False
      - f0[i] is NaN  (pyin이 추적 실패한 프레임)
    """
    times = librosa.times_like(f0, sr=sr, hop_length=HOP_LENGTH)
    frames = []

    for t, freq, is_voiced in zip(times, f0, voiced_flag):
        if not is_voiced or np.isnan(freq):
            frames.append({
                "time": round(float(t), 3),
                "frequency": None,
                "midi_note": None,
            })
        else:
            frames.append({
                "time": round(float(t), 3),
                "frequency": round(float(freq), FREQ_ROUND),
                "midi_note": _hz_to_midi(float(freq)),
            })

    return frames
