# Sound-Learn 프로젝트 문서

> 노래를 녹음하면 음정·박자를 분석하고 AI 피드백을 제공하는 웹 서비스

---

## 목차

1. [전체 구조 한눈에 보기](#1-전체-구조-한눈에-보기)
2. [데이터 흐름](#2-데이터-흐름)
3. [백엔드 파일별 역할](#3-백엔드-파일별-역할)
4. [프론트엔드 파일별 역할](#4-프론트엔드-파일별-역할)
5. [API 엔드포인트 목록](#5-api-엔드포인트-목록)
6. [핵심 알고리즘 요약](#6-핵심-알고리즘-요약)
7. [주요 타입 정의](#7-주요-타입-정의)

---

## 1. 전체 구조 한눈에 보기

```
Sound-learn/
├── backend/                 ← FastAPI 서버 (Python)
│   ├── main.py              ← 앱 진입점, 라우터 등록
│   ├── .env                 ← OPENAI_API_KEY 등 환경 변수
│   ├── requirements.txt     ← Python 패키지 목록
│   ├── api/                 ← HTTP 엔드포인트
│   │   ├── upload.py        ← POST /api/upload
│   │   ├── compare.py       ← POST /api/compare
│   │   ├── feedback.py      ← POST /api/feedback
│   │   └── songs.py         ← POST /api/songs/upload-reference
│   │                           POST /api/songs/youtube
│   └── core/                ← 비즈니스 로직 (엔드포인트에서 호출)
│       ├── config.py        ← 전역 상수 (샘플레이트, 허용 확장자 등)
│       ├── pitch_engine.py  ← 오디오 → pitch 추출 (librosa.pyin)
│       ├── aligner.py       ← DTW 정렬 알고리즘
│       ├── phrase_detector.py ← 소절 경계 감지
│       ├── feedback_summary.py ← 피드백용 데이터 전처리
│       └── feedback_generator.py ← OpenAI API 호출
│
└── frontend/                ← Next.js 앱 (TypeScript + Tailwind)
    ├── app/
    │   └── page.tsx         ← 메인 페이지 (상태 관리 허브)
    ├── components/
    │   ├── recorder/        ← 녹음·업로드 UI
    │   │   ├── VoiceRecorder.tsx
    │   │   └── WaveformVisualizer.tsx
    │   ├── analysis/        ← 분석 결과 UI
    │   │   ├── PianoRoll.tsx
    │   │   ├── AnalysisSummary.tsx
    │   │   └── CompareSummary.tsx
    │   ├── report/          ← 피드백 UI
    │   │   ├── FeedbackReport.tsx
    │   │   ├── FeedbackLoading.tsx
    │   │   ├── FeedbackError.tsx
    │   │   └── MetricsReport.tsx
    │   └── songs/           ← 기준곡 선택 UI
    │       └── SongSelector.tsx
    └── lib/
        └── demoData.ts      ← 데모용 더미 데이터
```

---

## 2. 데이터 흐름

### 전체 흐름

```
[사용자 녹음 / 파일 선택]
        ↓
[VoiceRecorder] ──WebM→WAV 변환──→ POST /api/upload
        ↓                                   ↓
[onAudioReady] ←── Blob URL         [pitch 추출 (pyin)]
        ↓                                   ↓
[recordedAudioUrl 저장]          [UploadResponse 반환]
                                            ↓
                              POST /api/compare
                        (user_pitch + reference_pitch)
                                            ↓
                              [Subsequence DTW 오프셋 탐색]
                              [DTW 프레임 정렬]
                              [소절 경계 감지]
                                            ↓
                              [CompareResponse 반환]
                                            ↓
                              POST /api/feedback
                                            ↓
                              [OpenAI GPT 피드백 생성]
                                            ↓
                              [FeedbackResponse 반환]
                                            ↓
                        [화면에 소절 카드 + AI 피드백 표시]
```

### 기준곡 로드 흐름

```
[SongSelector]
  ├── 파일 업로드 탭 → POST /api/songs/upload-reference
  │                         ↓ extract_pitch()
  │                   ReferencePitchFrame[] 반환
  │
  └── YouTube 탭 → POST /api/songs/youtube
                        ↓ yt-dlp 다운로드 → WAV 변환
                        ↓ extract_pitch()
                   ReferencePitchFrame[] 반환
```

---

## 3. 백엔드 파일별 역할

### `main.py` — 서버 진입점

| 역할 | 내용 |
|------|------|
| FastAPI 앱 생성 | `app = FastAPI(...)` |
| CORS 설정 | localhost:3000, 3001 허용 |
| 라우터 등록 | 4개 라우터를 `/api` prefix로 등록 |
| 헬스 체크 | `GET /` → `{"status": "ok"}` |

---

### `core/config.py` — 전역 상수

모든 모듈이 이 파일에서 상수를 가져온다. 수치를 바꾸려면 여기만 수정하면 된다.

| 상수 | 값 | 설명 |
|------|----|------|
| `SAMPLE_RATE` | 22050 | 오디오 정규화 샘플레이트 (Hz) |
| `HOP_LENGTH` | 512 | 프레임 간격 (≈ 23ms) |
| `FMIN` | 65.4 | 탐지 최저 주파수 (C2, 남성 저음) |
| `FMAX` | 1046.5 | 탐지 최고 주파수 (C6, 여성 고음) |
| `MAX_FILE_SIZE` | 50MB | 업로드 파일 최대 크기 |
| `OPENAI_MODEL` | gpt-4o-mini | 피드백 생성 모델 (환경 변수로 덮어쓰기 가능) |

---

### `core/pitch_engine.py` — Pitch 추출 엔진

오디오 파일을 받아 시간대별 주파수를 반환하는 핵심 모듈.

| 함수 | 역할 |
|------|------|
| `extract_pitch(file_path)` | 공개 진입점. 아래 내부 함수들을 순서대로 호출 |
| `_load_audio(file_path)` | librosa로 WAV를 22050Hz 모노로 로드 |
| `_run_pyin(y, sr)` | `librosa.pyin()`으로 f0(기본 주파수)와 voiced_flag 추출 |
| `_smooth_pitch(f0, voiced_flag)` | 노이즈 제거 — 단발 프레임 삭제/보간, 급격한 주파수 점프 필터링 |
| `_hz_to_midi(freq)` | Hz → MIDI 번호 변환 (공식: `69 + 12 × log2(f/440)`) |
| `_build_frames(f0, voiced_flag, sr)` | 최종 결과 딕셔너리 배열 생성 |

**`_smooth_pitch` 3단계 처리:**
1. 단발 유성 프레임 제거 — 전후가 모두 무성이면 노이즈로 간주
2. 단발 무성 프레임 보간 — 전후가 모두 유성이면 선형 보간
3. 주파수 점프 필터 — 인접 프레임 대비 ±6반음 초과 시 무성 처리

**반환 형식:**
```json
[
  {"time": 0.023, "frequency": 261.63, "midi_note": 60.0},
  {"time": 0.046, "frequency": null,   "midi_note": null}
]
```

---

### `core/aligner.py` — DTW 정렬 알고리즘

| 함수 | 역할 |
|------|------|
| `find_best_offset(user_notes, ref_notes, stride=5)` | **Subsequence DTW** — 레퍼런스에서 사용자 시퀀스가 가장 잘 맞는 구간을 찾아 `(start_idx, end_idx)` 반환 |
| `align_midi_sequences(user_notes, reference_notes)` | **일반 DTW** — 두 MIDI 시퀀스를 프레임 단위로 1:1 정렬해 경로 `[(user_idx, ref_idx), ...]` 반환 |
| `calculate_cent_error(user_freq, reference_freq)` | 두 주파수 사이의 cent 오차 반환 (양수=높게, 음수=낮게) |
| `midi_to_hz(midi_note)` | MIDI 번호 → Hz 변환 |

**DTW vs Subsequence DTW:**
- 일반 DTW: 두 시퀀스를 처음부터 끝까지 전부 비교
- Subsequence DTW: 레퍼런스 어디서든 시작 가능 → **사용자가 곡 중간부터 불러도 자동 매칭**
- 구현 차이: 첫 행을 0으로 초기화

---

### `core/phrase_detector.py` — 소절 감지

| 함수 | 역할 |
|------|------|
| `detect_phrases(frames, min_gap_sec=0.5, min_phrase_sec=3.0, max_phrase_sec=22.0)` | voiced frame 간 무성 구간(gap)으로 소절 경계를 감지해 소절 목록 반환 |
| `compute_phrase_results(alignment, phrases, good_threshold=70.0)` | alignment 결과를 소절 단위로 묶어 정확도·방향성 집계 |

**`detect_phrases` 4단계:**
1. voiced frame 간 gap ≥ 0.5초 → 소절 경계로 분리
2. 소절 길이 < 3초 → 다음 소절과 합침
3. 소절 길이 > 22초 → 균등 분할
4. 결과: `[{"index": 0, "start_time": 2.1, "end_time": 8.4}, ...]`

---

### `api/upload.py` — 오디오 업로드 엔드포인트

**`POST /api/upload`**

| 처리 단계 | 내용 |
|-----------|------|
| 검증 | 확장자(.wav/.mp3/.webm), 파일 크기 50MB |
| 리샘플링 | librosa로 22050Hz 모노 변환 |
| 저장 | UUID prefix로 임시 파일 저장 (`backend/temp/`) |
| 분석 | `extract_pitch()` 호출 후 임시 파일 삭제 |
| 반환 | `UploadResponse` (pitch 배열 + 음역대 요약) |

---

### `api/compare.py` — 비교 분석 엔드포인트

**`POST /api/compare`**

| 처리 단계 | 함수 |
|-----------|------|
| 무성음 제거 | `_only_voiced()` |
| 오프셋 탐색 | `find_best_offset()` |
| 프레임 정렬 | `align_midi_sequences()` |
| 오차 계산 | `calculate_cent_error()` |
| 소절 분석 | `detect_phrases()` + `compute_phrase_results()` |
| 통계 요약 | `_build_judgement()` |

---

### `api/songs.py` — 기준곡 로드 엔드포인트

| 엔드포인트 | 역할 |
|------------|------|
| `POST /api/songs/upload-reference` | 오디오 파일 업로드 → pitch 추출 |
| `POST /api/songs/youtube` | YouTube URL → yt-dlp 다운로드 → pitch 추출 |

- `_voiced_frames(raw)`: pitch 결과에서 `midi_note=None`인 무성 프레임 제거
- `_download_and_extract(url)`: yt-dlp + ffmpeg로 오디오 다운로드 후 pitch 추출 (동기 함수 → `run_in_executor`로 스레드 실행)

---

### `api/feedback.py` — AI 피드백 엔드포인트

**`POST /api/feedback`**

| 처리 단계 | 함수 |
|-----------|------|
| 입력 전처리 | `build_feedback_summary()` |
| AI 호출 | `generate_ai_feedback()` |

---

### `core/feedback_generator.py` — OpenAI 피드백 생성

| 함수/클래스 | 역할 |
|-------------|------|
| `generate_ai_feedback(summary)` | OpenAI API 호출 → JSON Schema 형식으로 피드백 반환 |
| `FeedbackResponse` | 피드백 응답 모델 (overall, strengths, improvements, practice_tips, score_label) |
| `FEEDBACK_JSON_SCHEMA` | GPT 응답 형식을 강제하는 JSON Schema |

- `score_label` 값: `excellent` / `good` / `needs_practice` / `poor`
- Structured Output(`json_schema`) 사용으로 응답 형식 보장

---

## 4. 프론트엔드 파일별 역할

### `app/page.tsx` — 메인 페이지 (상태 관리 허브)

모든 API 호출과 상태가 이 파일에서 관리된다. 자식 컴포넌트는 콜백을 통해 상태를 변경한다.

**상태 목록:**

| 상태 | 타입 | 설명 |
|------|------|------|
| `selectedSong` | `SongMeta \| null` | 선택된 기준곡 메타데이터 |
| `referencePitch` | `ReferencePitchFrame[] \| null` | 기준곡 pitch 배열 |
| `analysisResult` | `UploadResponse \| null` | 업로드 분석 결과 |
| `recordedAudioUrl` | `string \| null` | 녹음 Blob URL (소절 재생용) |
| `compareResult/Status/Error` | — | 비교 API 상태 |
| `feedbackResult/Status/Error` | — | 피드백 API 상태 |

**주요 함수:**

| 함수 | 역할 |
|------|------|
| `runCompare(upload, demo)` | `/api/compare` 호출 → 완료 후 자동으로 `runFeedback` 호출 |
| `runFeedback(upload, compare)` | `/api/feedback` 호출 |
| `handleUploadSuccess(result)` | 녹음 완료 콜백 → `analysisResult` 저장 |
| `handleSongSelect(song, frames)` | 기준곡 선택 콜백 |
| `handleDemo()` | 더미 데이터로 UI 채우기 |
| `handleReset()` | 전체 상태 초기화 |
| `handleRetryCompare/Feedback()` | 실패 시 재시도 |

**자동 실행 흐름 (useEffect):**
```
analysisResult 변경 → runCompare() 자동 실행
                            ↓ 완료 후
                       runFeedback() 자동 실행
```

---

### `components/recorder/VoiceRecorder.tsx` — 녹음·업로드 컴포넌트

| 함수 | 역할 |
|------|------|
| `startRecording()` | 마이크 권한 요청 → MediaRecorder 시작 → Web Audio AnalyserNode 연결 |
| `stopRecording()` | MediaRecorder 중지 → onstop에서 Blob 생성 → 업로드 |
| `uploadAudio(blob, filename)` | WebM이면 WAV 변환 → FormData로 `/api/upload` 전송 |
| `handleFileSelect(e)` | 파일 선택 시 Blob URL 생성 후 업로드 |
| `convertToWav(blob)` | Web Audio API로 WebM → WAV 변환 (FFmpeg 없이 브라우저에서 처리) |

**Props:**

| prop | 설명 |
|------|------|
| `onUploadSuccess(result)` | 업로드 완료 시 호출 |
| `onAudioReady(url)` | Blob URL 생성 시 호출 → 소절 재생에 사용 |

---

### `components/recorder/WaveformVisualizer.tsx` — 실시간 파형 시각화

- `analyserNode`를 받아 Canvas에 실시간 파형을 그림
- `requestAnimationFrame`으로 매 프레임 업데이트

---

### `components/songs/SongSelector.tsx` — 기준곡 선택

| 탭 | 처리 |
|----|------|
| 파일 업로드 | `<input type="file">` → FormData → `POST /api/songs/upload-reference` |
| YouTube | URL 입력 → JSON → `POST /api/songs/youtube` |

두 탭 모두 성공 시 `onSelect(song, frames)` 콜백으로 부모에 전달.

---

### `components/analysis/PianoRoll.tsx` — 피아노 롤 시각화

- Canvas에 사용자 pitch(파란 점)와 기준 melody(노란 선)를 겹쳐서 표시
- X축: 시간, Y축: MIDI 음정

---

### `components/analysis/AnalysisSummary.tsx` — 분석 요약 카드

- 녹음 길이, 음역대(최저/최고), 유성 비율 등 표시

---

### `components/analysis/CompareSummary.tsx` — 비교 분석 결과

| 함수/컴포넌트 | 역할 |
|---------------|------|
| `AccuracyBar` | 정확도(%)를 가로 막대 그래프로 표시 |
| `PhraseCard` | 소절 한 개의 분석 카드 (정확도, 방향성, 재생 버튼) |
| `CompareSummary` | 전체 수치 요약 + 소절별 카드 목록 |

**소절 재생 원리:**
```
▶ 클릭 → audio.currentTime = user_start_time → play()
         → timeupdate 이벤트로 user_end_time 도달 감시
         → 도달 시 pause() + onStop()
```

---

### `components/report/FeedbackReport.tsx` — AI 피드백 표시

| 섹션 | 내용 |
|------|------|
| 점수 배지 | `score_label` 기반 색상·이모지 표시 |
| 총평 | `feedback.overall` |
| 잘한 점 | `feedback.strengths[]` |
| 개선할 점 | `feedback.improvements[]` |
| 연습 방법 | `feedback.practice_tips[]` |
| 집중 연습 구간 | `is_good=false`인 소절 카드 (재생 버튼 포함) |

---

### `components/report/MetricsReport.tsx` — 핵심 지표 카드

- 정확도, 평균 음정 오차, 최대 박자 오차 등을 시각적으로 표시

---

### `components/report/FeedbackLoading.tsx` / `FeedbackError.tsx`

- `FeedbackLoading`: 스피너 + 로딩 메시지
- `FeedbackError`: 에러 메시지 + 재시도 버튼

---

### `lib/demoData.ts` — 더미 데이터

백엔드 없이 UI를 테스트할 때 사용. "데모 데이터로 미리보기" 버튼과 연결.

| 상수 | 대응 API |
|------|----------|
| `DEMO_UPLOAD` | `/api/upload` 응답 |
| `DEMO_COMPARE` | `/api/compare` 응답 |
| `DEMO_FEEDBACK` | `/api/feedback` 응답 |

---

## 5. API 엔드포인트 목록

| 메서드 | 경로 | 역할 | 입력 | 출력 |
|--------|------|------|------|------|
| GET | `/` | 헬스 체크 | — | `{"status": "ok"}` |
| POST | `/api/upload` | 사용자 오디오 분석 | multipart 파일 | `UploadResponse` |
| POST | `/api/compare` | 기준곡과 비교 | `{user_pitch, reference_pitch}` | `CompareResponse` |
| POST | `/api/feedback` | AI 피드백 생성 | 분석 데이터 | `FeedbackApiResponse` |
| POST | `/api/songs/upload-reference` | 기준곡 파일 업로드 | multipart 파일 | `ReferencePitchResponse` |
| POST | `/api/songs/youtube` | YouTube 기준곡 로드 | `{"url": "..."}` | `ReferencePitchResponse` |

---

## 6. 핵심 알고리즘 요약

### Pitch 추출 (pyin)

```
오디오 파일
    ↓ librosa.pyin()
f0 배열 (시간대별 주파수) + voiced_flag (유성/무성 여부)
    ↓ _smooth_pitch()
노이즈 제거 (단발 프레임, 급격한 점프 필터링)
    ↓ _build_frames()
[{"time": 0.023, "frequency": 261.63, "midi_note": 60.0}, ...]
```

### Subsequence DTW (자동 오프셋 탐색)

```
문제: 사용자가 레퍼런스 곡의 중간부터 불렀을 때
해결: DTW 행렬의 첫 행을 0으로 초기화
     → 레퍼런스 어디서든 시작 비용 0으로 출발 가능
결과: (start_idx, end_idx) — 레퍼런스에서 가장 잘 맞는 구간
최적화: stride=5 다운샘플링으로 행렬 크기 1/25로 축소
```

### 소절 감지 (phrase detection)

```
voiced frame 간 gap ≥ 0.5초 → 경계 설정
    ↓
소절 길이 < 3초 → 다음 소절과 합치기
소절 길이 > 22초 → 균등 분할
    ↓
소절별 정확도 집계 (accuracy_percent, direction, is_good)
```

---

## 7. 주요 타입 정의

### 백엔드 (Pydantic)

```python
# 한 프레임의 pitch 정보
class PitchFrame:
    time: float          # 시간 (초)
    frequency: float | None  # Hz (무성이면 None)
    midi_note: float | None  # MIDI 번호 (무성이면 None)

# 비교 결과 한 프레임
class AlignmentFrame:
    user_time: float          # 사용자 오디오 시간
    reference_time: float     # 레퍼런스 시간 (절대값)
    cent_error: float         # 음정 오차 (양수=높게, 음수=낮게)
    timing_error_sec: float   # 박자 오차
    is_correct: bool          # ±100 cent 이내면 True

# 소절 결과
class PhraseResult:
    index: int
    accuracy_percent: float
    direction: 'sharp' | 'flat' | 'mixed'
    is_good: bool             # accuracy >= 70%이면 True

# AI 피드백
class FeedbackResponse:
    overall: str              # 총평
    strengths: list[str]      # 잘한 점
    improvements: list[str]   # 개선할 점
    practice_tips: list[str]  # 연습 방법
    score_label: str          # excellent / good / needs_practice / poor
```

### 프론트엔드 (TypeScript)

```typescript
// components/analysis/types.ts
interface PhraseResult {
  index: number;
  ref_start_time: number;    // 레퍼런스 기준 소절 시작
  ref_end_time: number;
  user_start_time: number;   // 사용자 녹음 기준 소절 시작 (재생에 사용)
  user_end_time: number;
  accuracy_percent: number;
  avg_cent_error: number | null;
  direction: 'sharp' | 'flat' | 'mixed';
  is_good: boolean;
}

// components/recorder/types.ts
interface VoiceRecorderProps {
  onUploadSuccess?: (result: UploadResponse) => void;
  onAudioReady?: (url: string) => void;   // Blob URL 전달
  onUploadError?: (msg: string) => void;
}
```

---

## 환경 설정

### 백엔드 실행

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
# .env 파일에 OPENAI_API_KEY=sk-... 입력
uvicorn main:app --reload
```

### 프론트엔드 실행

```bash
cd frontend
npm install
# .env.local 파일에 NEXT_PUBLIC_API_URL=http://localhost:8000 입력
npm run dev
```

### 필수 외부 도구

| 도구 | 용도 | 설치 |
|------|------|------|
| ffmpeg | YouTube 오디오 변환 | https://ffmpeg.org/download.html |
| yt-dlp | YouTube 다운로드 | `pip install yt-dlp` |
| OpenAI API Key | AI 피드백 | https://platform.openai.com |
