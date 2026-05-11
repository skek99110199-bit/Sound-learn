# Step 3 API 명세: `/api/compare`

대상 단계: Step 3, 데이터 비교 알고리즘 고도화  
목적: 사용자 pitch와 기준 melody를 DTW로 정렬하고, `100 cent` 기준으로 정확도를 계산합니다.

## 엔드포인트

```http
POST /api/compare
Content-Type: application/json
```

예시 URL:

```text
http://localhost:8000/api/compare
```

## 설계 원칙

- Step 2의 `/api/upload`는 유지합니다.
- 비교 로직은 `/api/compare`로 분리합니다.
- 첫 구현에서는 기준 melody를 JSON `reference_pitch`로 받습니다.
- 실제 MIDI 파일 파싱과 곡 DB 연동은 이후 단계에서 확장합니다.

## 요청

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

## 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `user_pitch` | `ComparePitchFrame[]` | Yes | Step 2에서 추출된 사용자 pitch |
| `reference_pitch` | `ComparePitchFrame[]` | Yes | 기준 melody frame |

## `ComparePitchFrame`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `time` | `number` | Yes | 프레임 시간, 초 단위 |
| `midi_note` | `number \| null` | Yes | MIDI note number |
| `frequency` | `number \| null` | No | 사용자 pitch에는 보통 포함, reference는 생략 가능 |

규칙:

- `midi_note == null` 프레임은 비교에서 제외합니다.
- `user_pitch`는 보통 `frequency`와 `midi_note`를 모두 포함합니다.
- `reference_pitch`는 `midi_note`만 있어도 됩니다.

## 처리 흐름

1. `user_pitch`, `reference_pitch` 입력 검증
2. `midi_note != null` 프레임만 추출
3. 사용자 MIDI 시퀀스와 기준 MIDI 시퀀스를 DTW로 정렬
4. 정렬된 frame pair마다 cent 오차 계산
5. `abs(cent_error) <= 100` 기준으로 정답 판정
6. 전체 정확도와 오차 요약 계산
7. 정렬 결과와 summary 반환

## 성공 응답

상태 코드:

```http
200 OK
```

응답 예시:

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

## `alignment`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `user_time` | `number` | 사용자 프레임 시간 |
| `reference_time` | `number` | 기준 프레임 시간 |
| `user_midi` | `number` | 사용자 MIDI note |
| `reference_midi` | `number` | 기준 MIDI note |
| `user_frequency` | `number` | 사용자 주파수 |
| `reference_frequency` | `number` | 기준 주파수 |
| `cent_error` | `number` | cent 단위 오차 |
| `is_correct` | `boolean` | `100 cent` 이내면 `true` |

## `judgement`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `correct_frames` | `number` | 정답으로 판정된 frame 수 |
| `total_compared_frames` | `number` | 실제 비교된 frame 수 |
| `accuracy_percent` | `number` | 정답 비율 |
| `avg_cent_error` | `number \| null` | 평균 cent 오차 |
| `max_positive_cent_error` | `number \| null` | 가장 높은 방향의 오차 |
| `max_negative_cent_error` | `number \| null` | 가장 낮은 방향의 오차 |

## 판정 기준

cent 계산:

```text
cent_error = 1200 * log2(user_freq / reference_freq)
```

정답 기준:

```text
abs(cent_error) <= 100
```

해석:

- `cent_error > 0`: 사용자가 기준보다 높게 부름
- `cent_error < 0`: 사용자가 기준보다 낮게 부름
- `100 cent` 이내: 한 반음 이내로 보고 정답 처리

## 오류 응답

공통 형식:

```json
{
  "detail": "오류 메시지"
}
```

| 상황 | HTTP 코드 | 설명 |
| --- | --- | --- |
| 비교 가능한 `user_pitch` 없음 | `422` | 유성 사용자 프레임 없음 |
| 비교 가능한 `reference_pitch` 없음 | `422` | 기준 프레임 없음 |
| DTW 정렬 실패 | `422` | 정렬 경로 생성 실패 |
| 정렬 후 비교 가능한 frame 없음 | `422` | 계산 가능한 pair 없음 |

## 현재 구현 범위

포함:

- JSON `reference_pitch` 입력
- DTW 정렬
- cent 오차 계산
- `100 cent` 기준 판정
- 정확도 summary 계산

미포함:

- 실제 MIDI 파일 업로드/파싱
- 기준 melody DB 연동
- 프론트엔드에서 곡 선택
- 구간별 AI 피드백 생성

## 향후 확장 후보

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
