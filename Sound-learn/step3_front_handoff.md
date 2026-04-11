# Step 3 Front Handoff

**작성일:** 2026-04-12
**대상:** 프론트 담당자
**목적:** 현재 백엔드 Step 3 구현 상태와 프론트에서 바로 이어서 볼 포인트를 짧게 정리

---

## 현재 백엔드 상태

Step 3 백엔드 1차 구현이 들어가 있습니다.

추가된 것:

- `/api/compare` 엔드포인트
- DTW 정렬 로직
- `±100 cent` 기준 판정 로직
- 비교 결과 summary 계산

Step 2의 `/api/upload`는 그대로 유지됩니다.

---

## 새 API

### 엔드포인트

```text
POST /api/compare
```

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

### 응답 핵심 필드

```json
{
  "user_pitch": [],
  "reference_pitch": [],
  "alignment": [],
  "judgement": {
    "correct_frames": 0,
    "total_compared_frames": 0,
    "accuracy_percent": 0,
    "avg_cent_error": 0
  }
}
```

상세 명세:

- `backend_api_step3_spec.md` 참고

---

## 프론트에서 바로 볼 것

### 1. 타입

이미 Step 3 응답 타입 초안이 추가되어 있습니다.

파일:

- `frontend/components/analysis/types.ts`

추가된 타입:

- `CompareResponse`
- `AlignmentFrame`
- `JudgementSummary`

---

### 2. 아직 프론트에 없는 것

현재는 백엔드만 구현된 상태입니다.

아직 프론트에 없는 것:

- `reference_pitch` 입력 UI
- `/api/compare` 호출 UI
- 기준 melody overlay 시각화
- Step 3 비교 결과 카드

---

## 프론트 권장 작업 순서

1. `CompareResponse` 타입 확인
2. 데모용 `reference_pitch` JSON 하나 준비
3. 기존 `PianoRoll`에 `referenceData`를 같이 넣어보는 방향 검토
4. accuracy / cent error 요약 카드 추가 여부 판단
5. `/api/compare` 호출 데모 화면 또는 버튼 추가

---

## 권장 구현 방향

- Step 3 첫 프론트는 복잡한 MIDI 업로드 UI보다
- **고정된 `reference_pitch` 데모 데이터로 compare 호출**
- 그 다음 `PianoRoll`에 user/reference 두 개를 겹쳐 그리는 방향이 가장 안전합니다.

---

## 참고 파일

- `backend/api/compare.py`
- `backend/core/aligner.py`
- `backend_api_step3_spec.md`
- `frontend/components/analysis/types.ts`
- `sunhan_step3.md`
