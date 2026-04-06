'use client';

import { useState } from 'react';
import { VoiceRecorder } from '@/components/recorder';
import type { UploadResponse } from '@/components/recorder';
import type { PitchFrame } from '@/components/analysis';
import { PianoRoll, AnalysisSummary } from '@/components/analysis';

// 백엔드 없이 프론트엔드만 테스트할 때 사용하는 더미 데이터
const DUMMY_PITCH: PitchFrame[] = [
  { time: 0.023, frequency: 220.0, midi_note: 57.0 },
  { time: 0.046, frequency: 225.0, midi_note: 57.4 },
  { time: 0.069, frequency: 233.08, midi_note: 58.0 },
  { time: 0.093, frequency: null, midi_note: null },
  { time: 0.116, frequency: null, midi_note: null },
  { time: 0.139, frequency: 261.63, midi_note: 60.0 },
  { time: 0.163, frequency: 265.0, midi_note: 60.2 },
  { time: 0.186, frequency: 269.0, midi_note: 60.5 },
  { time: 0.209, frequency: 277.18, midi_note: 61.0 },
  { time: 0.232, frequency: 293.66, midi_note: 62.0 },
  { time: 0.255, frequency: 296.0, midi_note: 62.1 },
  { time: 0.279, frequency: 311.13, midi_note: 63.0 },
  { time: 0.302, frequency: 329.63, midi_note: 64.0 },
  { time: 0.325, frequency: null, midi_note: null },
  { time: 0.348, frequency: 349.23, midi_note: 65.0 },
  { time: 0.372, frequency: 355.0, midi_note: 65.3 },
  { time: 0.395, frequency: 369.99, midi_note: 66.0 },
  { time: 0.418, frequency: 392.0, midi_note: 67.0 },
  { time: 0.441, frequency: 400.0, midi_note: 67.3 },
  { time: 0.465, frequency: 415.3, midi_note: 68.0 },
  { time: 0.488, frequency: 440.0, midi_note: 69.0 },
  { time: 0.511, frequency: 435.0, midi_note: 68.8 },
  { time: 0.534, frequency: 420.0, midi_note: 68.2 },
  { time: 0.558, frequency: null, midi_note: null },
  { time: 0.581, frequency: 392.0, midi_note: 67.0 },
  { time: 0.604, frequency: 370.0, midi_note: 66.0 },
  { time: 0.627, frequency: 349.23, midi_note: 65.0 },
  { time: 0.651, frequency: 329.63, midi_note: 64.0 },
  { time: 0.674, frequency: 311.13, midi_note: 63.0 },
  { time: 0.697, frequency: 293.66, midi_note: 62.0 },
];

const DUMMY_RESULT: UploadResponse = {
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

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<UploadResponse | null>(null);

  const handleSuccess = (res: UploadResponse) => {
    setAnalysisResult(res);
  };

  const handleReset = () => {
    setAnalysisResult(null);
  };

  const handleDemo = () => {
    setAnalysisResult(DUMMY_RESULT);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <main className="flex flex-col items-center gap-8 p-10 bg-white rounded-xl shadow-md w-full max-w-3xl">

        <h1 className="text-3xl font-bold">
          Sound-Learn
        </h1>

        <p className="text-gray-600 text-center">
          노래를 녹음하여 음정과 박자를 분석해보세요.
        </p>

        {!analysisResult ? (
          <>
            <VoiceRecorder onUploadSuccess={handleSuccess} />
            <button
              onClick={handleDemo}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline transition-colors"
            >
              데모 데이터로 미리보기
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            <AnalysisSummary
              durationSec={analysisResult.duration_sec}
              summary={analysisResult.summary}
            />

            <PianoRoll pitchData={analysisResult.pitch} />

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
              >
                다시 녹음
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
