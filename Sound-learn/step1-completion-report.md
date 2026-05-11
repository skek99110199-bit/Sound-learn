# Step 1 완료 보고서: MVP 환경 구축

완료 기준일: 2026-04-02  
대상 범위: 1~2주차, 기본 녹음/업로드/피치 추출

## 목표

사용자가 브라우저에서 노래를 녹음하거나 오디오 파일을 업로드하면, 백엔드가 파일을 받아 분석 가능한 형태로 정규화하고 피치 데이터를 추출하는 MVP 기반을 만드는 것이 목표입니다.

## 구현된 기능

### 백엔드

| 기능 | 파일 | 설명 |
| --- | --- | --- |
| FastAPI 서버 | `backend/main.py` | API 서버와 CORS 설정 |
| 업로드 API | `backend/api/upload.py` | WAV, MP3, WebM 파일 수신 |
| 파일 제한 | `backend/api/upload.py` | 허용 확장자와 50MB 제한 |
| 오디오 정규화 | `backend/api/upload.py` | 22050Hz 모노 WAV 기준으로 변환 |
| 피치 추출 | `backend/core/pitch_engine.py` | `librosa.pyin` 기반 주파수와 MIDI note 추출 |
| 무성 구간 처리 | `backend/core/pitch_engine.py` | 음성이 없는 구간은 `null`로 반환 |
| Health Check | `backend/main.py` | `GET /`로 서버 상태 확인 |

### 프론트엔드

| 기능 | 파일 | 설명 |
| --- | --- | --- |
| 메인 화면 | `frontend/app/page.tsx` | 앱 진입 화면 |
| 녹음 컴포넌트 | `frontend/components/recorder/VoiceRecorder.tsx` | 마이크 권한 요청, 녹음 시작/중지 |
| 실시간 파형 | `frontend/components/recorder/WaveformVisualizer.tsx` | Web Audio API와 Canvas 기반 파형 표시 |
| 업로드 연동 | `frontend/components/recorder/VoiceRecorder.tsx` | 녹음 종료 후 백엔드 업로드 |
| 타입 정의 | `frontend/components/recorder/types.ts` | 업로드 응답과 녹음 상태 타입 |

## `/api/upload` 기본 명세

요청:

```http
POST /api/upload
Content-Type: multipart/form-data
```

필드:

| 필드 | 설명 |
| --- | --- |
| `file` | 분석할 오디오 파일 |

초기 응답 예시:

```json
{
  "filename": "recording.webm",
  "saved_path": "temp/recording.wav",
  "duration_sec": 5.123,
  "original_sr": 44100,
  "normalized_sr": 22050
}
```

이후 Step 2에서 `pitch`와 `summary`가 정식 응답으로 추가되었습니다.

## 피치 데이터 형식

`extract_pitch(file_path)`는 프레임 단위 배열을 반환합니다.

```json
[
  { "time": 0.023, "frequency": 220.0, "midi_note": 57.0 },
  { "time": 0.046, "frequency": 261.63, "midi_note": 60.0 },
  { "time": 0.069, "frequency": null, "midi_note": null }
]
```

| 필드 | 설명 |
| --- | --- |
| `time` | 프레임의 시간 위치, 초 단위 |
| `frequency` | 추출된 주파수 Hz, 무성 구간은 `null` |
| `midi_note` | MIDI note number, 무성 구간은 `null` |

MIDI 변환 공식:

```text
P = 69 + 12 * log2(f / 440)
```

## 사용자 흐름

```text
브라우저 접속
  -> 녹음 시작
  -> 마이크 권한 허용
  -> 실시간 파형 표시
  -> 녹음 중지
  -> WebM 파일 업로드
  -> 백엔드에서 WAV 정규화
  -> 피치 추출
  -> 업로드 완료 메시지 표시
```

## Step 1 완료 기준

- [x] 프론트엔드와 백엔드 서버를 각각 실행할 수 있다.
- [x] 브라우저에서 마이크 녹음을 시작/중지할 수 있다.
- [x] 녹음 파일을 백엔드로 업로드할 수 있다.
- [x] 백엔드가 오디오 파일을 읽고 정규화할 수 있다.
- [x] 샘플 오디오에서 피치 데이터를 추출할 수 있다.

## Step 2로 넘긴 작업

- `/api/upload` 응답에 `pitch`, `summary` 포함
- Piano Roll에 바로 사용할 수 있는 프레임 스키마 확정
- 실제 분석 결과 화면 연결
- WAV/MP3/WebM 업로드 검증 강화
