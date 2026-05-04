# Step 4 Requirements - AI Feedback and Report

작성일: 2026-05-04
대상 단계: Step 4 - AI 피드백 및 리포트

## 1. 목표

Step 4의 목표는 Step 2/3에서 생성된 분석 결과를 사용자가 이해하기 쉬운 자연어 피드백과 리포트 UI로 제공하는 것이다.

현재 구현 상태:

- `/api/upload`: 녹음/업로드 오디오에서 pitch 데이터와 summary 생성
- `/api/compare`: 사용자 pitch와 기준 melody를 DTW로 정렬하고 cent 오차 및 정확도 계산
- 프론트 결과 화면: `AnalysisSummary`, `CompareSummary`, `PianoRoll` 표시

Step 4에서 추가할 핵심:

- 분석 결과를 AI 입력용 요약 데이터로 변환
- OpenAI API 기반 피드백 생성
- 피드백 결과 API 제공
- 프론트 리포트 UI 구현

## 2. 기능 요구사항

### 2.1 AI 피드백 생성 API

새 엔드포인트를 추가한다.

```http
POST /api/feedback
Content-Type: application/json
```

요청 데이터는 Step 3 비교 결과를 기반으로 한다.

필수 입력:

- `judgement`: `/api/compare`의 정확도 요약
- `alignment`: `/api/compare`의 정렬 프레임 목록
- `pitch_summary`: `/api/upload`의 음역대/감지 프레임 요약
- `duration_sec`: 녹음 길이

선택 입력:

- `filename`
- `reference_meta`
- `song_title`
- `practice_goal`

### 2.2 AI 입력 요약 생성

LLM에 전체 frame 배열을 그대로 보내지 않는다. 백엔드에서 먼저 요약한다.

요약에 포함할 항목:

- 전체 정확도
- 평균 cent 오차
- 최대 양수/음수 cent 오차
- 비교된 전체 프레임 수
- 정답/오답 프레임 수
- 음역대 최저/최고 MIDI
- 불안정 구간 top 3
- 사용자가 높게 부른 경향인지 낮게 부른 경향인지
- 피드백 우선순위

불안정 구간 기준:

- `is_correct == false`
- `abs(cent_error) > 100`
- 연속된 오답 frame을 시간 구간으로 묶기

### 2.3 AI 피드백 출력 구조

응답은 프론트에서 바로 렌더링할 수 있는 구조화 JSON이어야 한다.

```json
{
  "overall": "전체 총평",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "practice_tips": ["연습 방법 1", "연습 방법 2"],
  "focus_segments": [
    {
      "start_time": 1.2,
      "end_time": 2.0,
      "issue": "음정이 기준보다 낮음",
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

### 2.4 OpenAI 연동

백엔드 환경변수:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

기본 모델명은 설정 파일에서 관리한다. API key가 없으면 서버 시작은 가능해야 하며, `/api/feedback` 호출 시 명확한 오류를 반환한다.

예상 오류:

- API key 없음
- OpenAI API 호출 실패
- LLM 응답 JSON 파싱 실패
- 입력 alignment 없음

## 3. 백엔드 작업 범위

추가 파일 후보:

- `backend/api/feedback.py`
- `backend/core/feedback_generator.py`
- `backend/core/feedback_summary.py`

수정 파일:

- `backend/main.py`
- `backend/core/config.py`
- `backend/requirements.txt`

백엔드 구현 순서:

1. `FeedbackRequest`, `FeedbackResponse` Pydantic 모델 정의
2. Step 3 결과를 AI 입력용 summary로 변환하는 함수 작성
3. OpenAI 호출 함수 작성
4. LLM 응답 JSON 검증
5. `/api/feedback` 라우터 연결
6. 오류 응답 정리

## 4. 프론트엔드 작업 범위

추가 컴포넌트 후보:

- `frontend/components/report/FeedbackReport.tsx`
- `frontend/components/report/FeedbackLoading.tsx`
- `frontend/components/report/FeedbackError.tsx`
- `frontend/components/report/index.ts`
- `frontend/components/report/types.ts`

수정 파일:

- `frontend/app/page.tsx`
- 필요 시 `frontend/components/analysis/types.ts`

프론트 구현 순서:

1. `FeedbackResponse` 타입 정의
2. `compareResult` 생성 후 `/api/feedback` 자동 호출
3. 피드백 loading/error/success 상태 추가
4. 리포트 UI 렌더링
5. 재시도 버튼 추가

## 5. 화면 요구사항

결과 화면 구성:

1. 기본 분석 요약: `AnalysisSummary`
2. 비교 수치 요약: `CompareSummary`
3. 피아노롤: `PianoRoll`
4. AI 리포트: 신규 `FeedbackReport`

AI 리포트 표시 항목:

- 전체 총평
- 잘한 점
- 개선할 점
- 추천 연습 방법
- 집중 연습 구간

UI 상태:

- 피드백 생성 중
- 피드백 생성 성공
- 피드백 생성 실패
- API key 미설정
- 비교 결과 없음

## 6. 비기능 요구사항

- LLM에는 원본 오디오 파일을 보내지 않는다.
- LLM에는 필요한 요약 데이터만 전달한다.
- OpenAI API key는 프론트에 노출하지 않는다.
- 프론트는 `/api/feedback`만 호출한다.
- 피드백 생성 실패가 전체 분석 결과 화면을 깨뜨리면 안 된다.
- 입력 데이터가 너무 길 경우 백엔드에서 top error segment 중심으로 줄인다.

## 7. 완료 기준

Step 4 완료 기준:

- `/api/feedback`가 정상 응답을 반환한다.
- OpenAI API key 미설정 시 명확한 오류가 표시된다.
- 업로드 후 `/api/upload -> /api/compare -> /api/feedback` 흐름이 이어진다.
- 결과 화면에서 AI 총평과 연습 팁이 표시된다.
- 피드백 생성 실패 시 재시도할 수 있다.
- `npm run build` 또는 `npm run lint`에서 프론트 타입 오류가 없다.
- 백엔드 서버 실행 후 `/docs`에서 feedback API가 보인다.

## 8. 우선순위

Must Have:

- `/api/feedback`
- 분석 결과 요약 함수
- OpenAI API 호출
- 구조화된 JSON 응답
- 프론트 AI 리포트 카드

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

## 9. 다음 작업 프롬프트

```text
step4_requirements.md 기준으로 Step 4를 구현해줘.
진행할 때에는 plan을 세우고 모르는 부분과 결정하기 어려운 부분을 물어보면서 진행해.
```
