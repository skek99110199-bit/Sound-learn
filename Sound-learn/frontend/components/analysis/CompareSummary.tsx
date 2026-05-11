'use client';

import { useEffect, useRef, useState } from 'react';
import type { JudgementSummary, PhraseResult } from './types';

interface CompareSummaryProps {
  summary: JudgementSummary;
  phraseResults?: PhraseResult[];
  audioUrl?: string;
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function formatCent(value: number | null): string {
  if (value === null) return '-';
  const r = Math.round(value * 10) / 10;
  return `${r > 0 ? '+' : ''}${r.toFixed(1)} cent`;
}

function formatSec(value: number | null): string {
  if (value === null) return '-';
  return `${(value * 1000).toFixed(0)}ms`;
}

// ── 소절 카드 ─────────────────────────────────────────────────────────────────

const DIRECTION_INFO = {
  sharp: { label: '♯ 높음', tip: '음정을 조금 낮춰 보세요.', color: 'text-red-600' },
  flat:  { label: '♭ 낮음', tip: '음정을 조금 높여 보세요.', color: 'text-blue-600' },
  mixed: { label: '불안정', tip: '음정 유지를 연습해 보세요.', color: 'text-amber-600' },
};

function AccuracyBar({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? 'bg-emerald-400' :
    percent >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-200">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

interface PhraseCardProps {
  result: PhraseResult;
  audioUrl?: string;
  currentlyPlaying: number | null;
  onPlay: (index: number) => void;
  onStop: () => void;
}

function PhraseCard({ result, audioUrl, currentlyPlaying, onPlay, onStop }: PhraseCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = currentlyPlaying === result.index;
  const dir = DIRECTION_INFO[result.direction];

  useEffect(() => {
    if (!isPlaying) audioRef.current?.pause();
  }, [isPlaying]);

  const handleToggle = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      onStop();
      return;
    }
    if (!audioUrl) return;

    if (!audioRef.current) audioRef.current = new Audio(audioUrl);
    const audio = audioRef.current;
    audio.currentTime = result.user_start_time;
    audio.play();
    onPlay(result.index);

    const check = () => {
      if (audio.currentTime >= result.user_end_time) {
        audio.pause();
        onStop();
        audio.removeEventListener('timeupdate', check);
      }
    };
    audio.addEventListener('timeupdate', check);
    audio.onended = () => onStop();
  };

  const borderColor =
    result.is_good
      ? 'border-emerald-200 bg-emerald-50'
      : result.accuracy_percent >= 60
        ? 'border-amber-200 bg-amber-50'
        : 'border-red-200 bg-red-50';

  return (
    <div className={`rounded-xl border p-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        {/* 왼쪽: 소절 번호 + 정확도 */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-700">
              {result.index + 1}소절
            </span>
            <span className={`text-xs font-semibold ${
              result.is_good ? 'text-emerald-600' :
              result.accuracy_percent >= 60 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {result.accuracy_percent.toFixed(0)}%
            </span>
            {result.is_good && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                ✓ 잘했어요
              </span>
            )}
          </div>

          <AccuracyBar percent={result.accuracy_percent} />

          {/* 개선점 (잘못했을 때만 표시) */}
          {!result.is_good && (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-zinc-600">
                <span className={`font-semibold ${dir.color}`}>{dir.label}</span>
                {result.avg_cent_error !== null && (
                  <span className="ml-1 text-zinc-400">
                    (평균 {formatCent(result.avg_cent_error)})
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">💡 {dir.tip}</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 재생 버튼 */}
        {audioUrl && (
          <button
            onClick={handleToggle}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              isPlaying
                ? 'bg-zinc-700 text-white hover:bg-zinc-800'
                : 'border border-zinc-300 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50',
            ].join(' ')}
          >
            {isPlaying ? (
              <><span className="h-2 w-2 rounded-sm bg-white" /> 정지</>
            ) : (
              <><span>▶</span> 듣기</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function CompareSummary({ summary, phraseResults, audioUrl }: CompareSummaryProps) {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);

  const metrics = [
    { label: '전체 정확도',   value: `${summary.accuracy_percent.toFixed(1)}%`, tone: 'text-emerald-600' },
    { label: '정답 프레임',   value: `${summary.correct_frames} / ${summary.total_compared_frames}`, tone: 'text-zinc-800' },
    { label: '평균 음정 오차', value: formatCent(summary.avg_cent_error), tone: 'text-zinc-800' },
    { label: '평균 박자 오차', value: formatSec(summary.avg_abs_timing_error_sec), tone: 'text-zinc-800' },
  ];

  const goodCount = phraseResults?.filter((p) => p.is_good).length ?? 0;
  const totalCount = phraseResults?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 전체 수치 요약 */}
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <span className="text-xs text-zinc-500">{m.label}</span>
            <span className={`mt-1 text-sm font-semibold ${m.tone}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* 소절별 결과 */}
      {phraseResults && phraseResults.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">
              소절별 분석 ({goodCount}/{totalCount} 소절 통과)
            </p>
            {audioUrl && (
              <p className="text-xs text-indigo-400">▶ 버튼으로 해당 구간을 바로 들어보세요</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {phraseResults.map((result) => (
              <PhraseCard
                key={result.index}
                result={result}
                audioUrl={audioUrl}
                currentlyPlaying={currentlyPlaying}
                onPlay={setCurrentlyPlaying}
                onStop={() => setCurrentlyPlaying(null)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
