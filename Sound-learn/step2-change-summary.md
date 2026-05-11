# Step 2 변경점 요약

작성일: 2026-04-12  
기준 비교: Step 1 대비 Step 2에서 달라진 점

## 핵심 요약

Step 1은 “오디오 업로드와 피치 추출이 가능하다”는 단계였습니다.  
Step 2는 “추출한 피치 결과를 프론트엔드에서 실제 Piano Roll과 요약 정보로 볼 수 있다”는 단계로 확장되었습니다.

## Step 1과 Step 2 차이

| 구분 | Step 1 | Step 2 |
| --- | --- | --- |
| 백엔드 응답 | 업로드와 분석 기반 최소 응답 | `pitch` + `summary` 정식 응답 |
| 피치 데이터 | 추출 가능 여부 중심 | 화면 렌더링 가능한 스키마로 확정 |
| 프론트 화면 | 녹음/업로드 중심 | 분석 결과 화면 추가 |
| 시각화 | 없음 또는 데모 수준 | 실제 `PianoRoll` 렌더링 |
| 요약 정보 | 제한적 | 길이, 감지 프레임, 음역 범위 표시 |
| 검증 범위 | 업로드 성공 여부 중심 | 실제 사용자 흐름과 오류 케이스 검증 |

## 백엔드 변경점

### 1. `/api/upload` 응답 스키마 확정

Step 2부터 `/api/upload`는 프론트엔드 UI 계약 역할을 합니다.

```json
{
  "filename": "recording.wav",
  "duration_sec": 3.3,
  "original_sr": 44100,
  "normalized_sr": 22050,
  "pitch": [],
  "summary": {}
}
```

### 2. `pitch` 데이터 규칙 명확화

- `time`: 약 23ms 간격
- `frequency`: 소수 둘째 자리 반올림
- `midi_note`: 소수 첫째 자리 반올림
- 무성 구간: `null`
- 튀는 프레임 제거
- 짧은 무성 구간 보정

### 3. `summary` 추가

프론트엔드 결과 카드에 필요한 값을 백엔드가 계산합니다.

- `voiced_frames`
- `total_frames`
- `min_frequency`
- `max_frequency`
- `min_midi`
- `max_midi`
- `avg_frequency`

### 4. 예외 케이스 검증 강화

검증 대상:

- 잘못된 확장자
- 파일명 없음
- 50MB 초과
- 디코딩 불가 파일
- silence 입력
- 임시 파일 정리

## 프론트엔드 변경점

### 1. 결과 화면 사용 시작

업로드가 끝나면 결과 화면으로 전환됩니다.

표시 항목:

- 녹음 길이
- 음성이 감지된 프레임 수
- 음역 범위
- 평균 주파수
- Piano Roll

### 2. `PianoRoll` 실제 데이터 연동

더 이상 데모 값만 사용하는 것이 아니라 `/api/upload` 응답의 `pitch` 배열을 그대로 사용합니다.

검증한 케이스:

- 440Hz tone: 거의 수평 직선
- 실제 녹음: 구간별 피치 변화
- silence: 무성 구간 처리
- WAV/MP3/WebM 업로드

### 3. 사용자 상태 문구 개선

처리 중 상태를 더 명확히 표시합니다.

- WAV 변환 중
- 분석 중
- 분석 완료
- 오류 메시지

## Step 2 산출물

| 산출물 | 설명 |
| --- | --- |
| `step2-completion-report.md` | Step 2 완료 보고서 |
| `step2-api-upload-spec.md` | `/api/upload` 명세 |
| `step2-change-summary.md` | Step 1 대비 Step 2 변경 요약 |
| `test_assets/api_samples/` | 성공/오류 응답 샘플 |

## Step 3 준비 상태

Step 2 완료로 다음 작업을 시작할 수 있습니다.

- 기준 멜로디 데이터 정의
- 사용자 피치와 기준 멜로디 비교
- DTW 정렬
- cent 오차 계산
- 비교 결과 시각화
