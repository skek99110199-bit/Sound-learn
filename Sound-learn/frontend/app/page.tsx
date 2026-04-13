'use client';

import { useCallback, useEffect, useState } from 'react';
import { VoiceRecorder } from '@/components/recorder';
import type { UploadResponse } from '@/components/recorder';
import type { CompareResponse, PitchFrame } from '@/components/analysis';
import { PianoRoll, AnalysisSummary, CompareSummary } from '@/components/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const COMPARE_URL = `${API_URL}/api/compare`;

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

const DEMO_REFERENCE_PITCH: PitchFrame[] = [
  { time: 0.023, frequency: null, midi_note: 57.0 },
  { time: 0.139, frequency: null, midi_note: 60.0 },
  { time: 0.232, frequency: null, midi_note: 62.0 },
  { time: 0.279, frequency: null, midi_note: 63.0 },
  { time: 0.302, frequency: null, midi_note: 64.0 },
  { time: 0.348, frequency: null, midi_note: 65.0 },
  { time: 0.395, frequency: null, midi_note: 66.0 },
  { time: 0.418, frequency: null, midi_note: 67.0 },
  { time: 0.465, frequency: null, midi_note: 68.0 },
  { time: 0.488, frequency: null, midi_note: 69.0 },
  { time: 0.581, frequency: null, midi_note: 67.0 },
  { time: 0.604, frequency: null, midi_note: 66.0 },
  { time: 0.627, frequency: null, midi_note: 65.0 },
  { time: 0.651, frequency: null, midi_note: 64.0 },
  { time: 0.674, frequency: null, midi_note: 63.0 },
  { time: 0.697, frequency: null, midi_note: 62.0 },
];

type CompareStatus = 'idle' | 'loading' | 'success' | 'error';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '비교 요청에 실패했습니다.';
}

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<UploadResponse | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [compareStatus, setCompareStatus] = useState<CompareStatus>('idle');
  const [compareError, setCompareError] = useState('');

  const runCompare = useCallback(async (uploadResult: UploadResponse) => {
    setCompareStatus('loading');
    setCompareError('');
    setCompareResult(null);

    try {
      const response = await fetch(COMPARE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_pitch: uploadResult.pitch,
          reference_pitch: DEMO_REFERENCE_PITCH,
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ detail: '비교 중 알 수 없는 오류가 발생했습니다.' }));
        throw new Error(errorBody.detail ?? `HTTP ${response.status}`);
      }

      const data: CompareResponse = await response.json();
      setCompareResult(data);
      setCompareStatus('success');
    } catch (error) {
      setCompareStatus('error');
      setCompareError(getErrorMessage(error));
    }
  }, []);

  const handleSuccess = (result: UploadResponse) => {
    setAnalysisResult(result);
    setCompareResult(null);
    setCompareStatus('idle');
    setCompareError('');
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setCompareResult(null);
    setCompareStatus('idle');
    setCompareError('');
  };

  const handleDemo = () => {
    setAnalysisResult(DUMMY_RESULT);
  };

  const handleRetryCompare = () => {
    if (!analysisResult) return;
    runCompare(analysisResult);
  };

  useEffect(() => {
    if (!analysisResult) return;
    runCompare(analysisResult);
  }, [analysisResult, runCompare]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-xl bg-white p-10 shadow-md">
        <h1 className="text-3xl font-bold">
          Sound-Learn
        </h1>

        <p className="text-center text-gray-600">
          노래를 녹음하여 음정과 박자를 분석해보세요.
        </p>

        {!analysisResult ? (
          <>
            <VoiceRecorder onUploadSuccess={handleSuccess} />
            <button
              onClick={handleDemo}
              className="text-xs text-zinc-400 underline transition-colors hover:text-zinc-600"
            >
              데모 데이터로 미리보기
            </button>
          </>
        ) : (
          <div className="flex w-full flex-col gap-6">
            <AnalysisSummary
              durationSec={analysisResult.duration_sec}
              summary={analysisResult.summary}
            />

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Step 3 비교 결과</h2>
                  <p className="text-sm text-zinc-500">
                    업로드가 완료되면 기준 melody와 자동으로 비교합니다.
                  </p>
                </div>
                {compareStatus === 'loading' && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    비교 중...
                  </div>
                )}
              </div>

              {compareStatus === 'success' && compareResult ? (
                <CompareSummary summary={compareResult.judgement} />
              ) : compareStatus === 'error' ? (
                <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-600">
                    비교 결과를 불러오지 못했습니다. {compareError}
                  </p>
                  <div>
                    <button
                      onClick={handleRetryCompare}
                      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                    >
                      비교 다시 시도
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                  비교 결과를 준비 중입니다.
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">피아노 롤</h2>
                  <p className="text-sm text-zinc-500">
                    사용자 pitch와 기준 melody를 겹쳐서 보여줍니다.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    사용자
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-4 bg-amber-500" />
                    기준 melody
                  </div>
                </div>
              </div>

              <PianoRoll
                pitchData={analysisResult.pitch}
                referenceData={compareResult?.reference_pitch ?? DEMO_REFERENCE_PITCH}
              />
            </section>

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg bg-zinc-600 px-6 py-2 font-medium text-white transition-colors hover:bg-zinc-700"
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
