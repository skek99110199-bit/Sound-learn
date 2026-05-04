export interface FeedbackFocusSegment {
  start_time: number;
  end_time: number;
  issue: string;
  tip: string;
}

export interface FeedbackResponse {
  overall: string;
  strengths: string[];
  improvements: string[];
  practice_tips: string[];
  focus_segments: FeedbackFocusSegment[];
  score_label: 'excellent' | 'good' | 'needs_practice' | 'poor';
}

export interface FeedbackApiResponse {
  input_summary: Record<string, unknown>;
  feedback: FeedbackResponse;
}

export interface FeedbackReportProps {
  feedback: FeedbackResponse;
}

export interface FeedbackErrorProps {
  message: string;
  onRetry: () => void;
}
