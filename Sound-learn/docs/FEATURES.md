# Sound-Learn — 전체 기능 목록

## 기능 요약

| # | 기능 | 진입점 | 관련 파일 |
|---|------|--------|-----------|
| 1 | 기준곡 로드 (파일) | `POST /api/songs/upload-reference` | `api/songs.py`, `components/songs/SongSelector.tsx` |
| 2 | 기준곡 로드 (YouTube) | `POST /api/songs/youtube` | `api/songs.py`, `components/songs/SongSelector.tsx` |
| 3 | 사용자 음성 녹음 | `VoiceRecorder.tsx` | `components/recorder/VoiceRecorder.tsx` |
| 4 | 오디오 파일 업로드 + 피치 분석 | `POST /api/upload` | `api/upload.py`, `core/pitch_engine.py` |
| 5 | 피치 비교 (DTW) | `POST /api/compare` | `api/compare.py`, `core/aligner.py`, `core/phrase_detector.py` |
| 6 | AI 피드백 생성 | `POST /api/feedback` | `api/feedback.py`, `core/feedback_generator.py`, `core/feedback_summary.py` |
| 7 | 피아노 롤 시각화 | `PianoRoll.tsx` | `components/analysis/PianoRoll.tsx` |
| 8 | 핵심 분석 지표 표시 | `MetricsReport.tsx` | `components/report/MetricsReport.tsx` |
| 9 | 소절별 비교 요약 + 구간 재생 | `CompareSummary.tsx` | `components/analysis/CompareSummary.tsx` |
| 10 | AI 피드백 리포트 | `FeedbackReport.tsx` | `components/report/FeedbackReport.tsx` |
| 11 | 데모 모드 | `handleDemo` in `page.tsx` | `lib/demoData.ts` |

---

## 기능별 상세

### 1 · 2. 기준곡 로드

**목적**: 사용자가 따라 부를 "기준 멜로디"를 설정한다. 오디오에서 피치를 추출해 `ReferencePitchFrame[]`로 저장한다.

**두 가지 방법**:
- **파일 업로드** (`/api/songs/upload-reference`): WAV / MP3 / M4A / FLAC / OGG 지원
- **YouTube URL** (`/api/songs/youtube`): yt-dlp로 오디오 다운로드 → WAV 변환 → 피치 추출. 최대 10분 영상만 허용. ffmpeg 필요.

**출력**: `{ song_id, title, frames: [{time, midi_note, frequency}] }`

---

### 3. 사용자 음성 녹음

**목적**: 브라우저 마이크로 노래를 녹음하거나, 로컬 파일을 직접 선택한다.

**처리 흐름**:
1. `navigator.mediaDevices.getUserMedia` → `MediaRecorder` (WebM/Opus)
2. Web Audio API `AnalyserNode` → `WaveformVisualizer`로 실시간 파형 표시
3. 녹음 중지 시 WebM Blob → `convertToWav()` (Web Audio API 기반 순수 JS 변환) → WAV Blob
4. WAV Blob → `POST /api/upload` 전송

**파일 선택** 경로: 브라우저 파일 선택 → (WebM이면 변환, 그 외 직접 전송)

---

### 4. 오디오 업로드 + 피치 분석

**목적**: 업로드된 오디오에서 프레임별 피치를 추출한다.

**처리 단계**:
1. 확장자 검증 (`.wav`, `.mp3`, `.webm`) + 50MB 크기 제한
2. librosa로 로드 → 22050Hz 모노 리샘플링
3. UUID 접두어로 `backend/temp/`에 임시 저장
4. `extract_pitch()` 호출 → `backend/temp/` 파일 삭제
5. 요약 통계(min/max/avg Hz, min/max MIDI, voiced 프레임 수) 계산 후 반환

**출력**: `UploadResponse { filename, duration_sec, original_sr, normalized_sr, pitch[], summary }`

---

### 5. 피치 비교 (DTW)

**목적**: 사용자 피치와 기준 멜로디를 프레임 단위로 정렬하고 정확도를 계산한다.

**처리 단계**:
1. 무성 프레임(midi_note = null) 제거
2. `find_best_offset()` — Subsequence DTW로 기준곡에서 사용자 음성과 가장 잘 맞는 구간 탐색
3. `align_midi_sequences()` — 전체 DTW로 프레임별 대응 관계(path) 생성
4. 각 대응 쌍에 대해 cent 오차 = 1200 × log₂(user_freq / ref_freq) 계산
5. ±100 cent 이내 → `is_correct = true`
6. `detect_phrases()` → `compute_phrase_results()` 로 소절 단위 집계

**출력**: `CompareResponse { alignment[], judgement, phrase_results[], detected_offset_sec }`

---

### 6. AI 피드백 생성

**목적**: 비교 결과를 요약해 OpenAI에 전달하고, 구조화된 한국어 피드백을 받는다.

**처리 단계**:
1. `build_feedback_summary()` — alignment에서 오류 프레임 묶기, 피치 경향 분석, unstable segment top 3 추출
2. `generate_ai_feedback()` — OpenAI Structured Outputs (JSON Schema 강제) 호출
3. `FeedbackResponse` Pydantic 모델로 검증

**score_label**: `excellent` / `good` / `needs_practice` / `poor`

**오류 처리**: OPENAI_API_KEY 미설정 → 503. LLM이 JSON 스키마 불일치 → 503.

---

### 7. 피아노 롤 시각화

**목적**: 사용자 피치(파란 점선)와 기준 멜로디(노란 점선)를 MIDI 음계 × 시간 축 Canvas에 겹쳐 표시한다.

**특징**:
- 마우스 호버 → 툴팁 (시간, Hz, 한국어 음계)
- Y축 라벨: 한국어 옥타브 표기 (`3옥 도`, `4옥 솔#`) + 옥타브별 색상
- C 음에 굵은 수평선 강조

---

### 8. 핵심 분석 지표 (MetricsReport)

**목적**: 음정 정확도, 박자 정밀도, 음역대를 한눈에 보여주는 요약 패널.

**표시 항목**:
- `AccuracyRing`: SVG 원형 게이지로 정확도(%) 표시
- 박자 정밀도: 평균 타이밍 오차(ms) → `매우 정확` / `양호` / `보통` / `연습 필요` 등급
- 음성 감지율: voiced_frames / total_frames
- 음역대: min_midi ~ max_midi를 그라디언트 바와 한국어 음계로 표시

---

### 9. 소절별 비교 요약 (CompareSummary)

**목적**: 소절 단위로 정확도, 음정 방향(♯/♭/불안정), 해당 구간 오디오 재생을 제공한다.

**PhraseCard 재생 동작**:
- `new Audio(audioUrl)` 생성 → `currentTime = result.user_start_time`
- `timeupdate` 이벤트로 `result.user_end_time` 도달 시 자동 정지

---

### 10. AI 피드백 리포트 (FeedbackReport)

**목적**: `FeedbackResponse`를 카드 형식으로 시각화한다.

**표시 섹션**: 총평 / 잘한 점 (✅) / 개선할 점 (📈) / 연습 방법 (💡) / 집중 연습 구간 (🎯, is_good=false 소절)

**점수 배지**: score_label → 이모지 + 색상 테마 자동 적용

---

### 11. 데모 모드

**목적**: 백엔드 없이 UI 전체를 확인할 수 있도록 고정 더미 데이터를 주입한다.

`lib/demoData.ts`에 `DEMO_UPLOAD`, `DEMO_COMPARE`, `DEMO_FEEDBACK` 상수 정의.  
`handleDemo()` 호출 시 API 호출 없이 해당 데이터를 상태에 직접 설정한다.
