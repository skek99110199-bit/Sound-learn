export interface PitchFrame {
  time: number;
  frequency: number | null;
  midi_note: number | null;
}

export interface PianoRollProps {
  pitchData: PitchFrame[];
  referenceData?: PitchFrame[];
  width?: number;
  height?: number;
}

export interface PitchSummary {
  voiced_frames: number;
  total_frames: number;
  min_frequency: number | null;
  max_frequency: number | null;
  min_midi: number | null;
  max_midi: number | null;
  avg_frequency: number | null;
}

export interface AnalysisSummaryProps {
  durationSec: number;
  summary: PitchSummary;
}
