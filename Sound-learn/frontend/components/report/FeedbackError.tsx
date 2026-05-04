import type { FeedbackErrorProps } from './types';

export default function FeedbackError({ message, onRetry }: FeedbackErrorProps) {
  const isApiKeyError = message.includes('OPENAI_API_KEY');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="flex flex-col gap-1">
          <p className="font-medium text-red-700">AI 피드백을 불러올 수 없습니다</p>
          {isApiKeyError ? (
            <p className="text-sm text-red-600">
              OpenAI API 키가 설정되지 않았습니다. 백엔드 환경변수를 확인해주세요.
            </p>
          ) : (
            <p className="text-sm text-red-600">{message}</p>
          )}
        </div>
      </div>
      <div>
        <button
          onClick={onRetry}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
