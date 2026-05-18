# Sound-Learn — 기능별 핵심 로직 상세

## 목차

1. [피치 추출 (pitch_engine.py)](#1-피치-추출)
2. [DTW 정렬 (aligner.py)](#2-dtw-정렬)
3. [소절 감지 (phrase_detector.py)](#3-소절-감지)
4. [피드백 요약 생성 (feedback_summary.py)](#4-피드백-요약-생성)
5. [AI 피드백 생성 (feedback_generator.py)](#5-ai-피드백-생성)
6. [MIDI 파서 (midi_parser.py)](#6-midi-파서)
7. [업로드 API (api/upload.py)](#7-업로드-api)
8. [비교 API (api/compare.py)](#8-비교-api)
9. [기준곡 API (api/songs.py)](#9-기준곡-api)
10. [프론트엔드 상태 흐름 (app/page.tsx)](#10-프론트엔드-상태-흐름)
11. [VoiceRecorder — WebM → WAV 변환](#11-voicerecorder--webm--wav-변환)
12. [PianoRoll — Canvas 렌더링](#12-pianoroll--canvas-렌더링)

---

## 1. 피치 추출

**파일**: `backend/core/pitch_engine.py`  
**진입점**: `extract_pitch(file_path: str) -> list[dict]`

### 흐름

```
_load_audio()      오디오 파일 → 22050Hz 모노 NumPy 배열
    ↓
_run_pyin()        librosa.pyin → f0 배열 + voiced_flag 배열
    ↓
_smooth_pitch()    노이즈 제거 + 보간
    ↓
_build_frames()    배열 → [{time, frequency, midi_note}] 리스트
```

### `_run_pyin()`

`librosa.pyin`은 HMM 기반 피치 추적 알고리즘.  
`fmin=65.4Hz (C2)`, `fmax=1046.5Hz (C6)`, `hop_length=512` (≈ 23ms/frame).  
무성 구간은 `f0=NaN`, `voiced_flag=False`로 마킹한다.

### `_smooth_pitch()` — 3단계 후처리

| 단계 | 규칙 | 목적 |
|------|------|------|
| 1 | 전후가 모두 무성인 1프레임짜리 유성 구간 → null 처리 | 짧은 노이즈 제거 |
| 2 | 전후가 모두 유성인 1프레임짜리 무성 구간 → 선형 보간 | 미세 떨림 복원 |
| 3 | 인접 프레임 대비 ±6반음 초과 점프 → null 처리 | 비정상 피치 스파이크 제거 |

### `_hz_to_midi()`

```python
MIDI = 69 + 12 × log₂(freq / 440)   # A4 = 69
```

소수점 1자리 반올림 (`MIDI_ROUND = 1`) → Piano Roll 스무딩 효과.

---

## 2. DTW 정렬

**파일**: `backend/core/aligner.py`  
두 함수가 단계적으로 사용된다.

### `find_best_offset()` — Subsequence DTW

**목적**: 기준 멜로디에서 사용자가 부른 부분과 가장 잘 맞는 구간을 자동으로 찾는다.

```python
# stride=5 다운샘플링으로 행렬 크기 축소
u = user_notes[::5]
r = ref_notes[::5]

# DTW 행렬 초기화
# 핵심: 첫 행(dtw[0][j])을 모두 0으로 → 레퍼런스 어디서든 시작 허용
dtw[0][j] = 0.0 for all j

# 역추적 → (start_idx, end_idx) 반환 (원본 인덱스로 변환)
```

**반환값**: `(start_idx, end_idx)` — 이후 `ref_frames[start:end]`로 슬라이싱.

### `align_midi_sequences()` — 전체 DTW

**목적**: 슬라이싱된 레퍼런스와 사용자 시퀀스를 프레임별로 1:1 대응시킨다.

```python
cost[i][j] = abs(user[i-1] - ref[j-1]) + min(
    cost[i-1][j-1],   # 대각선 (동시 진행)
    cost[i-1][j],     # 수직 (사용자 slower)
    cost[i][j-1],     # 수평 (레퍼런스 slower)
)
```

**반환값**: `[(user_idx, ref_idx), ...]` — 역추적 후 정순으로 뒤집은 경로.

### `calculate_cent_error()`

```python
cent_error = 1200 × log₂(user_freq / ref_freq)
```

양수 = 사용자가 더 높게 부름 (♯), 음수 = 더 낮게 부름 (♭).  
`|cent_error| ≤ 100` 이면 `is_correct = True`.

---

## 3. 소절 감지

**파일**: `backend/core/phrase_detector.py`

### `detect_phrases()` — 4단계 파이프라인

```
voiced frame만 추출
    ↓
1) gap ≥ 0.5초인 구간을 소절 경계로 분리
    ↓
2) 너무 짧은 소절(<3초)은 다음 소절과 합치기
    ↓
3) 너무 긴 소절(>22초)은 균등 분할
    ↓
[{index, start_time, end_time}, ...] 반환
```

전체 길이 ≤ 3초면 단일 소절로 즉시 반환.

### `compute_phrase_results()` — 소절별 집계

각 소절에 대해:
- `alignment`에서 `ref_start_time ≤ reference_time ≤ ref_end_time` 인 프레임 필터링
- `accuracy_percent`, `avg_cent_error` 계산
- `direction`: `avg_cent_error > 20` → `sharp`, `< -20` → `flat`, 그 외 → `mixed`
- `is_good`: `accuracy_percent ≥ 70%`

---

## 4. 피드백 요약 생성

**파일**: `backend/core/feedback_summary.py`  
**진입점**: `build_feedback_summary(...) -> FeedbackInputSummary`

### 불안정 구간(Unstable Segment) 탐색

```
오류 프레임(is_correct=False) 추출
    ↓
user_time 기준 정렬
    ↓
인접 프레임 간격 ≤ 0.18초면 같은 그룹으로 묶기
    ↓
각 그룹 → FeedbackSegment {
    avg_cent_error, max_abs_cent_error, direction, frame_count
}
    ↓
max_abs_cent_error 내림차순 정렬 → 상위 3개만 반환
```

### `_resolve_pitch_tendency()`

| avg_cent_error | tendency |
|----------------|----------|
| None 또는 ±20 이내 | `mostly_centered` |
| > 20 | `tends_sharp` |
| < -20 | `tends_flat` |

---

## 5. AI 피드백 생성

**파일**: `backend/core/feedback_generator.py`  
**진입점**: `generate_ai_feedback(summary: FeedbackInputSummary) -> FeedbackResponse`

### OpenAI 호출 방식

```python
client.responses.create(
    model=OPENAI_MODEL,            # 기본값: gpt-4o-mini
    input=[system_prompt, user_data],
    text={"format": {"type": "json_schema", "strict": True, "schema": FEEDBACK_JSON_SCHEMA}}
)
```

`strict: True` Structured Outputs를 사용해 LLM 응답이 `FEEDBACK_JSON_SCHEMA`를 반드시 따르도록 강제한다.  
응답 텍스트는 `FeedbackResponse.model_validate_json()`으로 검증한다.

### 오류 처리

| 상황 | 동작 |
|------|------|
| `OPENAI_API_KEY` 미설정 | `FeedbackGenerationError` raise → HTTP 503 |
| openai 패키지 미설치 | `FeedbackGenerationError` raise → HTTP 503 |
| OpenAI API 오류 | `FeedbackGenerationError` raise → HTTP 503 |
| JSON 스키마 불일치 | `FeedbackGenerationError` raise → HTTP 503 |

### FeedbackResponse 구조

```json
{
  "overall": "한국어 총평",
  "strengths": ["잘한 점 ..."],
  "improvements": ["개선할 점 ..."],
  "practice_tips": ["연습 방법 ..."],
  "focus_segments": [{"start_time": 1.2, "end_time": 2.0, "issue": "...", "tip": "..."}],
  "score_label": "excellent|good|needs_practice|poor"
}
```

---

## 6. MIDI 파서

**파일**: `backend/core/midi_parser.py`  
**진입점**: `parse_midi_to_frames(midi_path: Path) -> list[dict]`

MIDI 트랙 전체를 `mido.merge_tracks()`로 합친 뒤, `note_on` 이벤트(velocity > 0)만 추출한다.  
tick → 초 변환: `mido.tick2second(tick, ticks_per_beat, tempo)`.  
`set_tempo` 메시지로 BPM 변화를 실시간으로 반영한다.  
결과는 time 기준 오름차순 정렬 후 반환.

> 현재 `backend/songs/` 폴더에 `butterfly.mid`, `school_bell.mid`, `twinkle.mid` 3곡이 포함되어 있으나,  
> Songs API는 오디오 파일 업로드/YouTube만 지원하며 이 MIDI 파일들을 직접 서빙하는 엔드포인트는 아직 없다.

---

## 7. 업로드 API

**파일**: `backend/api/upload.py`  
**엔드포인트**: `POST /api/upload`

### 검증 규칙

- 파일명 필수
- 확장자: `.wav`, `.mp3`, `.webm` 만 허용
- 최대 파일 크기: 50MB

### 처리 흐름

```
UploadFile 수신
    ↓
librosa.load(sr=None) → 원본 sr 감지 후 22050Hz 리샘플링
    ↓
uuid.hex + 원본 파일명 접두어로 backend/temp/ 저장
    ↓
extract_pitch() 호출
    ↓
backend/temp/ 파일 즉시 삭제 (finally 보장)
    ↓
voiced 프레임으로 요약 통계 계산
    ↓
UploadResponse 반환
```

---

## 8. 비교 API

**파일**: `backend/api/compare.py`  
**엔드포인트**: `POST /api/compare`

### 입력

```json
{
  "user_pitch":      [{"time": 0.023, "midi_note": 57.0, "frequency": 220.0}, ...],
  "reference_pitch": [{"time": 0.0,   "midi_note": 60.0, "frequency": 261.63}, ...]
}
```

### 처리 흐름

```
무성 프레임 제거 (_only_voiced)
    ↓
find_best_offset(user_notes, ref_notes)
    → (start_idx, end_idx) — 레퍼런스 슬라이스 범위
    ↓
align_midi_sequences(user_notes, sliced_notes)
    → path: [(user_idx, ref_idx), ...]
    ↓
path 순회: cent_error, timing_error, is_correct 계산
    → AlignmentFrame 리스트 구성
    ↓
detect_phrases(ref_dicts) → compute_phrase_results(alignment, phrases)
    → PhraseResult 리스트
    ↓
_build_judgement(alignment, cent_errors, timing_errors)
    → JudgementSummary
    ↓
CompareResponse 반환
```

### `timing_error` 계산

```python
timing_error = user_time - (reference_time - time_offset)
```

`time_offset`은 슬라이싱된 레퍼런스의 첫 프레임 절대 시간.  
레퍼런스 슬라이스 기준 상대 시간으로 보정하여 실제 박자 오차를 계산한다.

---

## 9. 기준곡 API

**파일**: `backend/api/songs.py`

### `POST /api/songs/upload-reference`

임시 파일에 저장 → `extract_pitch()` → 무성 프레임 제거(`_voiced_frames`) → `ReferencePitchResponse` 반환.

### `POST /api/songs/youtube`

```python
# 비동기로 실행 (FastAPI 이벤트 루프 블로킹 방지)
await loop.run_in_executor(None, _download_and_extract, req.url)
```

`_download_and_extract()` 내부:
1. `yt_dlp.extract_info(..., download=False)` — 메타데이터 조회 + 10분 길이 제한 확인
2. `yt_dlp.download()` + FFmpegExtractAudio postprocessor → WAV 변환
3. `extract_pitch(wav_path)` 호출
4. `TemporaryDirectory`로 자동 정리

---

## 10. 프론트엔드 상태 흐름

**파일**: `frontend/app/page.tsx`

### 상태 변수

| 상태 | 타입 | 역할 |
|------|------|------|
| `selectedSong` | `SongMeta \| null` | 선택된 기준곡 메타데이터 |
| `referencePitch` | `ReferencePitchFrame[] \| null` | 기준 피치 프레임 (compare 요청 시 사용) |
| `analysisResult` | `UploadResponse \| null` | 업로드 분석 결과 |
| `compareResult` | `CompareResponse \| null` | DTW 비교 결과 |
| `compareStatus` | `AsyncStatus` | `idle/loading/success/error` |
| `feedbackResult` | `FeedbackResponse \| null` | AI 피드백 |
| `feedbackStatus` | `AsyncStatus` | `idle/loading/success/error` |
| `recordedAudioUrl` | `string \| null` | 브라우저 재생용 Blob URL |

### 자동 트리거 규칙

```
analysisResult 변경
    → useEffect → runCompare()
        → compare 성공 시 runFeedback() 자동 호출
```

`runCompare`는 `useCallback` + deps `[referencePitch, runFeedback]`.  
`useEffect`의 deps에서 `runCompare`를 의도적으로 제외해, analysisResult 변경 시에만 발동.

### API_URL 설정

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
```

---

## 11. VoiceRecorder — WebM → WAV 변환

**파일**: `frontend/components/recorder/VoiceRecorder.tsx`  
**함수**: `convertToWav(blob: Blob): Promise<Blob>`

브라우저 MediaRecorder는 WebM/Opus만 출력한다. 백엔드가 WAV를 선호하므로 클라이언트 측에서 변환한다.

```
WebM Blob
    ↓
ArrayBuffer → AudioContext.decodeAudioData()
    ↓
getChannelData(0)  — 모노 채널 추출
    ↓
WAV 헤더 수동 작성 (44 bytes)
  PCM, 모노, 22050Hz, 16-bit
    ↓
Float32 → Int16 변환 (clamp → scale)
    ↓
Blob([wavBuffer], { type: 'audio/wav' })
```

ffmpeg 불필요, 브라우저 내장 Web Audio API만 사용.

---

## 12. PianoRoll — Canvas 렌더링

**파일**: `frontend/components/analysis/PianoRoll.tsx`

### 좌표 변환

```typescript
toX(time)  = PADDING.left + (time / maxTime) * plotW   // 시간 → X픽셀
toY(midi)  = PADDING.top + plotH - ((midi - minMidi) / (maxMidi - minMidi)) * plotH  // MIDI → Y픽셀
```

MIDI 범위는 실제 데이터 min/max에서 ±2 여백 자동 계산.

### 렌더링 레이어 순서

1. 배경 채우기
2. 수평 그리드 라인 (C음 강조) + Y축 라벨
3. 수직 시간 그리드 + X축 타임라벨
4. 기준 멜로디 (amber, 점선) — `setLineDash([6, 4])`
5. 사용자 피치 (indigo, 실선)

### 툴팁

`onMouseMove`에서 마우스 X좌표 → 시간으로 역변환.  
전체 pitchData + referenceData 중 시간 거리 가장 가까운 프레임 탐색.  
거리가 `maxTime × 0.02` 이내일 때만 표시.
