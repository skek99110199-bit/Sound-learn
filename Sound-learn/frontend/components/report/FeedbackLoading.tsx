export default function FeedbackLoading() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full bg-zinc-200" />
        <div className="h-5 w-32 rounded bg-zinc-200" />
      </div>
      <div className="h-4 w-full rounded bg-zinc-100" />
      <div className="h-4 w-4/5 rounded bg-zinc-100" />
      <div className="mt-2 flex flex-col gap-2">
        <div className="h-4 w-24 rounded bg-zinc-200" />
        <div className="h-4 w-3/5 rounded bg-zinc-100" />
        <div className="h-4 w-2/5 rounded bg-zinc-100" />
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <div className="h-4 w-24 rounded bg-zinc-200" />
        <div className="h-4 w-3/4 rounded bg-zinc-100" />
      </div>
      <p className="text-center text-sm text-zinc-400">AI 피드백 생성 중...</p>
    </div>
  );
}
