export interface PitchFrame {
  time: number;
  frequency: number | null;
  midi_note: number | null;
}

export interface AlignmentFrame {
  user_time: number;
  reference_time: number;
  user_midi: number;
  reference_midi: number;
  user_frequency: number;
  reference_frequency: number;
  cent_error: number;
  is_correct: boolean;
}

export interface JudgementSummary {
  correct_frames: number;
  total_compared_frames: number;
  accuracy_percent: number;
  avg_cent_error: number | null;
  max_positive_cent_error: number | null;
  max_negative_cent_error: number | null;
}

export interface CompareResponse {
  user_pitch: PitchFrame[];
  reference_pitch: PitchFrame[];
  alignment: AlignmentFrame[];
  judgement: JudgementSummary;
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
