# 📌 프로젝트 상세 설계: # Sound-learn

사용자 가창 음성을 AI로 분석하여 원곡(MIDI)과 비교하고, 시각적 가이드와 개인화된 피드백을 제공하는 웹 기반 보컬 분석 서비스입니다.

---

# 1. 개요 스냅샷

| 항목         | 내용                                                                 |
| ---------- | ------------------------------------------------------------------ |
| 언어 / 프레임워크 | TypeScript · React (Next.js) / Python (FastAPI)                    |
| 핵심 라이브러리   | Librosa, CREPE (Pitch Extraction), Tone.js (Audio Playback)        |
| 데이터 형식     | Audio (WAV/MP3), MIDI (Reference Standard), JSON (Analysis Result) |
| AI 모델      | OpenAI GPT-4o (Feedback), CREPE (Pitch Tracking)                   |
| 핵심 지표      | Pitch Accuracy, Rhythmic Precision, Vocal Range                    |
| 진입점        | app/page.tsx (Frontend) / main.py (Backend API)                    |

---

# 2. 디렉터리 구조

```
melody-project/
├── frontend/ (Next.js)
│   ├── components/
│   │   ├── recorder/         # 녹음 및 파형 표시
│   │   ├── visualization/    # Piano Roll 렌더러
│   │   └── report/           # AI 피드백 및 통계 UI
│   ├── hooks/                # useAudioAnalyzer 등
│   └── store/                # 상태 관리 (Zustand/Recoil)
└── backend/ (FastAPI)
    ├── api/
    │   ├── upload.py         # 파일 수신
    │   ├── analysis.py       # Pitch 추출 및 비교
    │   └── feedback.py       # AI 피드백 생성
    ├── core/
    │   ├── pitch_engine.py   # 음정 추출
    │   └── aligner.py        # DTW 정렬
    └── models/
        └── midis/            # 기준 곡 데이터
```

---

# 3. 시스템 아키텍처

```
[사용자 가창] → [Frontend UI]
        ↓
    (파일 업로드)
        ↓
[Backend API]
        ↓
 ┌──────────────────────────────┐
 │        AI 분석 엔진           │
 │                              │
 │ Pitch Engine → 주파수 추출    │
 │ Aligner → 시간 정렬 (DTW)     │
 │ LLM Agent → 피드백 생성       │
 └──────────────────────────────┘
        ↓
   (JSON 결과 반환)
        ↓
[Frontend 결과 대시보드]
        ↓
Piano Roll 시각화
```

---

# 4. 핵심 모듈 상세

## 4.1 Pitch Engine (음정 추출)

* CREPE 기반 딥러닝 모델 사용
* 노이즈 환경에서도 안정적인 주파수 추출

### 음계 변환 공식

```
P = 69 + 12 × log2(f / 440)
```

---

## 4.2 Aligner (박자 보정)

* Dynamic Time Warping (DTW) 사용
* 사용자와 원곡의 시간 차이 보정

### 필요성

* 박자 차이를 보정하지 않으면 정상 음정도 오답 처리됨

---

## 4.3 AI Feedback Generator

### 데이터 예시

* 평균 음정 오차
* 고음 이탈률
* 박자 정확도

### 처리 방식

* 분석 데이터를 프롬프트로 변환
* “보컬 트레이너” 페르소나 적용

---

# 5. 단계별 로드맵

## Step 1 (1~2주)

* Pitch 추출 구현
* 파일 업로드 기능

## Step 2 (3~4주)

* Piano Roll 시각화 구현
* Canvas 기반 그래프

## Step 3 (5주)

* DTW 적용
* 음정 비교 정확도 개선

## Step 4 (6주)

* AI 피드백 기능 추가
* 분석 리포트 UI 구현

## Step 5 (7~8주)

* 성능 최적화
* 배포 (Vercel / AWS)

---

# 6. 기대 기능

| 기능       | 설명             |
| -------- | -------------- |
| 다이내믹 피드백 | 특정 구간 음정 오류 분석 |
| 음역대 체크   | 개인 음역 분석       |
| 비포 & 애프터 | 연습 전후 비교       |
| 공유 기능    | 결과 이미지 저장 및 공유 |

---

# 👍 한 줄 요약

노래를 데이터로 분석하고, 시각화하며, AI가 개선 방향까지 알려주는 보컬 피드백 웹 서비스
