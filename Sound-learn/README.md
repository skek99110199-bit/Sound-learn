# Sound-Learn

Sound-Learn은 사용자의 노래 녹음 또는 오디오 파일을 분석해 기준 멜로디와 비교하고, 피치 정확도와 리듬 차이를 시각화한 뒤 AI 피드백을 제공하는 보컬 학습 앱입니다.

## 한 줄 요약

사용자가 노래를 부르면 앱이 피치를 추출하고 기준 멜로디와 비교해, 어디가 정확했고 어디를 연습해야 하는지 그래프와 AI 리포트로 보여줍니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | Next.js, React, TypeScript, Tailwind CSS |
| 백엔드 | Python, FastAPI |
| 오디오 분석 | librosa, numpy, soundfile |
| 비교 알고리즘 | DTW, cent 오차 계산 |
| AI 피드백 | OpenAI API |
| 데이터 형식 | WAV/MP3/WebM, JSON |

## 현재 앱 흐름

```text
사용자 녹음/파일 선택
        |
        v
프론트엔드 VoiceRecorder
        |
        v
POST /api/upload
        |
        v
오디오 정규화 + 피치 추출
        |
        v
AnalysisSummary + PianoRoll 표시
        |
        v
POST /api/compare
        |
        v
DTW 정렬 + cent 오차 + 정확도 계산
        |
        v
CompareSummary + 기준 멜로디 overlay
        |
        v
POST /api/feedback
        |
        v
AI 피드백 리포트 표시
```

## 주요 기능

### 1. 녹음과 업로드

- 브라우저 마이크 권한 요청
- 실시간 파형 표시
- 녹음 중지 후 자동 업로드
- WAV, MP3, WebM 파일 업로드 지원
- 최대 파일 크기 50MB 제한

### 2. 피치 분석

- 오디오를 22050Hz 모노 기준으로 정규화
- `librosa.pyin` 기반 피치 추출
- 약 23ms 간격의 프레임 데이터 생성
- 무성 구간은 `frequency`, `midi_note`를 `null`로 처리
- 이상치 제거와 짧은 무성 구간 보정

### 3. 분석 요약

백엔드는 `/api/upload` 응답에 다음 요약값을 포함합니다.

- `duration_sec`: 분석된 오디오 길이
- `voiced_frames`: 음성이 감지된 프레임 수
- `total_frames`: 전체 프레임 수
- `min_frequency`, `max_frequency`, `avg_frequency`
- `min_midi`, `max_midi`

### 4. 시각화

- `PianoRoll`에서 시간축과 MIDI 음높이를 기준으로 피치 표시
- 사용자 피치와 기준 멜로디를 함께 표시
- 무성 구간은 끊긴 구간으로 표현

### 5. 기준 멜로디 비교

- `/api/compare`에서 사용자 피치와 기준 멜로디를 비교
- DTW로 시간 차이를 보정
- cent 오차 계산
- `abs(cent_error) <= 100`이면 정답으로 판정
- 정확도, 평균 오차, 최대 양/음 오차를 요약

### 6. AI 피드백

- `/api/feedback`에서 비교 결과를 AI 입력용 요약 데이터로 변환
- 전체 오디오 파일은 AI에 보내지 않고 분석 요약만 전달
- 출력 항목:
  - 전체 총평
  - 잘한 점
  - 개선할 점
  - 추천 연습 방법
  - 집중 연습 구간
  - 점수 라벨

## 주요 API

### `POST /api/upload`

오디오 파일을 받아 피치를 추출합니다.

응답 핵심 필드:

```json
{
  "filename": "recording.wav",
  "duration_sec": 5.217,
  "original_sr": 44100,
  "normalized_sr": 22050,
  "pitch": [
    { "time": 0.023, "frequency": 220.0, "midi_note": 57.0 }
  ],
  "summary": {
    "voiced_frames": 180,
    "total_frames": 226,
    "min_frequency": 196.0,
    "max_frequency": 440.0,
    "min_midi": 55.0,
    "max_midi": 69.0,
    "avg_frequency": 287.42
  }
}
```

### `POST /api/compare`

사용자 피치와 기준 멜로디를 비교합니다.

응답 핵심 필드:

```json
{
  "alignment": [
    {
      "user_time": 0.0,
      "reference_time": 0.0,
      "user_midi": 69.0,
      "reference_midi": 69.0,
      "cent_error": 0.0,
      "is_correct": true
    }
  ],
  "judgement": {
    "correct_frames": 1,
    "total_compared_frames": 1,
    "accuracy_percent": 100.0,
    "avg_cent_error": 0.0
  }
}
```

### `POST /api/feedback`

분석과 비교 결과를 바탕으로 AI 피드백을 생성합니다.

응답 핵심 필드:

```json
{
  "feedback": {
    "overall": "전체 총평",
    "strengths": ["잘한 점"],
    "improvements": ["개선할 점"],
    "practice_tips": ["연습 방법"],
    "focus_segments": [
      {
        "start_time": 1.2,
        "end_time": 2.0,
        "issue": "문제 설명",
        "tip": "연습 팁"
      }
    ],
    "score_label": "good"
  }
}
```

## 프로젝트 구조

```text
Sound-learn/
  backend/
    main.py
    api/
      upload.py
      compare.py
      feedback.py
    core/
      pitch_engine.py
      aligner.py
      feedback_summary.py
      feedback_generator.py
      config.py
    tests/
      test_compare_api.py
  frontend/
    app/
      page.tsx
      layout.tsx
    components/
      recorder/
      analysis/
      report/
```

## 실행 방법

### 백엔드

```bash
cd Sound-learn/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

확인:

- API 문서: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`

### 프론트엔드

```bash
cd Sound-learn/frontend
npm install
npm run dev
```

접속:

```text
http://localhost:3000
```

## 환경변수

백엔드 AI 피드백을 사용하려면 `backend/.env`에 OpenAI 설정이 필요합니다.

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

API key가 없으면 `/api/feedback` 호출 시 명확한 오류가 반환되어야 합니다. 서버 자체는 실행 가능해야 합니다.

## Step 문서

| 문서 | 설명 |
| --- | --- |
| `step1-completion-report.md` | Step 1 완료 보고서 |
| `step2-completion-report.md` | Step 2 백엔드 완료 보고서 |
| `step2-change-summary.md` | Step 1 대비 Step 2 변경점 |
| `step3-frontend-handoff.md` | Step 3 프론트 인계 문서 |
| `step4-requirements.md` | Step 4 AI 피드백 요구사항 |
| `step4-meta-prompt.md` | Step 4 작업 프롬프트 |
| `step2-api-upload-spec.md` | `/api/upload` 명세 |
| `step3-api-compare-spec.md` | `/api/compare` 명세 |
| `roadmap-summary.md` | 하위 프로젝트용 로드맵 요약 |
| `backend/env-setup.md` | 백엔드 환경변수 설정 방법 |
