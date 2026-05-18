# Sound-Learn — 주요 파일/폴더별 역할

## 디렉토리 트리

```
Sound-Learn/
├── backend/
│   ├── main.py                       FastAPI 앱 진입점, 라우터 등록
│   ├── requirements.txt              Python 의존성
│   ├── .env                          환경변수 (OPENAI_API_KEY 등, git 제외)
│   ├── env-setup.md                  .env 설정 가이드
│   ├── api/
│   │   ├── upload.py                 POST /api/upload
│   │   ├── compare.py                POST /api/compare
│   │   ├── feedback.py               POST /api/feedback
│   │   └── songs.py                  POST /api/songs/upload-reference, /youtube
│   ├── core/
│   │   ├── config.py                 전역 상수 (샘플레이트, 허용 확장자, CORS 등)
│   │   ├── pitch_engine.py           pyin 기반 피치 추출 엔진
│   │   ├── aligner.py                DTW 정렬 알고리즘
│   │   ├── phrase_detector.py        소절 경계 감지 + 소절별 집계
│   │   ├── feedback_summary.py       비교 결과 → AI 입력 요약 변환
│   │   ├── feedback_generator.py     OpenAI 호출 + 응답 검증
│   │   └── midi_parser.py            MIDI 파일 → PitchFrame 리스트
│   ├── songs/
│   │   ├── butterfly.mid             내장 MIDI 기준곡 (나비야)
│   │   ├── school_bell.mid           내장 MIDI 기준곡 (학교종)
│   │   └── twinkle.mid               내장 MIDI 기준곡 (반짝반짝)
│   ├── temp/
│   │   └── .gitkeep                  업로드 임시 저장소 (분석 후 즉시 삭제)
│   └── tests/
│       └── test_compare_api.py       /api/compare 통합 테스트
│
└── frontend/
    ├── app/
    │   ├── page.tsx                  메인 페이지 (단일 SPA, 전체 상태 관리)
    │   ├── layout.tsx                HTML 루트 레이아웃, 폰트 설정
    │   └── globals.css               Tailwind 베이스 스타일
    ├── components/
    │   ├── songs/
    │   │   ├── SongSelector.tsx      기준곡 선택 UI (파일 업로드 / YouTube 탭)
    │   │   ├── types.ts              SongMeta, ReferencePitchFrame, SongSelectorProps
    │   │   └── index.ts              barrel export
    │   ├── recorder/
    │   │   ├── VoiceRecorder.tsx     마이크 녹음, 파일 업로드, WAV 변환, /api/upload 호출
    │   │   ├── WaveformVisualizer.tsx Canvas 기반 실시간 파형 표시
    │   │   ├── types.ts              RecordingState, UploadResponse, VoiceRecorderProps
    │   │   └── index.ts              barrel export
    │   ├── analysis/
    │   │   ├── PianoRoll.tsx         Canvas MIDI×시간 시각화 (사용자 + 기준 멜로디)
    │   │   ├── AnalysisSummary.tsx   업로드 결과 요약 카드 (길이, voiced 비율 등)
    │   │   ├── CompareSummary.tsx    비교 수치 요약 + 소절별 카드 + 구간 재생
    │   │   ├── noteUtils.ts          MIDI → 한국어 음계 변환, 옥타브 색상
    │   │   ├── types.ts              PitchFrame, AlignmentFrame, JudgementSummary, PhraseResult, CompareResponse
    │   │   └── index.ts              barrel export
    │   └── report/
    │       ├── MetricsReport.tsx     정확도 원형 게이지 + 박자 정밀도 + 음역대 바
    │       ├── FeedbackReport.tsx    AI 피드백 카드 (총평/잘한점/개선점/연습팁/집중구간)
    │       ├── FeedbackLoading.tsx   피드백 로딩 스피너 UI
    │       ├── FeedbackError.tsx     피드백 오류 + 재시도 버튼 UI
    │       ├── types.ts              FeedbackResponse, FeedbackApiResponse, FeedbackReportProps
    │       └── index.ts              barrel export
    └── lib/
        └── demoData.ts               백엔드 없이 UI 테스트용 더미 데이터
```

