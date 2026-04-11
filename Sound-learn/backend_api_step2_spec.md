# Step 2 API 명세 — `/api/upload`

**작성일:** 2026-04-11
**대상 단계:** Step 2 (Piano Roll 시각화)
**목적:** 프론트엔드가 사용자 pitch 데이터를 안정적으로 시각화할 수 있도록 업로드 API의 요청/응답 형식을 고정

---

## 1. 엔드포인트 개요

- 메서드: `POST`
- 경로: `/api/upload`
- 전체 URL 예시: `http://localhost:8000/api/upload`
- 설명: 업로드한 오디오 파일을 분석하여 프레임 단위 pitch 데이터와 요약 통계를 반환한다

---

## 2. 요청 명세

### Content-Type

```http
multipart/form-data
```

### 필드

| 필드명 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | File | Yes | 분석할 오디오 파일 |

### 허용 파일 형식

- `.wav`
- `.mp3`
- `.webm`

### 파일 크기 제한

- 최대 `50MB`

---

## 3. 처리 흐름

1. 파일명 존재 여부 확인
2. 확장자 검증
3. 파일 크기 검증
4. 오디오 디코딩
5. 모노 변환 및 `22050Hz` 리샘플링
6. 임시 WAV 파일 저장
7. `librosa.pyin` 기반 pitch 추출
8. 요약 통계 계산
9. JSON 응답 반환
10. 임시 파일 삭제

---

## 4. 성공 응답 명세

### HTTP 상태 코드

```http
200 OK
```

### 응답 구조

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

---

## 5. 필드 설명

### 최상위 필드

| 필드명 | 타입 | 설명 |
|------|------|------|
| `filename` | `string` | 사용자가 업로드한 원본 파일명 |
| `duration_sec` | `number` | 리샘플링된 오디오 기준 길이(초), 소수 셋째 자리 반올림 |
| `original_sr` | `number` | 업로드 원본 오디오의 샘플레이트 |
| `normalized_sr` | `number` | 분석 기준 샘플레이트, 현재 고정값 `22050` |
| `pitch` | `PitchFrame[]` | 프레임 단위 음정 데이터 배열 |
| `summary` | `PitchSummary` | pitch 배열 기반 요약 통계 |

### `PitchFrame`

| 필드명 | 타입 | 설명 |
|------|------|------|
| `time` | `number` | 해당 프레임의 시간 위치(초), 약 23ms 간격 |
| `frequency` | `number \| null` | 추출된 주파수(Hz), 무성 구간이면 `null` |
| `midi_note` | `number \| null` | MIDI note number, 무성 구간이면 `null` |

### `PitchSummary`

| 필드명 | 타입 | 설명 |
|------|------|------|
| `voiced_frames` | `number` | 유성으로 판정된 프레임 수 |
| `total_frames` | `number` | 전체 프레임 수 |
| `min_frequency` | `number \| null` | 유성 프레임 중 최저 주파수 |
| `max_frequency` | `number \| null` | 유성 프레임 중 최고 주파수 |
| `min_midi` | `number \| null` | 유성 프레임 중 최저 MIDI note |
| `max_midi` | `number \| null` | 유성 프레임 중 최고 MIDI note |
| `avg_frequency` | `number \| null` | 유성 프레임 주파수 평균 |

---

## 6. null 처리 규칙

아래 경우 `frequency`와 `midi_note`는 둘 다 `null`로 반환한다.

- 묵음 구간
- 무성 구간
- `pyin`이 pitch를 추적하지 못한 프레임
- 스무딩 과정에서 이상치로 제거된 프레임

즉 프론트엔드는 아래 규칙을 전제로 구현한다.

- `frequency !== null`인 프레임만 실제 음정 점으로 간주
- `null` 프레임은 빈 구간 또는 끊긴 구간으로 렌더링

---

## 7. 오류 응답 명세

### 공통 형식

```json
{
  "detail": "오류 메시지"
}
```

### 오류 케이스

| 상황 | HTTP 코드 | 응답 예시 |
|------|-----------|-----------|
| 파일명이 없음 | `422` | `{"detail":"파일명이 없습니다."}` |
| 지원하지 않는 확장자 | `422` | `{"detail":"지원하지 않는 파일 형식입니다. 허용: .wav, .mp3, .webm"}` |
| 파일 크기 초과 | `422` | `{"detail":"파일 크기가 50MB를 초과합니다."}` |
| 오디오 디코딩 실패 | `422` | `{"detail":"오디오 파일을 디코딩할 수 없습니다."}` |
| pitch 분석 실패 | `500` | `{"detail":"피치 분석 중 오류가 발생했습니다."}` |

---

## 8. 프론트 연동 규칙

현재 프론트엔드는 아래 구조를 그대로 기대한다.

- `pitch` 배열을 `PianoRoll`에 전달
- `summary` 객체를 `AnalysisSummary`에 전달
- `duration_sec`를 분석 결과 표시용으로 사용

따라서 Step 2 동안에는 아래 변경을 금지한다.

- `pitch` 필드명 변경
- `summary` 필드명 변경
- `frequency`, `midi_note`의 `null` 규칙 변경
- `normalized_sr` 값을 가변적으로 변경

---

## 9. Step 2 백엔드 완료 기준

아래를 만족하면 `/api/upload`는 Step 2 기준으로 안정화된 것으로 본다.

- 요청/응답 형식이 문서와 실제 구현이 일치함
- 프론트에서 업로드 후 Piano Roll 렌더링이 정상 동작함
- 대표 오류 케이스에서 의도한 상태 코드와 메시지가 반환됨
- 무성 구간이 `null`로 일관되게 처리됨

---

## 10. 향후 확장 포인트

Step 3 이상에서 아래 필드가 추가될 가능성이 있다.

```json
{
  "reference_pitch": [],
  "segments": [],
  "alignment": null,
  "feedback": null
}
```

Step 2에서는 아직 포함하지 않는다.
