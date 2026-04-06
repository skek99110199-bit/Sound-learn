export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface PitchFrame {
  time: number;
  frequency: number | null;
  midi_note: number | null;
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

export interface UploadResponse {
  filename: string;
  duration_sec: number;
  original_sr: number;
  normalized_sr: number;
  pitch: PitchFrame[];
  summary: PitchSummary;
}

export interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export interface VoiceRecorderProps {
  onUploadSuccess?: (res: UploadResponse) => void;
  onUploadError?: (msg: string) => void;
}
