# Step 2 완료 보고서: 백엔드 응답 정리와 Piano Roll 연동

작성일: 2026-04-11  
대상: Sound-Learn Step 2 백엔드 및 프론트 연동  
목표: 업로드된 오디오의 피치 데이터를 프론트엔드가 안정적으로 시각화할 수 있는 응답 구조로 확정합니다.

## Step 2 목표

Step 1이 “업로드와 피치 추출이 가능하다”는 단계였다면, Step 2는 “추출된 피치를 실제 화면에서 볼 수 있다”는 단계입니다.

핵심 목표:

- `/api/upload` 응답 스키마 확정
- `pitch` 프레임 데이터 규칙 정리
- `summary` 통계 추가
- 실제 WAV/MP3/WebM 파일 업로드 검증
- `PianoRoll`과 `AnalysisSummary` 연동 확인

## 최종 `/api/upload` 응답 구조

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

## `pitch` 규칙

| 필드 | 규칙 |
| --- | --- |
| `time` | `22050Hz`, `hop_length=512` 기준 약 23ms 간격 |
| `frequency` | `librosa.pyin`으로 추출한 Hz 값, 소수 둘째 자리 반올림 |
| `midi_note` | `69 + 12 * log2(freq / 440)` 공식 사용, 소수 첫째 자리 반올림 |
| 무성 구간 | `frequency`, `midi_note` 모두 `null` |

추가 처리:

- 앞뒤가 모두 무성인 단일 유성 프레임은 노이즈로 보고 제거합니다.
- 앞뒤 유성 프레임과 6 semitone 이상 차이나는 튐 값은 이상치로 제거합니다.
- 앞뒤가 유성인 1프레임 무성 구간은 선형 보간합니다.

## `summary` 규칙

| 필드 | 설명 |
| --- | --- |
| `voiced_frames` | `frequency != null`인 프레임 수 |
| `total_frames` | 전체 프레임 수 |
| `min_frequency` | 유성 프레임의 최저 주파수 |
| `max_frequency` | 유성 프레임의 최고 주파수 |
| `min_midi` | 유성 프레임의 최저 MIDI note |
| `max_midi` | 유성 프레임의 최고 MIDI note |
| `avg_frequency` | 유성 프레임의 평균 주파수 |

유성 프레임이 하나도 없으면 최저/최고/평균 값은 `null`입니다.

## 검증한 업로드 케이스

| 케이스 | 결과 |
| --- | --- |
| 짧은 WAV tone | 200 성공 |
| 긴 WAV tone | 200 성공 |
| silence WAV | 200 성공, 전체 `null` 처리 |
| 실제 MP3 | 결과 화면 표시 확인 |
| 실제 WebM | 결과 화면 표시 확인 |
| 지원하지 않는 확장자 | 422 |
| 파일명 없음 | 422 |
| 50MB 초과 | 422 |
| 디코딩 불가 파일 | 422 |

## 프론트엔드 연동 확인

확인한 항목:

- `PianoRoll`이 실제 `/api/upload` 응답의 `pitch` 배열로 렌더링됩니다.
- `AnalysisSummary`가 `summary` 값을 정상 표시합니다.
- 녹음 파일, WAV, MP3, WebM 업로드 후 결과 화면으로 이동합니다.
- 처리 상태 문구가 사용자에게 표시됩니다.
- CORS는 `localhost`와 `127.0.0.1` 개발 환경을 허용합니다.

## Step 2 완료 기준

- [x] `/api/upload` 응답 구조가 확정되었습니다.
- [x] `pitch`와 `summary` 규칙이 문서화되었습니다.
- [x] 실제 오디오 업로드 결과가 Piano Roll에 표시됩니다.
- [x] 주요 오류 케이스가 422 또는 명확한 오류로 처리됩니다.
- [x] 임시 파일이 처리 후 정리됩니다.
- [x] Step 3 확장을 위한 기준 멜로디 구조 초안이 준비되었습니다.

## Step 3로 넘긴 작업

- 기준 멜로디 `reference_pitch` 구조 구체화
- 사용자 `pitch`와 기준 멜로디 비교
- DTW 정렬 로직 분리
- cent 오차와 정확도 계산
- 비교 결과를 프론트엔드에서 표시
