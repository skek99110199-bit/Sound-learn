export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface UploadResponse {
  filename: string;
  saved_path: string;
  duration_sec: number;
  original_sr: number;
  normalized_sr: number;
}

export interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export interface VoiceRecorderProps {
  onUploadSuccess?: (res: UploadResponse) => void;
  onUploadError?: (msg: string) => void;
}