---

## 파일별 핵심 내용

### `backend/main.py`

- FastAPI 앱 생성, CORS 설정(`CORS_ORIGINS`), 4개 라우터 등록
- `load_dotenv(Path(__file__).parent / ".env")` — 앱 시작 시 .env 자동 로드
- `GET /` → `{"status": "ok"}` 헬스체크

### `backend/core/config.py`

전체 프로젝트의 단일 진실 공급원(single source of truth).

| 상수 | 값 | 의미 |
|------|-----|------|
| `SAMPLE_RATE` | 22050 | 정규화 샘플레이트 (Hz) |
| `HOP_LENGTH` | 512 | 프레임 간격 ≈ 23ms |
| `FMIN` | 65.4 | C2, 남성 최저음 |
| `FMAX` | 1046.5 | C6, 여성 고음 |
| `ALLOWED_EXTENSIONS` | .wav .mp3 .webm | 업로드 허용 형식 |
| `MAX_FILE_SIZE` | 50MB | 업로드 크기 제한 |
| `TEMP_DIR` | `backend/temp/` | 임시 저장 경로 |
| `CORS_ORIGINS` | localhost:3000/3001 | 허용 출처 |
| `OPENAI_MODEL` | `gpt-4o-mini` (env 오버라이드 가능) | AI 피드백 모델 |

### `backend/api/upload.py`

- `UploadResponse` Pydantic 모델: `filename`, `duration_sec`, `original_sr`, `normalized_sr`, `pitch[]`, `summary`
- `PitchSummary`: voiced_frames, total_frames, min/max/avg frequency, min/max MIDI
- 파일을 `{uuid}.wav`로 temp 저장 → 분석 → `finally` 블록에서 반드시 삭제

### `backend/api/compare.py`

- `CENT_TOLERANCE = 100.0` — ±100 cent 이내 정답
- `CompareResponse`: user_pitch, reference_pitch, alignment[], judgement, phrase_results[], detected_offset_sec
- `_only_voiced()`: midi_note가 None인 프레임 제거
- `_resolve_frequency()`: frequency 없으면 midi_note → Hz 변환
- `_build_judgement()`: alignment 리스트에서 JudgementSummary 집계

### `backend/api/feedback.py`

- `FeedbackRequest`: duration_sec, pitch_summary, judgement, alignment[], (선택) filename, song_title, practice_goal
- `FeedbackApiResponse`: `{ input_summary, feedback }` — input_summary는 LLM에 보낸 요약 데이터

### `backend/api/songs.py`

- `ReferencePitchResponse`: `{ song_id, title, frames[] }`
- `_voiced_frames()`: None 프레임 제거 후 `ReferencePitchFrame` 변환
- YouTube: `asyncio.get_running_loop().run_in_executor(None, ...)` — 동기 yt-dlp를 이벤트 루프 블로킹 없이 실행

### `backend/core/pitch_engine.py`

- `extract_pitch(file_path)` — 공개 진입점
- `_smooth_pitch()` — 단발 노이즈 제거, 보간, 점프 필터 (3단계)
- `_hz_to_midi()` — `69 + 12 × log₂(freq / 440)`
- `MIDI_ROUND = 1`, `FREQ_ROUND = 2` — 출력 정밀도 제어

### `backend/core/aligner.py`

- `find_best_offset(user, ref, stride=5)` — Subsequence DTW, 첫 행 0으로 초기화
- `align_midi_sequences(user, ref)` — 일반 DTW, 경로 역추적 후 정순 반환
- `calculate_cent_error(user_freq, ref_freq)` — `1200 × log₂(user/ref)`
- `midi_to_hz(midi)` — `440 × 2^((midi-69)/12)`

### `backend/core/phrase_detector.py`

- `detect_phrases(frames, min_gap=0.5, min_phrase=3.0, max_phrase=22.0)`
- `compute_phrase_results(alignment, phrases, good_threshold=70.0)`
- direction 판정: `avg_cent > 20` → sharp, `< -20` → flat, else → mixed

### `backend/core/feedback_summary.py`

