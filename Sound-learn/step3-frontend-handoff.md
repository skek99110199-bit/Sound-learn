# Step 3 프론트엔드 인계 문서

작성일: 2026-04-12  
대상: 프론트엔드 담당자  
목적: 백엔드에 추가된 Step 3 비교 API를 프론트엔드에서 바로 연결할 수 있도록 필요한 정보를 정리합니다.

## 현재 백엔드 상태

Step 3 백엔드 1차 구현이 들어가 있습니다.

추가된 기능:

- `POST /api/compare`
- DTW 기반 정렬
- cent 오차 계산
- `100 cent` 기준 정답 판정
- 비교 결과 요약 계산

Step 2의 `/api/upload`는 그대로 유지됩니다.

## 새 API: `POST /api/compare`

### 요청

```json
{
  "user_pitch": [
    { "time": 0.0, "frequency": 440.0, "midi_note": 69.0 }
  ],
  "reference_pitch": [
    { "time": 0.0, "midi_note": 69.0 }
  ]
}
```

### 응답

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

자세한 명세는 `step3-api-compare-spec.md`를 기준으로 봅니다.

## 프론트엔드에서 해야 할 일

### 1. 타입 확인

파일:

- `frontend/components/analysis/types.ts`

확인할 타입:

- `CompareResponse`
- `AlignmentFrame`
- `JudgementSummary`

### 2. 기준 멜로디 준비

초기 구현에서는 실제 MIDI 업로드보다 고정된 `reference_pitch` JSON을 사용하는 방식이 안전합니다.

```json
[
  { "time": 0.0, "midi_note": 60 },
  { "time": 0.5, "midi_note": 62 },
  { "time": 1.0, "midi_note": 64 }
]
```

### 3. `/api/compare` 호출

업로드 성공 후 받은 `uploadResult.pitch`를 `user_pitch`로 전달합니다.

```text
uploadResult.pitch -> /api/compare -> compareResult
```

### 4. 화면 표시

표시할 항목:

- 정확도 `accuracy_percent`
- 평균 cent 오차 `avg_cent_error`
- 최대 높은 오차 `max_positive_cent_error`
- 최대 낮은 오차 `max_negative_cent_error`
- 사용자 pitch와 기준 melody overlay

## 추천 구현 순서

1. `CompareResponse` 타입 확인
2. 고정된 `reference_pitch` 샘플 준비
3. 업로드 성공 후 `/api/compare` 호출
4. `CompareSummary`에 정확도와 오차 표시
5. `PianoRoll`에 기준 멜로디 overlay 추가
6. 오류와 로딩 상태 처리

## 아직 없는 것

아직 Step 3 1차 구현 범위에 없는 것:

- 실제 MIDI 파일 업로드
- 기준 멜로디 DB
- 곡 선택 UI
- 구간별 상세 피드백
- 사용자별 기록 저장

## 참고 파일

- `backend/api/compare.py`
- `backend/core/aligner.py`
- `step3-api-compare-spec.md`
- `frontend/components/analysis/types.ts`
- `frontend/components/analysis/PianoRoll.tsx`
- `frontend/components/analysis/CompareSummary.tsx`
