"""MIDI 파일 → PitchFrame 리스트 변환 모듈."""

from pathlib import Path

import mido


def midi_to_hz(midi_note: float) -> float:
    return 440.0 * (2.0 ** ((midi_note - 69.0) / 12.0))


def parse_midi_to_frames(midi_path: Path) -> list[dict]:
    """
    MIDI 파일을 읽어 PitchFrame 형식의 리스트로 반환한다.

    Returns:
        [{"time": float, "midi_note": float, "frequency": float}, ...]
    """
    mid = mido.MidiFile(str(midi_path))

    tempo = 500_000  # 기본 120 BPM
    ticks_per_beat = mid.ticks_per_beat

    frames: list[dict] = []
    current_tick = 0

    for msg in mido.merge_tracks(mid.tracks):
        current_tick += msg.time

        if msg.type == "set_tempo":
            tempo = msg.tempo
            continue

        if msg.type == "note_on" and msg.velocity > 0:
            time_sec = mido.tick2second(current_tick, ticks_per_beat, tempo)
            frames.append({
                "time": round(time_sec, 3),
                "midi_note": float(msg.note),
                "frequency": round(midi_to_hz(msg.note), 2),
            })

    return sorted(frames, key=lambda f: f["time"])