- `FeedbackInputSummary`: LLM에 전달하는 요약 구조체
- `build_feedback_summary()` — 메인 집계 함수
- `_build_unstable_segments()` — gap ≤ 0.18초 프레임 그룹화 → max_abs_cent_error 내림차순 → top 3
- `_resolve_pitch_tendency()` — `mostly_centered` / `tends_sharp` / `tends_flat`

### `backend/core/feedback_generator.py`

- `FEEDBACK_JSON_SCHEMA` — OpenAI Structured Outputs용 JSON Schema (additionalProperties: false, strict)
- `generate_ai_feedback(summary)` — OpenAI responses API 호출
- `FeedbackGenerationError(RuntimeError)` — API 키 없음, 네트워크 오류, 파싱 실패를 단일 예외로 통합

### `backend/core/midi_parser.py`

- `parse_midi_to_frames(midi_path)` — mido로 MIDI 파싱
- note_on(velocity > 0) 이벤트만 추출, time 정렬
- set_tempo 메시지로 BPM 변화 실시간 반영

### `frontend/app/page.tsx`

- 전체 앱의 유일한 페이지 컴포넌트
- `AsyncStatus` 타입: `'idle' | 'loading' | 'success' | 'error'`
- `runCompare()`, `runFeedback()` — `useCallback`으로 메모이제이션
- `useEffect([analysisResult])` → `runCompare` 자동 트리거
- `handleDemo()` — `DEMO_*` 데이터를 상태에 직접 주입, API 호출 없음

### `frontend/components/recorder/VoiceRecorder.tsx`

- `convertToWav(blob)` — Web Audio API 기반 WebM→WAV 순수 JS 변환
- `startRecording()` — `getUserMedia` + `MediaRecorder` + `AnalyserNode` 초기화
- `stopRecording()` — 타이머 정리, 스트림 해제, Blob 생성 후 `uploadAudio()` 호출
- `RECORDING_SAMPLE_RATE = 22050` — 백엔드 `SAMPLE_RATE`와 일치

### `frontend/components/analysis/noteUtils.ts`

- `midiToLabelShort(midi)` → `"3옥 도"` (Piano Roll Y축)
- `midiToLabelFull(midi)` → `"3옥타브 도"` (툴팁, 요약 카드)
- `octaveColor(midi)` → 옥타브별 색상 (0=zinc, 1=violet, 2=blue, 3=emerald, 4=amber, 5=red)
- 한국 표기: C4(MIDI 60) = 2옥타브 (`Math.floor(midi/12) - 3`)

### `frontend/components/analysis/PianoRoll.tsx`

- `useEffect` → Canvas 2D Context 렌더링 (배경 → 그리드 → 기준선 → 사용자 피치)
- `toX(time)`, `toY(midi)` — `useCallback`으로 메모이제이션된 좌표 변환
- `handleMouseMove` — 가장 가까운 프레임 O(n) 선형 탐색, 거리 임계값 `maxTime × 0.02`

### `frontend/lib/demoData.ts`

- `DEMO_UPLOAD: UploadResponse` — 더미 피치 데이터
- `DEMO_COMPARE: CompareResponse` — 더미 비교 결과
- `DEMO_FEEDBACK: FeedbackResponse` — 더미 AI 피드백

---

## 타입 의존 관계

```
backend Pydantic 모델           ↔    frontend TypeScript 인터페이스
─────────────────────────────────────────────────────────────────
upload.py::UploadResponse       ↔    recorder/types.ts::UploadResponse
upload.py::PitchFrame           ↔    recorder/types.ts::PitchFrame
compare.py::AlignmentFrame      ↔    analysis/types.ts::AlignmentFrame
compare.py::JudgementSummary    ↔    analysis/types.ts::JudgementSummary
compare.py::PhraseResult        ↔    analysis/types.ts::PhraseResult
compare.py::CompareResponse     ↔    analysis/types.ts::CompareResponse
feedback_generator.py::FeedbackResponse ↔ report/types.ts::FeedbackResponse
api/feedback.py::FeedbackApiResponse    ↔ report/types.ts::FeedbackApiResponse
```

백엔드와 프론트엔드 타입을 변경할 때는 **양쪽을 동시에 수정**해야 한다.
