'use client';

import { useCallback, useEffect, useState } from 'react';
import { VoiceRecorder } from '@/components/recorder';
import type { UploadResponse } from '@/components/recorder';
import type { CompareResponse } from '@/components/analysis';
import { PianoRoll, AnalysisSummary, CompareSummary } from '@/components/analysis';
import { FeedbackReport, FeedbackLoading, FeedbackError, MetricsReport } from '@/components/report';
import type { FeedbackApiResponse, FeedbackResponse } from '@/components/report';
import { SongSelector } from '@/components/songs';
import type { SongMeta, ReferencePitchFrame } from '@/components/songs';
import { DEMO_UPLOAD, DEMO_COMPARE, DEMO_FEEDBACK } from '@/lib/demoData';

const API_URL     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const COMPARE_URL = `${API_URL}/api/compare`;
const FEEDBACK_URL = `${API_URL}/api/feedback`;

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '요청에 실패했습니다.';
}

// ── 초기 상태 ─────────────────────────────────────────────────────────────────

const INITIAL_COMPARE_STATE = {
  result: null as CompareResponse | null,
  status: 'idle' as AsyncStatus,
  error: '',
};

const INITIAL_FEEDBACK_STATE = {
  result: null as FeedbackResponse | null,
  status: 'idle' as AsyncStatus,
  error: '',
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedSong,    setSelectedSong]    = useState<SongMeta | null>(null);
  const [referencePitch,  setReferencePitch]  = useState<ReferencePitchFrame[] | null>(null);
  const [analysisResult,  setAnalysisResult]  = useState<UploadResponse | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isDemo,          setIsDemo]          = useState(false);

  const [compareResult, setCompareResult] = useState(INITIAL_COMPARE_STATE.result);
  const [compareStatus, setCompareStatus] = useState(INITIAL_COMPARE_STATE.status);
  const [compareError,  setCompareError]  = useState(INITIAL_COMPARE_STATE.error);

  const [feedbackResult, setFeedbackResult] = useState(INITIAL_FEEDBACK_STATE.result);
  const [feedbackStatus, setFeedbackStatus] = useState(INITIAL_FEEDBACK_STATE.status);
  const [feedbackError,  setFeedbackError]  = useState(INITIAL_FEEDBACK_STATE.error);

  // ── 상태 초기화 헬퍼 ────────────────────────────────────────────────────────

  const resetCompare = () => {
    setCompareResult(null);
    setCompareStatus('idle');
    setCompareError('');
  };

  const resetFeedback = () => {
    setFeedbackResult(null);
    setFeedbackStatus('idle');
    setFeedbackError('');
  };

  // ── API 호출 ──────────────────────────────────────────────────────────────

  const runFeedback = useCallback(async (
    upload: UploadResponse,
    compare: CompareResponse,
  ) => {
    setFeedbackStatus('loading');
    setFeedbackError('');
    setFeedbackResult(null);

    try {
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_sec:  upload.duration_sec,
          pitch_summary: upload.summary,
          judgement:     compare.judgement,
          alignment:     compare.alignment,
          filename:      upload.filename,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'AI 피드백 요청 중 오류가 발생했습니다.' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data: FeedbackApiResponse = await res.json();
      setFeedbackResult(data.feedback);
      setFeedbackStatus('success');
    } catch (e) {
      setFeedbackStatus('error');
      setFeedbackError(getErrorMessage(e));
    }
  }, []);

  const runCompare = useCallback(async (upload: UploadResponse, demo: boolean) => {
    setCompareStatus('loading');
    setCompareError('');
    setCompareResult(null);
    resetFeedback();

    if (demo) {
      setCompareResult(DEMO_COMPARE);
      setCompareStatus('success');
      setFeedbackResult(DEMO_FEEDBACK);
      setFeedbackStatus('success');
      return;
    }

    try {
      const res = await fetch(COMPARE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_pitch:      upload.pitch,
          reference_pitch: referencePitch ?? [],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '비교 중 알 수 없는 오류가 발생했습니다.' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data: CompareResponse = await res.json();
      setCompareResult(data);
      setCompareStatus('success');
      await runFeedback(upload, data);
    } catch (e) {
      setCompareStatus('error');
      setCompareError(getErrorMessage(e));
    }
  }, [referencePitch, runFeedback]);

  // ── 이벤트 핸들러 ────────────────────────────────────────────────────────

  const handleSongSelect = (song: SongMeta, frames: ReferencePitchFrame[]) => {
    setSelectedSong(song);
    setReferencePitch(frames);
  };

  const handleUploadSuccess = (result: UploadResponse) => {
    setIsDemo(false);
    setAnalysisResult(result);
    resetCompare();
    resetFeedback();
  };

  const handleDemo = () => {
    setIsDemo(true);
    setAnalysisResult(DEMO_UPLOAD);
    resetCompare();
    resetFeedback();
  };

  const handleReset = () => {
    setIsDemo(false);
    setAnalysisResult(null);
    setRecordedAudioUrl(null);
    resetCompare();
    resetFeedback();
  };

  const handleRetryCompare  = () => analysisResult && runCompare(analysisResult, isDemo);
  const handleRetryFeedback = () => analysisResult && compareResult && runFeedback(analysisResult, compareResult);

  // 업로드 완료 시 자동 비교 시작
  useEffect(() => {
    if (!analysisResult) return;
    runCompare(analysisResult, isDemo);
  // runCompare는 analysisResult 변경 시에만 실행하면 되므로 의존성에서 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult]);

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 py-10">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-xl bg-white p-10 shadow-md">
        <h1 className="text-3xl font-bold">Sound-Learn</h1>
        <p className="text-center text-gray-600">
          노래를 녹음하여 음정과 박자를 분석해보세요.
        </p>

        {!analysisResult ? (
          /* ── 녹음 전 화면 ── */
          <>
            <SongSelector onSelect={handleSongSelect} />

            {selectedSong && (
              <div className="flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm">
                <span className="text-indigo-500">🎵</span>
                <span className="font-medium text-indigo-700">{selectedSong.title}</span>
                <span className="text-indigo-400">선택됨 — 이 곡을 따라 불러보세요</span>
              </div>
            )}

            <VoiceRecorder
              onUploadSuccess={handleUploadSuccess}
              onAudioReady={setRecordedAudioUrl}
            />

            <button
              onClick={handleDemo}
              className="text-xs text-zinc-400 underline transition-colors hover:text-zinc-600"
            >
              데모 데이터로 미리보기
            </button>
          </>
        ) : (
          /* ── 분석 결과 화면 ── */
          <div className="flex w-full flex-col gap-6">

            {/* 분석 요약 */}
            <AnalysisSummary
              durationSec={analysisResult.duration_sec}
              summary={analysisResult.summary}
            />

            {/* 핵심 지표 */}
            {compareResult && (
              <MetricsReport
                judgement={compareResult.judgement}
                pitchSummary={analysisResult.summary}
                durationSec={analysisResult.duration_sec}
              />
            )}

            {/* 비교 분석 */}
            {!isDemo && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">비교 분석</h2>
                    <p className="text-sm text-zinc-500">
                      {selectedSong ? `기준곡: ${selectedSong.title}` : '기준 melody와 음정을 비교합니다.'}
                    </p>
                    {compareResult?.detected_offset_sec != null && compareResult.detected_offset_sec > 1 && (
                      <p className="mt-0.5 text-xs text-indigo-500">
                        🔍 기준곡 {compareResult.detected_offset_sec.toFixed(1)}초 지점부터 매칭됨
                      </p>
                    )}
                  </div>
                  {compareStatus === 'loading' && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      비교 중...
                    </div>
                  )}
                </div>

                {compareStatus === 'success' && compareResult ? (
                  <CompareSummary
                    summary={compareResult.judgement}
                    phraseResults={compareResult.phrase_results}
                    audioUrl={recordedAudioUrl ?? undefined}
                  />
                ) : compareStatus === 'error' ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-600">비교 결과를 불러오지 못했습니다. {compareError}</p>
                    <button
                      onClick={handleRetryCompare}
                      className="w-fit rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                    >
                      비교 다시 시도
                    </button>
                  </div>
                ) : null}
              </section>
            )}

            {/* 피아노 롤 */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">피아노 롤</h2>
                  <p className="text-sm text-zinc-500">사용자 pitch와 기준 melody를 겹쳐서 보여줍니다.</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />사용자
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-4 bg-amber-500" />기준 melody
                  </div>
                </div>
              </div>
              <PianoRoll
                pitchData={analysisResult.pitch}
                referenceData={compareResult?.reference_pitch}
              />
            </section>

            {/* AI 피드백 */}
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">AI 피드백</h2>
                <p className="text-sm text-zinc-500">분석 결과를 바탕으로 AI가 피드백을 제공합니다.</p>
              </div>
              {feedbackStatus === 'loading' && <FeedbackLoading />}
              {feedbackStatus === 'success' && feedbackResult && (
                <FeedbackReport
                  feedback={feedbackResult}
                  phraseResults={compareResult?.phrase_results}
                  audioUrl={recordedAudioUrl ?? undefined}
                />
              )}
              {feedbackStatus === 'error' && (
                <FeedbackError message={feedbackError} onRetry={handleRetryFeedback} />
              )}
            </section>

            {/* 다시 녹음 */}
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
