# Step 4 메타 프롬프트: AI 피드백과 리포트

작성일: 2026-05-04  
대상: 프론트엔드 + 백엔드 담당자  
목표: Step 3 비교 결과를 바탕으로 AI가 자연어 피드백을 생성하고, 프론트엔드에서 리포트 UI로 표시합니다.

## 현재 프로젝트 상태

### 백엔드 완료 항목

- `POST /api/upload`
  - 오디오 업로드
  - 피치 추출
  - 무성 구간 처리
  - 요약 통계 반환

- `POST /api/compare`
  - DTW 정렬
  - cent 오차 계산
  - `100 cent` 기준 정확도 판정
  - 비교 결과 summary 반환

### 프론트엔드 완료 항목

- `VoiceRecorder`
  - 녹음
  - 파일 업로드
  - 업로드 상태 표시

- `AnalysisSummary`
  - 녹음 길이
  - 감지 프레임 수
  - 음역 범위

- `PianoRoll`
  - 사용자 pitch 표시
  - 기준 pitch overlay

- `CompareSummary`
  - 정확도
  - 평균 cent 오차
  - 정답/오답 프레임 수

## Step 4에서 사용할 핵심 데이터

### `JudgementSummary`

```typescript
{
  correct_frames: number;
  total_compared_frames: number;
  accuracy_percent: number;
  avg_cent_error: number | null;
  max_positive_cent_error: number | null;
  max_negative_cent_error: number | null;
}
```

### `PitchSummary`

```typescript
{
  voiced_frames: number;
  total_frames: number;
  min_frequency: number | null;
  max_frequency: number | null;
  min_midi: number | null;
  max_midi: number | null;
  avg_frequency: number | null;
}
```

### `AlignmentFrame`

```typescript
{
  user_time: number;
  reference_time: number;
  user_midi: number;
  reference_midi: number;
  user_frequency: number;
  reference_frequency: number;
  cent_error: number;
  is_correct: boolean;
}
```

## 백엔드 구현 목표

1. `POST /api/feedback` 엔드포인트를 제공합니다.
2. `JudgementSummary`, `PitchSummary`, `AlignmentFrame[]`를 입력으로 받습니다.
3. 전체 frame을 그대로 AI에 보내지 않고 요약 데이터로 변환합니다.
4. OpenAI API를 호출해 구조화된 JSON 피드백을 생성합니다.
5. 오류 상황에서는 명확한 HTTP 오류를 반환합니다.

## 프론트엔드 구현 목표

1. `/api/compare` 성공 후 `/api/feedback`를 자동 호출합니다.
2. 피드백 생성 중 loading UI를 표시합니다.
3. 실패 시 error UI와 재시도 버튼을 표시합니다.
4. 성공 시 `FeedbackReport`에서 AI 피드백을 표시합니다.

## `/api/feedback` 요청 예시

```json
{
  "duration_sec": 5.21,
  "pitch_summary": {
    "voiced_frames": 26,
    "total_frames": 30,
    "min_frequency": 220.0,
    "max_frequency": 440.0,
    "min_midi": 57.0,
    "max_midi": 69.0,
    "avg_frequency": 330.5
  },
  "judgement": {
    "correct_frames": 18,
    "total_compared_frames": 25,
    "accuracy_percent": 72.0,
    "avg_cent_error": -45.2,
    "max_positive_cent_error": 80.0,
    "max_negative_cent_error": -150.0
  },
  "alignment": [
    {
      "user_time": 0.0,
      "reference_time": 0.0,
      "user_midi": 68.5,
      "reference_midi": 69.0,
      "user_frequency": 427.47,
      "reference_frequency": 440.0,
      "cent_error": -50.0,
      "is_correct": true
    }
  ],
  "filename": "recording.wav"
}
```

## `/api/feedback` 응답 예시

```json
{
  "input_summary": {},
  "feedback": {
    "overall": "전체적으로 기준 멜로디를 따라가고 있지만 일부 구간에서 낮게 부르는 경향이 있습니다.",
    "strengths": ["중간 음역에서 피치가 안정적입니다."],
    "improvements": ["고음으로 올라가는 구간에서 음정이 낮아지는 경향이 있습니다."],
    "practice_tips": ["문제가 되는 구간만 느린 속도로 반복 연습하세요."],
    "focus_segments": [
      {
        "start_time": 1.2,
        "end_time": 2.0,
        "issue": "기준보다 낮게 부른 구간",
        "tip": "첫 음을 기준보다 약간 높게 잡는 느낌으로 연습하세요."
      }
    ],
    "score_label": "good"
  }
}
```

## 백엔드 작업 순서

1. `backend/core/feedback_summary.py`에서 AI 입력 summary를 만듭니다.
2. `backend/core/feedback_generator.py`에서 OpenAI 호출과 JSON 검증을 처리합니다.
3. `backend/api/feedback.py`에서 요청/응답 모델과 라우터를 정의합니다.
4. `backend/main.py`에 feedback router를 등록합니다.
5. `backend/core/config.py`에서 `OPENAI_API_KEY`, `OPENAI_MODEL`을 관리합니다.

## 프론트엔드 작업 순서

1. `frontend/components/report/types.ts`에 응답 타입을 정의합니다.
2. `FeedbackLoading`, `FeedbackError`, `FeedbackReport`를 구현합니다.
3. `frontend/app/page.tsx`에서 compare 성공 후 feedback을 호출합니다.
4. 성공/실패/재시도 상태를 화면에 연결합니다.

## 주의사항

- OpenAI API key는 절대 프론트엔드에 노출하지 않습니다.
- 원본 오디오 파일은 AI에 보내지 않습니다.
- AI 응답은 반드시 구조화된 JSON으로 검증합니다.
- 피드백 생성 실패가 분석 요약과 Piano Roll 표시를 깨뜨리면 안 됩니다.
- 데모 모드는 백엔드 없이도 더미 피드백을 표시할 수 있습니다.

## 검증 시나리오

1. 실제 녹음 후 `/api/upload -> /api/compare -> /api/feedback` 흐름이 동작합니다.
2. OpenAI API key가 없을 때 명확한 오류 UI가 표시됩니다.
3. AI 응답 파싱 실패 시 서버가 503 오류를 반환합니다.
4. 데모 버튼 클릭 시 더미 분석과 더미 피드백이 표시됩니다.
5. 재시도 버튼으로 피드백 생성을 다시 시도할 수 있습니다.

## 작업 프롬프트

```text
step4-meta-prompt.md와 step4-requirements.md를 기준으로 Step 4를 구현해줘.
진행 중에는 plan을 세우고, 모르는 부분이나 결정하기 어려운 부분은 물어보면서 진행해줘.
```
