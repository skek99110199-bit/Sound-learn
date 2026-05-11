export interface PitchFrame {
  time: number;
  frequency: number | null;
  midi_note: number | null;
}

export interface AlignmentFrame {
  user_time: number;
  reference_time: number;
  timing_error_sec: number;
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
  avg_abs_timing_error_sec: number | null;
  max_abs_timing_error_sec: number | null;
}

export interface PhraseResult {
  index: number;
  ref_start_time: number;
  ref_end_time: number;
  user_start_time: number;
  user_end_time: number;
  accuracy_percent: number;
  avg_cent_error: number | null;
  direction: 'sharp' | 'flat' | 'mixed';
  frame_count: number;
  is_good: boolean;
}

export interface CompareResponse {
  user_pitch: PitchFrame[];
  reference_pitch: PitchFrame[];
  alignment: AlignmentFrame[];
  judgement: JudgementSummary;
  phrase_results: PhraseResult[];
  detected_offset_sec?: number | null;
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
