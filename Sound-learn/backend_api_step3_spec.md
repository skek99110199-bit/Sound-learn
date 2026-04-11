# Step 3 API 명세 — `/api/compare`

**작성일:** 2026-04-12
**대상 단계:** Step 3 (데이터 비교 알고리즘 고도화)
**목적:** 사용자 pitch와 기준 melody를 DTW로 정렬하고, `±100 cent` 기준으로 정확도를 판정하는 비교 API 명세

---

## 1. 엔드포인트 개요

- 메서드: `POST`
- 경로: `/api/compare`
- 전체 URL 예시: `http://localhost:8000/api/compare`
- 설명: 사용자 pitch와 기준 reference pitch를 입력받아 DTW 정렬과 cent 판정을 수행한다

---

## 2. 설계 원칙

- Step 2의 `/api/upload`는 유지한다
- Step 3 비교 로직은 `/api/compare`로 분리한다
- 기준 melody 입력은 첫 구현에서 `JSON reference_pitch`로 받는다
- 실제 MIDI 파일 파싱은 이후 단계에서 확장 가능하게 설계한다

---

## 3. 요청 명세

### Content-Type

```http
application/json
```

### 요청 구조

```json
{
  "user_pitch": [
    { "time": 0.0, "frequency": 440.0, "midi_note": 69.0 },
    { "time": 0.5, "frequency": 493.88, "midi_note": 71.0 }
  ],
  "reference_pitch": [
    { "time": 0.0, "midi_note": 69.0 },
    { "time": 0.4, "midi_note": 71.0 }
  ]
}
```

### 필드 설명

| 필드명 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_pitch` | `ComparePitchFrame[]` | Yes | Step 2에서 추출된 사용자 pitch |
| `reference_pitch` | `ComparePitchFrame[]` | Yes | 기준 melody를 JSON frame 형태로 전달 |

### `ComparePitchFrame`

| 필드명 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `time` | `number` | Yes | 프레임 시간(초) |
| `midi_note` | `number \| null` | Yes | MIDI note number |
| `frequency` | `number \| null` | No | 사용자 pitch는 보통 포함, reference는 생략 가능 |

규칙:

- `user_pitch`는 보통 `frequency`와 `midi_note` 둘 다 포함
- `reference_pitch`는 `midi_note`만 있어도 됨
- `midi_note == null` 프레임은 비교에서 제외

---

## 4. 처리 흐름

1. `user_pitch`, `reference_pitch` 입력 검증
2. `midi_note != null` 프레임만 추림
3. 사용자 MIDI 시퀀스와 기준 MIDI 시퀀스를 DTW로 정렬
4. 정렬된 frame 쌍에 대해 cent 오차 계산
5. `abs(cent_error) <= 100` 기준으로 정답 판정
6. 전체 정확도 summary 계산
7. 정렬 결과와 summary 반환

---

## 5. 성공 응답 명세

### HTTP 상태 코드

```http
200 OK
```

### 응답 구조

```json
{
  "user_pitch": [],
  "reference_pitch": [],
  "alignment": [
    {
      "user_time": 0.0,
      "reference_time": 0.0,
      "user_midi": 69.0,
      "reference_midi": 69.0,
      "user_frequency": 440.0,
      "reference_frequency": 440.0,
      "cent_error": 0.0,
      "is_correct": true
    }
  ],
  "judgement": {
    "correct_frames": 1,
    "total_compared_frames": 1,
    "accuracy_percent": 100.0,
    "avg_cent_error": 0.0,
    "max_positive_cent_error": 0.0,
    "max_negative_cent_error": 0.0
  }
}
```

---

## 6. 응답 필드 설명

### `alignment`

정렬 후 실제로 비교된 frame 쌍 목록

| 필드명 | 타입 | 설명 |
|------|------|------|
| `user_time` | `number` | 사용자 프레임 시간 |
| `reference_time` | `number` | 기준 프레임 시간 |
| `user_midi` | `number` | 사용자 MIDI |
| `reference_midi` | `number` | 기준 MIDI |
| `user_frequency` | `number` | 사용자 주파수 |
| `reference_frequency` | `number` | 기준 주파수 |
| `cent_error` | `number` | cent 오차 |
| `is_correct` | `boolean` | `±100 cent` 이내면 `true` |

### `judgement`

비교 결과 요약

| 필드명 | 타입 | 설명 |
|------|------|------|
| `correct_frames` | `number` | 정답으로 판정된 frame 수 |
| `total_compared_frames` | `number` | 실제 비교된 frame 수 |
| `accuracy_percent` | `number` | 정답 비율 |
| `avg_cent_error` | `number \| null` | 평균 cent 오차 |
| `max_positive_cent_error` | `number \| null` | 가장 높은 양수 오차 |
| `max_negative_cent_error` | `number \| null` | 가장 낮은 음수 오차 |

---

## 7. 판정 기준

### Cent 계산 공식

```text
cent_error = 1200 * log2(user_freq / reference_freq)
```

### 정답 기준

```text
abs(cent_error) <= 100
```

즉:

- 100 cent 이내: 정답
- 100 cent 초과: 오답

현재 구현에서는 정확히 `100 cent`도 정답으로 처리한다.

---

## 8. 오류 응답 명세

### 공통 형식

```json
{
  "detail": "오류 메시지"
}
```

### 주요 오류

| 상황 | HTTP 코드 | 메시지 |
|------|-----------|--------|
| 비교 가능한 `user_pitch` 없음 | `422` | `비교 가능한 user_pitch 유성 프레임이 없습니다.` |
| 비교 가능한 `reference_pitch` 없음 | `422` | `비교 가능한 reference_pitch 프레임이 없습니다.` |
| DTW 경로 생성 실패 | `422` | `DTW 정렬 결과를 생성할 수 없습니다.` |
| 정렬 후 비교 가능한 frame 없음 | `422` | `정렬 후 비교 가능한 frame이 없습니다.` |

---

## 9. 현재 구현 범위

현재 Step 3 첫 구현에서 포함된 범위:

- `JSON reference_pitch` 입력
- DTW 정렬
- cent 오차 계산
- `±100 cent` 판정
- 정확도 summary 계산

현재 Step 3 첫 구현에서 아직 미포함인 범위:

- 실제 MIDI 파일 업로드/파싱
- 기준 멜로디 DB 연동
- 프론트 비교 결과 시각화
- 구간별 피드백 생성

---

## 10. 향후 확장 포인트

이후 단계에서 아래 필드를 확장할 수 있다.

```json
{
  "segments": [],
  "reference_meta": {
    "song_id": "demo-song",
    "tempo": 120,
    "key": "C"
  },
  "feedback": null
}
```

Step 3 첫 구현에서는 아직 포함하지 않는다.
