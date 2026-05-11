'use client';

import { useEffect, useRef, useState } from 'react';
import type { PhraseResult } from '@/components/analysis';
import type { FeedbackReportProps } from './types';

const SCORE_CONFIG = {
  excellent:     { label: '훌륭해요',      emoji: '🌟', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  good:          { label: '잘했어요',      emoji: '👍', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700'    },
  needs_practice:{ label: '연습 필요',     emoji: '💪', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'  },
  poor:          { label: '많은 연습 필요', emoji: '🎯', bg: 'bg-red-50',    border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700'      },
} as const;

const DIRECTION_INFO = {
  sharp: { label: '♯ 높음', tip: '음정을 조금 낮춰 보세요.', color: 'text-red-600',  bar: 'bg-red-400'  },
  flat:  { label: '♭ 낮음', tip: '음정을 조금 높여 보세요.', color: 'text-blue-600', bar: 'bg-blue-400' },
  mixed: { label: '불안정',  tip: '음정 유지를 연습해 보세요.', color: 'text-amber-600', bar: 'bg-amber-400' },
};

// ── 소절 카드 (재생 포함) ─────────────────────────────────────────────────────

interface PhraseCardProps {
  result: PhraseResult;
  audioUrl?: string;
  currentlyPlaying: number | null;
  onPlay: (i: number) => void;
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
    if (isPlaying) { audioRef.current?.pause(); onStop(); return; }
    if (!audioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(audioUrl);
    const audio = audioRef.current;
    audio.currentTime = result.user_start_time;
    audio.play();
    onPlay(result.index);
    const check = () => {
      if (audio.currentTime >= result.user_end_time) {
        audio.pause(); onStop();
        audio.removeEventListener('timeupdate', check);
      }
    };
    audio.addEventListener('timeupdate', check);
    audio.onended = () => onStop();
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-700">{result.index + 1}소절</span>
          <span className={`text-xs font-semibold ${dir.color}`}>{dir.label}</span>
          {result.avg_cent_error !== null && (
            <span className="text-xs text-zinc-400">
              ({result.avg_cent_error > 0 ? '+' : ''}{result.avg_cent_error.toFixed(1)} cent)
            </span>
          )}
        </div>
        {/* 정확도 바 */}
        <div className="h-1.5 w-full rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${dir.bar}`}
            style={{ width: `${Math.min(100, result.accuracy_percent)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500">💡 {dir.tip}</p>
      </div>

      {audioUrl && (
        <button
          onClick={handleToggle}
          className={[
            'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            isPlaying
              ? 'bg-zinc-700 text-white hover:bg-zinc-800'
              : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100',
          ].join(' ')}
        >
          {isPlaying
            ? <><span className="h-2 w-2 rounded-sm bg-white" /> 정지</>
            : <><span>▶</span> 듣기</>}
        </button>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function FeedbackReport({ feedback, phraseResults, audioUrl }: FeedbackReportProps) {
  const config = SCORE_CONFIG[feedback.score_label] ?? SCORE_CONFIG.good;
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);

  // 개선이 필요한 소절만 필터링
  const badPhrases = phraseResults?.filter((p) => !p.is_good) ?? [];

  return (
    <div className={`flex flex-col gap-5 rounded-xl border p-6 ${config.bg} ${config.border}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎤</span>
          <h2 className="text-lg font-semibold text-zinc-900">AI 피드백</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${config.badge}`}>
          {config.emoji} {config.label}
        </span>
      </div>

      {/* 총평 */}
      <p className={`text-sm leading-relaxed ${config.text}`}>{feedback.overall}</p>

      {/* 잘한 점 */}
      {feedback.strengths.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <span>✅</span> 잘한 점
          </h3>
          <ul className="flex flex-col gap-1.5 pl-1">
            {feedback.strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-0.5 text-emerald-500">•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 개선할 점 */}
      {feedback.improvements.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <span>📈</span> 개선할 점
          </h3>
          <ul className="flex flex-col gap-1.5 pl-1">
            {feedback.improvements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-0.5 text-amber-500">•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 연습 팁 */}
      {feedback.practice_tips.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <span>💡</span> 연습 방법
          </h3>
          <ul className="flex flex-col gap-1.5 pl-1">
            {feedback.practice_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-0.5 text-blue-500">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 집중 연습 구간 — 소절 카드로 표시 */}
      {badPhrases.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <span>🎯</span> 집중 연습 구간
            {audioUrl && <span className="ml-1 text-xs font-normal text-zinc-400">▶ 눌러서 해당 소절 바로 듣기</span>}
          </h3>
          <div className="flex flex-col gap-2">
            {badPhrases.map((p) => (
              <PhraseCard
                key={p.index}
                result={p}
                audioUrl={audioUrl}
                currentlyPlaying={currentlyPlaying}
                onPlay={setCurrentlyPlaying}
                onStop={() => setCurrentlyPlaying(null)}
              />
            ))}
          </div>
        </div>
      )}

      {badPhrases.length === 0 && phraseResults && phraseResults.length > 0 && (
        <p className="text-sm text-emerald-600">🎉 모든 소절을 훌륭하게 불렀어요!</p>
      )}
    </div>
  );
}
