'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PianoRollProps, PitchFrame } from './types';
import { isC, midiToLabelShort, midiToLabelFull, octaveColor } from './noteUtils';

const BG_COLOR = '#f4f4f5';       // zinc-100
const GRID_COLOR = '#e4e4e7';     // zinc-200
const GRID_C_COLOR = '#d4d4d8';   // zinc-300 (도 음계 강조)
const PITCH_COLOR = '#6366f1';    // indigo-500
const PITCH_POINT_R = 2.5;
const PADDING = { top: 20, right: 20, bottom: 30, left: 62 };

export default function PianoRoll({ pitchData, width = 800, height = 300 }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    frame: PitchFrame;
  } | null>(null);

  const voicedFrames = pitchData.filter(
    (f): f is PitchFrame & { midi_note: number; frequency: number } =>
      f.midi_note !== null && f.frequency !== null,
  );

  const minMidi = voicedFrames.length > 0
    ? Math.floor(Math.min(...voicedFrames.map((f) => f.midi_note))) - 2
    : 58;
  const maxMidi = voicedFrames.length > 0
    ? Math.ceil(Math.max(...voicedFrames.map((f) => f.midi_note))) + 2
    : 72;
  const maxTime = pitchData.length > 0
    ? pitchData[pitchData.length - 1].time
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

    // 배경
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Y축 그리드 — MIDI 노트별 수평선
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

      // 도(C) 음계와 5의 배수 MIDI만 라벨 표시 — 옥타브별 색상
      if (isCNote || midi % 5 === 0) {
        ctx.fillStyle = octaveColor(midi);
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(midiToLabelShort(midi), PADDING.left - 6, y);
      }
    }

    // X축 시간 라벨
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#71717a'; // zinc-500
    ctx.font = '10px monospace';

    const timeStep = maxTime <= 5 ? 0.5 : maxTime <= 15 ? 1 : maxTime <= 60 ? 5 : 10;
    for (let t = 0; t <= maxTime; t += timeStep) {
      const x = toX(t);
      ctx.fillText(`${t.toFixed(1)}s`, x, height - PADDING.bottom + 8);

      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, height - PADDING.bottom);
      ctx.stroke();
    }

    // 피치 데이터 렌더링
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

      // 점 그리기
      ctx.beginPath();
      ctx.arc(x, y, PITCH_POINT_R, 0, Math.PI * 2);
      ctx.fill();

      // 이전 유성 프레임과 연결선
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
  }, [pitchData, voicedFrames, width, height, minMidi, maxMidi, maxTime, plotW, plotH, toX, toY]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || pitchData.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;

      const mouseTime = ((mouseX - PADDING.left) / plotW) * maxTime;
      let closest: PitchFrame | null = null;
      let closestDist = Infinity;

      for (const frame of pitchData) {
        const dist = Math.abs(frame.time - mouseTime);
        if (dist < closestDist) {
          closestDist = dist;
          closest = frame;
        }
      }

      if (closest && closestDist < maxTime * 0.02) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          frame: closest,
        });
      } else {
        setTooltip(null);
      }
    },
    [pitchData, width, plotW, maxTime],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (voicedFrames.length === 0) {
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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-zinc-800 text-white text-xs rounded px-2 py-1 shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div>{tooltip.frame.time.toFixed(3)}초</div>
          {tooltip.frame.frequency !== null ? (
            <>
              <div>{tooltip.frame.frequency.toFixed(1)} Hz</div>
              <div
                style={{ color: octaveColor(tooltip.frame.midi_note!) }}
              >
                {midiToLabelFull(tooltip.frame.midi_note!)}
              </div>
            </>
          ) : (
            <div className="text-zinc-400">무성 구간</div>
          )}
        </div>
      )}
    </div>
  );
}
