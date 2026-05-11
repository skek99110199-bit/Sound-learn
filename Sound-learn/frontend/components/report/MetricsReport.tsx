'use client';

import type { JudgementSummary, PitchSummary } from '@/components/analysis';
import { midiToLabelFull, octaveColor } from '@/components/analysis/noteUtils';

interface MetricsReportProps {
  judgement: JudgementSummary;
  pitchSummary: PitchSummary;
  durationSec: number;
}

function AccuracyRing({ percent }: { percent: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  const color =
    percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e4e4e7" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
        {percent.toFixed(0)}%
      </text>
    </svg>
  );
}

function MetricCard({
  label, value, sub, color = 'text-zinc-800',
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-400">{sub}</span>}
    </div>
  );
}

function timingGrade(avgMs: number | null): { label: string; color: string } {
  if (avgMs === null) return { label: '-', color: 'text-zinc-400' };
  if (avgMs < 80)  return { label: '매우 정확', color: 'text-emerald-600' };
  if (avgMs < 150) return { label: '양호', color: 'text-blue-600' };
  if (avgMs < 250) return { label: '보통', color: 'text-amber-600' };
  return { label: '연습 필요', color: 'text-red-500' };
}

export default function MetricsReport({ judgement, pitchSummary, durationSec }: MetricsReportProps) {
  const avgMs = judgement.avg_abs_timing_error_sec != null
    ? judgement.avg_abs_timing_error_sec * 1000
    : null;
  const timing = timingGrade(avgMs);

  const voiceRatio = pitchSummary.total_frames > 0
    ? Math.round((pitchSummary.voiced_frames / pitchSummary.total_frames) * 100)
    : 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">핵심 분석 지표</h2>
        <p className="text-sm text-zinc-500">Pitch Accuracy · Rhythmic Precision · Vocal Range</p>
      </div>

      {/* Pitch Accuracy */}
      <div className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-5">
        <AccuracyRing percent={judgement.accuracy_percent} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-zinc-700">음정 정확도 (Pitch Accuracy)</p>
          <p className="text-xs text-zinc-500">
            {judgement.correct_frames} / {judgement.total_compared_frames} 프레임 정답
          </p>
          <p className="text-xs text-zinc-500">
            평균 오차: {judgement.avg_cent_error != null
              ? `${judgement.avg_cent_error > 0 ? '+' : ''}${judgement.avg_cent_error.toFixed(1)} cent`
              : '-'}
            {judgement.avg_cent_error != null && Math.abs(judgement.avg_cent_error) > 20 && (
              <span className="ml-1 text-amber-500">
                ({judgement.avg_cent_error > 0 ? '♯ 높은 경향' : '♭ 낮은 경향'})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Rhythmic Precision + Vocal Range */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="박자 정밀도 (Rhythmic Precision)"
          value={avgMs != null ? `${avgMs.toFixed(0)}ms` : '-'}
          sub={timing.label}
          color={timing.color}
        />
        <MetricCard
          label="음성 감지율 (Voice Activity)"
          value={`${voiceRatio}%`}
          sub={`${pitchSummary.voiced_frames} / ${pitchSummary.total_frames} 프레임`}
          color={voiceRatio >= 70 ? 'text-emerald-600' : 'text-amber-600'}
        />
      </div>

      {/* Vocal Range */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-700">음역대 (Vocal Range)</p>
        {pitchSummary.min_midi != null && pitchSummary.max_midi != null ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xs text-zinc-400">최저음</span>
              <span
                className="text-base font-bold"
                style={{ color: octaveColor(pitchSummary.min_midi) }}
              >
                {midiToLabelFull(pitchSummary.min_midi)}
              </span>
            </div>
            {/* 범위 바 */}
            <div className="relative flex-1 rounded-full bg-zinc-100" style={{ height: 12 }}>
              {(() => {
                const totalRange = 48; // 4옥타브 기준
                const baseNote = 48;  // C3
                const minPct = Math.max(0, ((pitchSummary.min_midi - baseNote) / totalRange) * 100);
                const maxPct = Math.min(100, ((pitchSummary.max_midi - baseNote) / totalRange) * 100);
                return (
                  <div
                    className="absolute top-0 h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400"
                    style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
                  />
                );
              })()}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-zinc-400">최고음</span>
              <span
                className="text-base font-bold"
                style={{ color: octaveColor(pitchSummary.max_midi) }}
              >
                {midiToLabelFull(pitchSummary.max_midi)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">음역대 데이터가 없습니다.</p>
        )}
        <p className="mt-2 text-xs text-zinc-400">
          녹음 길이: {durationSec.toFixed(1)}초
        </p>
      </div>
    </div>
  );
}
