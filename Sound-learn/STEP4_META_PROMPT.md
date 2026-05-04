# Step 4 메타 프롬프트 — AI 피드백 및 리포트

**작성일:** 2026-05-04  
**대상:** 프론트엔드 + 백엔드 담당자  
**목표:** Step 3 비교 결과(JudgementSummary)를 기반으로 Claude AI가 자연어 피드백을 생성하고, 프론트에서 리포트 UI로 표시한다

---

## 현재 프로젝트 상태 (Step 3 완료 기준)

### 백엔드 완료 항목
- `POST /api/upload` — 음성 업로드 + 피치 추출 + 스무딩 + 통계 반환
- `POST /api/compare` — DTW 정렬 + cent 오차 계산 + 정확도 판정

### 프론트엔드 완료 항목
- VoiceRecorder (녹음 + 파일 업로드)
- PianoRoll (user pitch + reference pitch 오버레이, 한국어 음계)
- AnalysisSummary (녹음 길이, 음역, 유성 프레임 수)
- CompareSummary (정확도%, avg cent error, 정답/오답 프레임 수)

### Step 4에서 사용할 핵심 데이터 (이미 있음)
```typescript
// JudgementSummary — compare API 응답
{
  correct_frames: number,
  total_compared_frames: number,
  accuracy_percent: number,        // 예: 72.5
  avg_cent_error: number | null,   // 예: -45.2 (음이 낮은 경향)
  max_positive_cent_error: number | null,
  max_negative_cent_error: number | null,
}

// PitchSummary — upload API 응답
{
  voiced_frames: number,
  total_frames: number,
  min_midi: number | null,   // 예: 57.0 (A3)
  max_midi: number | null,   // 예: 72.0 (C5)
  avg_frequency: number | null,
}
```

---

## Step 4 목표

### 백엔드
1. `POST /api/feedback` 엔드포인트 신규 생성
2. 요청: JudgementSummary + PitchSummary JSON
3. Claude API(Anthropic) 호출로 자연어 피드백 생성
4. 응답: 피드백 텍스트 + 구조화된 평가 항목

### 프론트엔드
1. compare 완료 후 자동으로 `/api/feedback` 호출
2. FeedbackCard 컴포넌트 — AI 피드백 텍스트 표시
3. 로딩 중 스켈레톤 UI
4. 에러 시 재시도 버튼

---

## 백엔드 구현 명세

### 파일 구조
```
backend/
├── api/
│   ├── upload.py     (기존)
│   ├── compare.py    (기존)
│   └── feedback.py   ← 신규
├── core/
│   ├── config.py     (ANTHROPIC_API_KEY 추가)
│   └── feedback_prompt.py  ← 신규 (프롬프트 템플릿)
```

### 요청 명세 (`POST /api/feedback`)
```json
{
  "judgement": {
    "correct_frames": 18,
    "total_compared_frames": 25,
    "accuracy_percent": 72.0,
    "avg_cent_error": -45.2,
    "max_positive_cent_error": 80.0,
    "max_negative_cent_error": -150.0
  },
  "pitch_summary": {
    "voiced_frames": 26,
    "total_frames": 30,
    "min_midi": 57.0,
    "max_midi": 72.0,
    "avg_frequency": 330.5
  }
}
```

### 응답 명세
```json
{
  "overall_comment": "전반적으로 음정이 약간 낮은 경향이 있습니다.",
  "accuracy_grade": "B",
  "strengths": ["음역대가 안정적입니다", "고음 구간에서 음정 유지가 좋습니다"],
  "improvements": ["전반적으로 약 45cent 낮게 부르는 경향이 있습니다"],
  "practice_tip": "노래 시작 전 기준음을 충분히 듣고 시작해보세요."
}
```

### 평가 등급 기준
| 정확도 | 등급 |
|--------|------|
| 90% 이상 | S |
| 80~89% | A |
| 70~79% | B |
| 60~69% | C |
| 60% 미만 | D |

### Claude API 프롬프트 설계 원칙
- 역할: "전문 보컬 트레이너"
- 언어: 한국어, 친근하고 격려하는 톤
- avg_cent_error > 0 → "음이 높은 경향"
- avg_cent_error < 0 → "음이 낮은 경향"
- avg_cent_error가 null → 비교 데이터 부족 언급
- 음역대(min_midi, max_midi)로 사용자 성종 유추해서 언급
- 응답은 반드시 위 JSON 형식으로 반환 (JSON mode 또는 structured output)

### 환경변수 추가
```
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 프론트엔드 구현 명세

### 파일 구조
```
frontend/
└── components/
    └── analysis/
        ├── FeedbackCard.tsx   ← 신규
        └── index.ts           (FeedbackCard export 추가)
```

### FeedbackCard Props
```typescript
interface FeedbackCardProps {
  feedback: FeedbackResponse;
}

interface FeedbackResponse {
  overall_comment: string;
  accuracy_grade: string;
  strengths: string[];
  improvements: string[];
  practice_tip: string;
}
```

### UI 구성
```
┌─────────────────────────────────┐
│  🎤 AI 피드백                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  종합 등급: B                    │
│  전반적으로 음정이 낮은 경향...   │
│                                  │
│  ✅ 잘한 점                      │
│  • 음역대가 안정적입니다           │
│                                  │
│  📈 개선할 점                     │
│  • 약 45cent 낮게 부르는 경향...   │
│                                  │
│  💡 연습 팁                       │
│  노래 시작 전 기준음을...          │
└─────────────────────────────────┘
```

### page.tsx 흐름 변경
```
녹음 → upload → compare → feedback (자동 순차 호출)
                            ↓
                    FeedbackCard 표시
```

---

## 작업 순서

### 백엔드 (먼저)
1. `pip install anthropic` → requirements.txt 추가
2. `core/config.py`에 `ANTHROPIC_API_KEY` 환경변수 로드 추가
3. `core/feedback_prompt.py` — 프롬프트 빌더 함수 작성
4. `api/feedback.py` — 엔드포인트 + Claude API 호출
5. `main.py`에 feedback 라우터 등록
6. `backend/.env` 파일 생성 (gitignore에 추가)

### 프론트엔드 (백엔드 완료 후)
1. `components/analysis/types.ts`에 `FeedbackResponse` 타입 추가
2. `components/analysis/FeedbackCard.tsx` 컴포넌트 작성
3. `components/analysis/index.ts`에 export 추가
4. `app/page.tsx` — compare 완료 후 feedback 자동 호출 + FeedbackCard 렌더링

---

## 주의사항

- `ANTHROPIC_API_KEY`는 절대 git에 커밋하지 않는다 (`.gitignore`에 `.env` 추가 확인)
- Claude API 호출 실패 시 HTTP 503 반환 + 프론트에서 "AI 피드백을 불러올 수 없습니다" 표시
- 데모 모드(더미 데이터)에서는 feedback API 호출 생략 or 더미 피드백 표시
- API 응답이 JSON 형식이 아닐 경우 파싱 에러 처리 필수

---

## 검증 시나리오

1. 실제 녹음 → upload → compare → feedback 전체 플로우 동작
2. Claude API 키 없을 때 503 에러 + 프론트 에러 UI 표시
3. accuracy_percent가 각 등급 경계값일 때 등급 올바르게 표시
4. 데모 버튼 클릭 시 feedback API 호출 안 함 (더미 피드백 표시)
