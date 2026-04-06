/**
 * MIDI 노트 → 한국어 음계 변환 유틸리티
 *
 * 표기법: "3옥 도#", "4옥 라" 등
 * 옥타브별 고유 색상으로 Piano Roll Y축 구분
 */

const NOTE_NAMES_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 옥타브별 색상 팔레트 */
const OCTAVE_COLORS: Record<number, string> = {
  1: '#a1a1aa', // zinc-400  — 1옥타브 (매우 낮음)
  2: '#8b5cf6', // violet-500 — 2옥타브
  3: '#3b82f6', // blue-500  — 3옥타브
  4: '#10b981', // emerald-500 — 4옥타브 (가온다)
  5: '#f59e0b', // amber-500  — 5옥타브
  6: '#ef4444', // red-500   — 6옥타브 (매우 높음)
  7: '#ec4899', // pink-500  — 7옥타브
};

const DEFAULT_COLOR = '#71717a'; // zinc-500

/** MIDI 노트 번호에서 옥타브 추출 (C4 = 60 → 4옥타브) */
export function midiToOctave(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/** MIDI → 한국어 음이름 (예: "도", "솔#") */
export function midiToNoteKo(midi: number): string {
  return NOTE_NAMES_KO[Math.round(midi) % 12];
}

/** MIDI → 영문 음이름 (예: "C", "G#") */
export function midiToNoteEn(midi: number): string {
  return NOTE_NAMES_EN[Math.round(midi) % 12];
}

/**
 * MIDI → 짧은 한국어 표기 (Piano Roll Y축 라벨용)
 * 예: "3옥 도", "4옥 솔#"
 */
export function midiToLabelShort(midi: number): string {
  const octave = midiToOctave(midi);
  const note = midiToNoteKo(midi);
  return `${octave}옥 ${note}`;
}

/**
 * MIDI → 전체 한국어 표기 (툴팁, 요약 카드용)
 * 예: "3옥타브 도", "4옥타브 솔#"
 */
export function midiToLabelFull(midi: number): string {
  const octave = midiToOctave(midi);
  const note = midiToNoteKo(midi);
  return `${octave}옥타브 ${note}`;
}

/** 옥타브에 해당하는 색상 반환 */
export function octaveColor(midi: number): string {
  const octave = midiToOctave(midi);
  return OCTAVE_COLORS[octave] ?? DEFAULT_COLOR;
}

/** 도(C) 음계인지 확인 */
export function isC(midi: number): boolean {
  return Math.round(midi) % 12 === 0;
}
