'use client';

import type { AnalysisSummaryProps } from './types';
import { midiToLabelFull, octaveColor } from './noteUtils';

export default function AnalysisSummary({ durationSec, summary }: AnalysisSummaryProps) {
  const { voiced_frames, total_frames, min_midi, max_midi, avg_frequency } = summary;

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {/* 녹음 길이 */}
      <div className="flex flex-col items-center p-3 bg-zinc-50 rounded-lg border border-zinc-200">
        <span className="text-xs text-zinc-500">녹음 길이</span>
        <span className="text-sm font-semibold text-zinc-800 mt-1">
          {durationSec.toFixed(1)}초
        </span>
      </div>

      {/* 감지된 음 */}
      <div className="flex flex-col items-center p-3 bg-zinc-50 rounded-lg border border-zinc-200">
        <span className="text-xs text-zinc-500">감지된 음</span>
        <span className="text-sm font-semibold text-zinc-800 mt-1">
          {voiced_frames} / {total_frames} 프레임
        </span>
      </div>

      {/* 음역 범위 — 옥타브별 색상 */}
      <div className="flex flex-col items-center p-3 bg-zinc-50 rounded-lg border border-zinc-200">
        <span className="text-xs text-zinc-500">음역 범위</span>
        {min_midi !== null && max_midi !== null ? (
          <span className="text-sm font-semibold mt-1 flex items-center gap-1">
            <span style={{ color: octaveColor(min_midi) }}>
              {midiToLabelFull(min_midi)}
            </span>
            <span className="text-zinc-400">~</span>
            <span style={{ color: octaveColor(max_midi) }}>
              {midiToLabelFull(max_midi)}
            </span>
          </span>
        ) : (
          <span className="text-sm font-semibold text-zinc-800 mt-1">-</span>
        )}
      </div>
    </div>
  );
}
