# Step 2 API 명세: `/api/upload`

대상 단계: Step 2, Piano Roll 시각화 지원  
목적: 프론트엔드가 사용자 pitch 데이터를 안정적으로 시각화할 수 있도록 업로드 API의 요청/응답 형식을 고정합니다.

## 엔드포인트

```http
POST /api/upload
Content-Type: multipart/form-data
```

예시 URL:

```text
http://localhost:8000/api/upload
```

## 요청

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `file` | File | Yes | 분석할 오디오 파일 |

허용 확장자:

- `.wav`
- `.mp3`
- `.webm`

파일 크기 제한:

- 최대 50MB

## 처리 흐름

1. 파일명 존재 여부 확인
2. 확장자 검증
3. 파일 크기 검증
4. 오디오 디코딩
5. 모노 변환 및 22050Hz 리샘플링
6. 임시 WAV 저장
7. `librosa.pyin` 기반 pitch 추출
8. pitch summary 계산
9. JSON 응답 반환
10. 임시 파일 정리

## 성공 응답

상태 코드:

```http
200 OK
```

응답 예시:

```json
{
  "filename": "recording.wav",
  "duration_sec": 5.217,
  "original_sr": 44100,
  "normalized_sr": 22050,
  "pitch": [
    {
      "time": 0.023,
      "frequency": 220.0,
      "midi_note": 57.0
    },
    {
      "time": 0.046,
      "frequency": null,
      "midi_note": null
    }
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

## 최상위 필드

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `filename` | `string` | 사용자가 업로드한 원본 파일명 |
| `duration_sec` | `number` | 분석된 오디오 길이, 초 단위 |
| `original_sr` | `number` | 원본 오디오 sample rate |
| `normalized_sr` | `number` | 분석 기준 sample rate, 현재 22050 |
| `pitch` | `PitchFrame[]` | 프레임 단위 피치 데이터 |
| `summary` | `PitchSummary` | 피치 배열 기반 요약 통계 |

## `PitchFrame`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `time` | `number` | 프레임의 시간 위치, 초 단위 |
| `frequency` | `number \| null` | 주파수 Hz, 무성 구간은 `null` |
| `midi_note` | `number \| null` | MIDI note number, 무성 구간은 `null` |

## `PitchSummary`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `voiced_frames` | `number` | 유성 프레임 수 |
| `total_frames` | `number` | 전체 프레임 수 |
| `min_frequency` | `number \| null` | 최저 주파수 |
| `max_frequency` | `number \| null` | 최고 주파수 |
| `min_midi` | `number \| null` | 최저 MIDI note |
| `max_midi` | `number \| null` | 최고 MIDI note |
| `avg_frequency` | `number \| null` | 평균 주파수 |

## `null` 처리 규칙

다음 경우 `frequency`와 `midi_note`는 `null`입니다.

- 무음 구간
- 무성 구간
- `pyin`이 pitch를 추적하지 못한 프레임
- 후처리 과정에서 이상치로 제거된 프레임

프론트엔드 렌더링 규칙:

- `frequency !== null`인 프레임만 실제 피치 점으로 사용합니다.
- `null` 프레임은 빈 구간 또는 끊긴 구간으로 렌더링합니다.

## 오류 응답

공통 형식:

```json
{
  "detail": "오류 메시지"
}
```

| 상황 | HTTP 코드 | 설명 |
| --- | --- | --- |
| 파일명 없음 | `422` | 파일명이 비어 있음 |
| 지원하지 않는 확장자 | `422` | `.wav`, `.mp3`, `.webm` 외 파일 |
| 파일 크기 초과 | `422` | 50MB 초과 |
| 오디오 디코딩 실패 | `422` | 오디오 파일로 읽을 수 없음 |
| pitch 분석 실패 | `500` | 분석 중 서버 오류 |

## 프론트엔드 연동 규칙

프론트엔드는 아래 필드를 직접 사용합니다.

- `pitch` -> `PianoRoll`
- `summary` -> `AnalysisSummary`
- `duration_sec` -> 분석 결과 표시

따라서 Step 2 이후에는 아래 변경을 피해야 합니다.

- `pitch` 필드명 변경
- `summary` 필드명 변경
- `frequency`, `midi_note`의 `null` 규칙 변경
- `normalized_sr`를 프론트와 합의 없이 변경

## 향후 확장 후보

Step 3 이후 아래 필드가 추가될 수 있습니다.

```json
{
  "reference_pitch": [],
  "segments": [],
  "alignment": null,
  "feedback": null
}
```

Step 2에서는 아직 포함하지 않습니다.
