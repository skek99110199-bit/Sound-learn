import type { FeedbackReportProps } from './types';

const SCORE_CONFIG = {
  excellent: { label: '훌륭해요', emoji: '🌟', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  good:      { label: '잘했어요', emoji: '👍', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700'    },
  needs_practice: { label: '연습 필요', emoji: '💪', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  poor:      { label: '많은 연습 필요', emoji: '🎯', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
} as const;

export default function FeedbackReport({ feedback }: FeedbackReportProps) {
  const config = SCORE_CONFIG[feedback.score_label] ?? SCORE_CONFIG.good;

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
                <span className="mt-0.5 text-emerald-500">•</span>
                {item}
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
                <span className="mt-0.5 text-amber-500">•</span>
                {item}
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
                <span className="mt-0.5 text-blue-500">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 집중 연습 구간 */}
      {feedback.focus_segments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <span>🔍</span> 집중 연습 구간
          </h3>
          <div className="flex flex-col gap-2">
            {feedback.focus_segments.map((seg, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-700">
                    {seg.start_time.toFixed(1)}초 ~ {seg.end_time.toFixed(1)}초
                  </span>
                  <span className="text-xs text-zinc-400">{seg.issue}</span>
                </div>
                <p className="mt-1 text-zinc-500">{seg.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
