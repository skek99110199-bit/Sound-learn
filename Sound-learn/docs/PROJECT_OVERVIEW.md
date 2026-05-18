# Sound-Learn — 프로젝트 전체 요약

## 한 줄 설명

노래를 녹음하거나 파일을 업로드하면 **음정 정확도·박자·소절별 피드백을 실시간으로 분석**하고, AI(OpenAI)가 한국어로 연습 조언을 제공하는 웹 애플리케이션.

---

## 시스템 구성

```
Sound-Learn/
├── backend/          FastAPI (Python 3.12+)
│   ├── api/          REST 엔드포인트 4개
│   └── core/         오디오·피치 분석 엔진
└── frontend/         Next.js (TypeScript)
    ├── app/          페이지 (단일 SPA)
    └── components/   기능별 UI 컴포넌트 4개 그룹
```

**통신 방식**: 프론트엔드 → 백엔드 REST API (JSON + multipart/form-data)  
**상태 관리**: React `useState` + `useEffect` (별도 상태 라이브러리 없음)

---

## 핵심 사용자 흐름

```
1. 기준곡 선택  →  파일 업로드 또는 YouTube URL 입력
   POST /api/songs/upload-reference  또는  POST /api/songs/youtube
   → reference_pitch (MIDI 프레임 배열) 저장

2. 내 목소리 녹음 / 파일 업로드
   POST /api/upload
   → pitch 프레임 + 요약 통계 반환 (UploadResponse)

3. 음정 비교 (자동 실행)
   POST /api/compare
   → DTW 정렬 + 소절별 분석 (CompareResponse)

4. AI 피드백 생성 (자동 실행)
   POST /api/feedback
   → OpenAI gpt-4o-mini → 한국어 총평 + 연습 팁 (FeedbackResponse)

5. 결과 화면 표시
   AnalysisSummary / MetricsReport / CompareSummary / PianoRoll / FeedbackReport
```

---

## 기술 스택

| 레이어 | 기술 | 주요 역할 |
|--------|------|-----------|
| 백엔드 프레임워크 | FastAPI 0.111+ | REST API, Pydantic 유효성 검사 |
| 오디오 분석 | librosa 0.10+ | pyin 알고리즘 기반 피치 추출 |
| 피치 비교 | 순수 Python DTW | Subsequence DTW + 전체 DTW |
| AI 피드백 | OpenAI SDK 1.99+ | gpt-4o-mini, Structured Outputs |
| MIDI 처리 | mido | MIDI 파일 → PitchFrame 변환 |
| YouTube | yt-dlp | 오디오 다운로드 → WAV 변환 |
| 프론트엔드 | Next.js (App Router) + TypeScript | SPA, 서버 컴포넌트 없음 (전부 `'use client'`) |
| 시각화 | Canvas API | PianoRoll 직접 렌더링 |
| 스타일 | Tailwind CSS | 유틸리티 클래스 |

---

## 환경 변수

```bash
# backend/.env
OPENAI_API_KEY=sk-...          # 필수 (없으면 /api/feedback에서 503 반환)
OPENAI_MODEL=gpt-4o-mini       # 선택 (기본값 gpt-4o-mini)

# frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000   # 선택 (기본값 localhost:8000)
```

---

## 로컬 실행

```bash
# 백엔드
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 프론트엔드
cd frontend
npm install
npm run dev
```

백엔드 Swagger UI: `http://localhost:8000/docs`  
프론트엔드: `http://localhost:3000`
