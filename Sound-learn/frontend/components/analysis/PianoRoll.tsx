'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PianoRollProps, PitchFrame } from './types';
import { isC, midiToLabelFull, midiToLabelShort, octaveColor } from './noteUtils';

const BG_COLOR = '#f4f4f5'; // zinc-100
const GRID_COLOR = '#e4e4e7'; // zinc-200
const GRID_C_COLOR = '#d4d4d8'; // zinc-300
const PITCH_COLOR = '#6366f1'; // indigo-500
const REFERENCE_COLOR = '#f59e0b'; // amber-500
const PITCH_POINT_R = 2.5;
const REFERENCE_POINT_R = 2;
const PADDING = { top: 20, right: 20, bottom: 30, left: 62 };

type TooltipState = {
  x: number;
  y: number;
  frame: PitchFrame;
  source: 'user' | 'reference';
};

export default function PianoRoll({
  pitchData,
  referenceData = [],
  width = 800,
  height = 300,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const voicedFrames = pitchData.filter(
    (frame): frame is PitchFrame & { midi_note: number; frequency: number } =>
      frame.midi_note !== null && frame.frequency !== null,
  );
  const voicedReferenceFrames = referenceData.filter(
    (frame): frame is PitchFrame & { midi_note: number } => frame.midi_note !== null,
  );

  const allMidiFrames = [...voicedFrames, ...voicedReferenceFrames];
  const allFrames = [...pitchData, ...referenceData];

  const minMidi = allMidiFrames.length > 0
    ? Math.floor(Math.min(...allMidiFrames.map((frame) => frame.midi_note))) - 2
    : 58;
  const maxMidi = allMidiFrames.length > 0
    ? Math.ceil(Math.max(...allMidiFrames.map((frame) => frame.midi_note))) + 2
    : 72;
  const maxTime = allFrames.length > 0
    ? Math.max(...allFrames.map((frame) => frame.time), 1)
    : 1;

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  const toX = useCallback(
    (time: number) => PADDING.left + (time / maxTime) * plotW,
    [maxTime, plotW],
  );
  const toY = useCallback(
    (midi: number) => PADDING.top + plotH - ((midi - minMidi) / (maxMidi - minMidi)) * plotH,
    [minMidi, maxMidi, plotH],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let midi = Math.ceil(minMidi); midi <= Math.floor(maxMidi); midi++) {
      const y = toY(midi);
      const isCNote = isC(midi);

      ctx.strokeStyle = isCNote ? GRID_C_COLOR : GRID_COLOR;
      ctx.lineWidth = isCNote ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();

      if (isCNote || midi % 5 === 0) {
        ctx.fillStyle = octaveColor(midi);
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(midiToLabelShort(midi), PADDING.left - 6, y);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#71717a';
    ctx.font = '10px monospace';

    const timeStep = maxTime <= 5 ? 0.5 : maxTime <= 15 ? 1 : maxTime <= 60 ? 5 : 10;
    for (let time = 0; time <= maxTime; time += timeStep) {
      const x = toX(time);
      ctx.fillText(`${time.toFixed(1)}s`, x, height - PADDING.bottom + 8);

      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, height - PADDING.bottom);
      ctx.stroke();
    }

    if (voicedReferenceFrames.length > 0) {
      ctx.strokeStyle = REFERENCE_COLOR;
      ctx.fillStyle = REFERENCE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);

      let prevReference: PitchFrame | null = null;
      for (const frame of referenceData) {
        if (frame.midi_note === null) {
          prevReference = null;
          continue;
        }

        const x = toX(frame.time);
        const y = toY(frame.midi_note);

        ctx.beginPath();
        ctx.arc(x, y, REFERENCE_POINT_R, 0, Math.PI * 2);
        ctx.fill();

        if (prevReference && prevReference.midi_note !== null) {
          ctx.beginPath();
          ctx.moveTo(toX(prevReference.time), toY(prevReference.midi_note));
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        prevReference = frame;
      }

      ctx.setLineDash([]);
    }

    if (voicedFrames.length === 0) return;

    ctx.strokeStyle = PITCH_COLOR;
    ctx.fillStyle = PITCH_COLOR;
    ctx.lineWidth = 1.5;

    let prevVoiced = false;
    for (let i = 0; i < pitchData.length; i++) {
      const frame = pitchData[i];
      if (frame.midi_note === null || frame.frequency === null) {
        prevVoiced = false;
        continue;
      }

      const x = toX(frame.time);
      const y = toY(frame.midi_note);

      ctx.beginPath();
      ctx.arc(x, y, PITCH_POINT_R, 0, Math.PI * 2);
      ctx.fill();

      if (prevVoiced && i > 0) {
        const prev = pitchData[i - 1];
        if (prev.midi_note !== null) {
          ctx.beginPath();
          ctx.moveTo(toX(prev.time), toY(prev.midi_note));
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }

      prevVoiced = true;
    }
  }, [
    height,
    maxMidi,
    maxTime,
    minMidi,
    pitchData,
    plotH,
    plotW,
    referenceData,
    toX,
    toY,
    voicedFrames,
    voicedReferenceFrames,
    width,
  ]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const tooltipCandidates = [
      ...pitchData.map((frame) => ({ frame, source: 'user' as const })),
      ...referenceData.map((frame) => ({ frame, source: 'reference' as const })),
    ];
    if (!canvas || tooltipCandidates.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseTime = ((mouseX - PADDING.left) / plotW) * maxTime;

    let closest: { frame: PitchFrame; source: 'user' | 'reference' } | null = null;
    let closestDist = Infinity;

    for (const candidate of tooltipCandidates) {
      const dist = Math.abs(candidate.frame.time - mouseTime);
      if (dist < closestDist) {
        closest = candidate;
        closestDist = dist;
      }
    }

    if (closest && closestDist < maxTime * 0.02) {
      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        frame: closest.frame,
        source: closest.source,
      });
      return;
    }

    setTooltip(null);
  };

  const handleMouseLeave = () => setTooltip(null);

  if (voicedFrames.length === 0 && voicedReferenceFrames.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg"
        style={{ width, height, background: BG_COLOR }}
      >
        <p className="text-sm text-zinc-400">감지된 음이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full rounded-lg"
        style={{ background: BG_COLOR }}
        role="img"
        aria-label="피치 분석 피아노 롤"
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute rounded bg-zinc-800 px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className={tooltip.source === 'reference' ? 'text-amber-300' : 'text-indigo-300'}>
            {tooltip.source === 'reference' ? '기준 melody' : '사용자 pitch'}
          </div>
          <div>{tooltip.frame.time.toFixed(3)}초</div>
          {tooltip.frame.frequency !== null ? (
            <>
              <div>{tooltip.frame.frequency.toFixed(1)} Hz</div>
              <div style={{ color: octaveColor(tooltip.frame.midi_note!) }}>
                {midiToLabelFull(tooltip.frame.midi_note!)}
              </div>
            </>
          ) : tooltip.frame.midi_note !== null ? (
            <div style={{ color: octaveColor(tooltip.frame.midi_note) }}>
              {midiToLabelFull(tooltip.frame.midi_note)}
            </div>
          ) : (
            <div className="text-zinc-400">무성 구간</div>
          )}
        </div>
      )}
    </div>
  );
}
