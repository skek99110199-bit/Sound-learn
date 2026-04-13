'use client';

import type { JudgementSummary } from './types';

interface CompareSummaryProps {
  summary: JudgementSummary;
}

function formatCent(value: number | null): string {
  if (value === null) return '-';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} cent`;
}

export default function CompareSummary({ summary }: CompareSummaryProps) {
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
      label: '평균 오차',
      value: formatCent(summary.avg_cent_error),
      tone: 'text-zinc-800',
    },
    {
      label: '최대 오차',
      value: `${formatCent(summary.max_negative_cent_error)} / ${formatCent(summary.max_positive_cent_error)}`,
      tone: 'text-zinc-800',
    },
  ];

  return (
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
  );
}
