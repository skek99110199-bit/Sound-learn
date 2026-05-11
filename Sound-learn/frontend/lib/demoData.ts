/**
 * 백엔드 없이 프론트엔드만 테스트할 때 사용하는 더미 데이터.
 * 실제 서비스에서는 사용되지 않는다.
 */

import type { UploadResponse } from '@/components/recorder';
import type { CompareResponse, PitchFrame } from '@/components/analysis';
import type { FeedbackResponse } from '@/components/report';

const DUMMY_PITCH: PitchFrame[] = [
  { time: 0.023, frequency: 220.0,   midi_note: 57.0  },
  { time: 0.046, frequency: 225.0,   midi_note: 57.4  },
  { time: 0.069, frequency: 233.08,  midi_note: 58.0  },
  { time: 0.093, frequency: null,    midi_note: null   },
  { time: 0.116, frequency: null,    midi_note: null   },
  { time: 0.139, frequency: 261.63,  midi_note: 60.0  },
  { time: 0.163, frequency: 265.0,   midi_note: 60.2  },
  { time: 0.186, frequency: 269.0,   midi_note: 60.5  },
  { time: 0.209, frequency: 277.18,  midi_note: 61.0  },
  { time: 0.232, frequency: 293.66,  midi_note: 62.0  },
  { time: 0.255, frequency: 296.0,   midi_note: 62.1  },
  { time: 0.279, frequency: 311.13,  midi_note: 63.0  },
  { time: 0.302, frequency: 329.63,  midi_note: 64.0  },
  { time: 0.325, frequency: null,    midi_note: null   },
  { time: 0.348, frequency: 349.23,  midi_note: 65.0  },
  { time: 0.372, frequency: 355.0,   midi_note: 65.3  },
  { time: 0.395, frequency: 369.99,  midi_note: 66.0  },
  { time: 0.418, frequency: 392.0,   midi_note: 67.0  },
  { time: 0.441, frequency: 400.0,   midi_note: 67.3  },
  { time: 0.465, frequency: 415.3,   midi_note: 68.0  },
  { time: 0.488, frequency: 440.0,   midi_note: 69.0  },
  { time: 0.511, frequency: 435.0,   midi_note: 68.8  },
  { time: 0.534, frequency: 420.0,   midi_note: 68.2  },
  { time: 0.558, frequency: null,    midi_note: null   },
  { time: 0.581, frequency: 392.0,   midi_note: 67.0  },
  { time: 0.604, frequency: 370.0,   midi_note: 66.0  },
  { time: 0.627, frequency: 349.23,  midi_note: 65.0  },
  { time: 0.651, frequency: 329.63,  midi_note: 64.0  },
  { time: 0.674, frequency: 311.13,  midi_note: 63.0  },
  { time: 0.697, frequency: 293.66,  midi_note: 62.0  },
];

export const DEMO_UPLOAD: UploadResponse = {
  filename: 'demo_recording.webm',
  duration_sec: 0.72,
  original_sr: 44100,
  normalized_sr: 22050,
  pitch: DUMMY_PITCH,
  summary: {
    voiced_frames: 26,
    total_frames: 30,
    min_frequency: 220.0,
    max_frequency: 440.0,
    min_midi: 57.0,
    max_midi: 69.0,
    avg_frequency: 330.5,
  },
};

export const DEMO_COMPARE: CompareResponse = {
  user_pitch: DUMMY_PITCH,
  reference_pitch: [],
  alignment: [],
  judgement: {
    correct_frames: 18,
    total_compared_frames: 26,
    accuracy_percent: 69.2,
    avg_cent_error: -28.5,
    max_positive_cent_error: 60.0,
    max_negative_cent_error: -150.0,
    avg_abs_timing_error_sec: 0.12,
    max_abs_timing_error_sec: 0.31,
  },
  phrase_results: [],
};

export const DEMO_FEEDBACK: FeedbackResponse = {
  overall: '전반적으로 음정의 흐름이 안정적입니다. 중간 음역대에서 정확도가 높고, 음을 유지하는 능력이 좋습니다.',
  strengths: [
    '중간 음역대 구간에서 음정 정확도가 높습니다',
    '음정 변화 구간에서 안정적인 전환이 이루어졌습니다',
  ],
  improvements: [
    '전반적으로 약 30cent 낮게 부르는 경향이 있습니다',
    '고음 구간에서 음정이 떨어지는 현상이 있습니다',
  ],
  practice_tips: [
    '노래 시작 전 기준음을 충분히 듣고 발성을 맞춰보세요',
    '낮은 음부터 천천히 스케일 연습을 해보세요',
  ],
  focus_segments: [],
  score_label: 'good',
};
