'use client';

import type { JudgementSummary, ErrorSegment } from './types';

interface CompareSummaryProps {
  summary: JudgementSummary;
  errorSegments?: ErrorSegment[];
}

function formatCent(value: number | null): string {
  if (value === null) return '-';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} cent`;
}

function formatSec(value: number | null): string {
  if (value === null) return '-';
  return `${(value * 1000).toFixed(0)}ms`;
}

const DIRECTION_LABEL: Record<ErrorSegment['direction'], { text: string; color: string }> = {
  sharp: { text: '높음', color: 'text-red-500' },
  flat:  { text: '낮음', color: 'text-blue-500' },
  mixed: { text: '혼합', color: 'text-zinc-500' },
};

export default function CompareSummary({ summary, errorSegments }: CompareSummaryProps) {
  const metrics = [
    {
      label: '정확도',
      value: `${summary.accuracy_percent.toFixed(1)}%`,
      tone: 'text-emerald-600',
    },
    {
      label: '정답 프레임',
      value: `${summary.correct_frames} / ${summary.total_compared_frames}`,
      tone: 'text-zinc-800',
    },
    {
      label: '평균 음정 오차',
      value: formatCent(summary.avg_cent_error),
      tone: 'text-zinc-800',
    },
    {
      label: '평균 박자 오차',
      value: formatSec(summary.avg_abs_timing_error_sec),
      tone: 'text-zinc-800',
    },
  ];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 수치 요약 카드 */}
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <span className="text-xs text-zinc-500">{metric.label}</span>
            <span className={`mt-1 text-sm font-semibold ${metric.tone}`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {/* 오답 구간 목록 */}
      {errorSegments && errorSegments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-500">
            불안정 구간 ({errorSegments.length}곳)
          </p>
          <div className="flex flex-col gap-1.5">
            {errorSegments.map((seg, i) => {
              const dir = DIRECTION_LABEL[seg.direction];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm"
                >
                  <span className="text-zinc-600">
                    {seg.start_time.toFixed(2)}초 ~ {seg.end_time.toFixed(2)}초
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${dir.color}`}>{dir.text}</span>
                    <span className="text-zinc-400">
                      최대 {seg.max_abs_cent_error.toFixed(0)} cent
                    </span>
                    <span className="text-zinc-300">|</span>
                    <span className="text-zinc-400">{seg.frame_count}프레임</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
