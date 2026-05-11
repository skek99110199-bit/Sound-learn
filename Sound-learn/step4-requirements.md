# Step 4 요구사항: AI 피드백과 리포트

작성일: 2026-05-04  
대상 단계: Step 4, AI 피드백 및 리포트 UI

## 목표

Step 4의 목표는 Step 2/3에서 생성한 분석 결과를 사용자가 이해하기 쉬운 AI 피드백과 리포트 UI로 제공하는 것입니다.

현재 전제:

- `/api/upload`: 오디오에서 `pitch`와 `summary` 생성
- `/api/compare`: 사용자 피치와 기준 멜로디를 DTW로 정렬하고 정확도 계산
- 프론트엔드 결과 화면: `AnalysisSummary`, `CompareSummary`, `PianoRoll`

Step 4에서 추가할 핵심:

- 분석 결과를 AI 입력용 요약 데이터로 변환
- OpenAI API 기반 피드백 생성
- `/api/feedback` 제공
- 프론트엔드 리포트 UI 구현

## 기능 요구사항

### 1. AI 피드백 API

엔드포인트:

```http
POST /api/feedback
Content-Type: application/json
```

필수 입력:

| 필드 | 설명 |
| --- | --- |
| `duration_sec` | 녹음 길이 |
| `pitch_summary` | `/api/upload`의 `summary` |
| `judgement` | `/api/compare`의 정확도 요약 |
| `alignment` | `/api/compare`의 정렬 프레임 목록 |

선택 입력:

- `filename`
- `song_title`
- `practice_goal`

### 2. AI 입력 요약

LLM에 전체 frame 배열을 그대로 보내지 않습니다. 백엔드에서 먼저 요약합니다.

요약에 포함할 내용:

- 전체 정확도
- 평균 cent 오차
- 최대 양수/음수 cent 오차
- 비교된 전체 프레임 수
- 정답/오답 프레임 수
- 음역 최저/최고 MIDI
- 불안정 구간 top 3
- 높은 쪽으로 부르는 경향 또는 낮은 쪽으로 부르는 경향
- 우선 연습해야 할 항목

불안정 구간 기준:

- `is_correct == false`
- `abs(cent_error) > 100`
- 연속된 오답 frame을 시간 구간으로 묶음

### 3. AI 출력 구조

프론트엔드에서 바로 렌더링할 수 있도록 구조화된 JSON을 반환합니다.

```json
{
  "overall": "전체 총평",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선할 점 1", "개선할 점 2"],
  "practice_tips": ["연습 방법 1", "연습 방법 2"],
  "focus_segments": [
    {
      "start_time": 1.2,
      "end_time": 2.0,
      "issue": "피치가 기준보다 높음",
      "tip": "해당 구간을 천천히 반복 연습"
    }
  ],
  "score_label": "good"
}
```

`score_label` 후보:

- `excellent`
- `good`
- `needs_practice`
- `poor`

### 4. OpenAI 연동

백엔드 환경변수:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

요구사항:

- API key는 프론트엔드에 노출하지 않습니다.
- API key가 없어도 서버는 실행되어야 합니다.
- `/api/feedback` 호출 시 key가 없으면 명확한 오류를 반환합니다.
- LLM 응답이 JSON이 아니면 파싱 오류를 명확하게 처리합니다.

## 백엔드 작업 범위

추가 또는 확인할 파일:

- `backend/api/feedback.py`
- `backend/core/feedback_generator.py`
- `backend/core/feedback_summary.py`

수정 또는 확인할 파일:

- `backend/main.py`
- `backend/core/config.py`
- `backend/requirements.txt`

구현 순서:

1. `FeedbackRequest`, `FeedbackResponse` 모델 정의
2. Step 3 결과를 AI 입력 summary로 변환하는 함수 작성
3. OpenAI 호출 함수 작성
4. LLM 응답 JSON 검증
5. `/api/feedback` 라우터 연결
6. 오류 응답 정리

## 프론트엔드 작업 범위

추가 또는 확인할 파일:

- `frontend/components/report/FeedbackReport.tsx`
- `frontend/components/report/FeedbackLoading.tsx`
- `frontend/components/report/FeedbackError.tsx`
- `frontend/components/report/types.ts`
- `frontend/components/report/index.ts`

수정 또는 확인할 파일:

- `frontend/app/page.tsx`
- `frontend/components/analysis/types.ts`

구현 순서:

1. `FeedbackResponse` 타입 정의
2. `/api/compare` 성공 후 `/api/feedback` 자동 호출
3. loading/error/success 상태 추가
4. 리포트 UI 렌더링
5. 재시도 버튼 추가

## 화면 요구사항

결과 화면 구성:

1. 기본 분석 요약: `AnalysisSummary`
2. 비교 수치 요약: `CompareSummary`
3. Piano Roll: 사용자 pitch와 기준 melody
4. AI 리포트: `FeedbackReport`

AI 리포트 표시 항목:

- 전체 총평
- 잘한 점
- 개선할 점
- 추천 연습 방법
- 집중 연습 구간

상태:

- 피드백 생성 중
- 피드백 생성 성공
- 피드백 생성 실패
- API key 미설정
- 비교 결과 없음

## 비기능 요구사항

- 원본 오디오 파일은 LLM에 보내지 않습니다.
- 프론트엔드는 OpenAI API를 직접 호출하지 않습니다.
- 피드백 생성 실패가 전체 분석 결과 화면을 깨뜨리면 안 됩니다.
- 입력 데이터가 길면 백엔드에서 top error segment 중심으로 줄입니다.
- 응답 타입은 프론트엔드 타입과 일치해야 합니다.

## 완료 기준

- [x] `/api/feedback`가 정상 응답을 반환한다.
- [x] OpenAI API key 미설정 시 명확한 오류가 표시된다.
- [x] 업로드 후 `/api/upload -> /api/compare -> /api/feedback` 흐름이 이어진다.
- [x] 결과 화면에서 AI 총평과 연습 팁이 표시된다.
- [x] 피드백 생성 실패 시 재시도할 수 있다.
- [ ] `npm run build` 또는 `npm run lint`에서 프론트엔드 오류가 없다.
- [ ] 백엔드 `/docs`에서 feedback API가 보인다.

## 우선순위

Must Have:

- `/api/feedback`
- 분석 결과 요약 함수
- OpenAI API 호출
- 구조화된 JSON 응답
- 프론트엔드 AI 리포트 카드

Should Have:

- 불안정 구간 top 3
- 재시도 버튼
- API key 미설정 안내
- 피드백 로딩 UI

Nice to Have:

- 세션별 리포트 저장
- 리포트 이미지 캡처
- 이전 결과와 비교
- 추천 곡 기능

## 다음 작업 프롬프트

```text
step4-requirements.md 기준으로 Step 4를 구현해줘.
진행 중에는 plan을 세우고, 모르는 부분이나 결정하기 어려운 부분은 물어보면서 진행해줘.
```
