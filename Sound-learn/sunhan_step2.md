# Sunhan Step 2 작업 순서 — Backend

**작성일:** 2026-04-11
**대상:** Sound-Learn Step 2 백엔드 작업
**목적:** Step 2를 실제로 진행할 때, 처음부터 완료까지 해야 할 일을 순서대로 정리

---

## Step 2 백엔드 작업 순서

### 1. `/api/upload` 응답 스키마 최종 확정

- [x] 성공 응답 필드 최종 확인
- [x] `pitch` 배열 구조 최종 확인
- [x] `summary` 객체 구조 최종 확인
- [x] 프론트 타입과 백엔드 응답이 일치하는지 확인

확정된 응답 구조:

- `filename`
- `duration_sec`
- `original_sr`
- `normalized_sr`
- `pitch: PitchFrame[]`
- `summary: PitchSummary`

`PitchFrame` 필드:

- `time: number`
- `frequency: number | null`
- `midi_note: number | null`

`PitchSummary` 필드:

- `voiced_frames: number`
- `total_frames: number`
- `min_frequency: number | null`
- `max_frequency: number | null`
- `min_midi: number | null`
- `max_midi: number | null`
- `avg_frequency: number | null`

### 2. pitch 데이터 규칙 정리

- [x] `time` 값 생성 기준 정리
- [x] `frequency` 반올림 기준 정리
- [x] `midi_note` 반올림 기준 정리
- [x] 무성 구간 `null` 처리 기준 정리

정리된 규칙:

- `time`
  - `librosa.times_like()`로 생성
  - 샘플레이트 `22050Hz`, `hop_length=512` 기준
  - 프레임 간격은 약 `23ms`
  - 소수 셋째 자리까지 반올림

- `frequency`
  - `librosa.pyin()`으로 추출한 `f0` 사용
  - 유성 프레임만 값 유지
  - 소수 둘째 자리까지 반올림
  - 무성 프레임이면 `null`

- `midi_note`
  - 공식 `69 + 12 * log2(freq / 440)` 사용
  - 소수 첫째 자리까지 반올림
  - `frequency`가 `null`이면 같이 `null`

- 무성 구간 `null` 처리 기준
  - `voiced_flag == False`
  - `f0`가 `NaN`
  - 전후가 모두 무성인 단발 유성 프레임은 노이즈로 보고 제거
  - 전후 유성 프레임 대비 `±6 semitone` 초과 점프는 이상치로 보고 제거

- 스무딩 규칙
  - 전후가 모두 유성인 1프레임 무성 구간은 선형 보간

### 3. summary 계산 기준 정리

- [x] `voiced_frames` 계산 기준 확인
- [x] `total_frames` 계산 기준 확인
- [x] `min_frequency` 계산 기준 확인
- [x] `max_frequency` 계산 기준 확인
- [x] `min_midi` 계산 기준 확인
- [x] `max_midi` 계산 기준 확인
- [x] `avg_frequency` 계산 기준 확인

정리된 규칙:

- `voiced_frames`
  - `pitch_data` 중 `frequency != null` 인 프레임 개수

- `total_frames`
  - `pitch_data` 전체 프레임 개수

- `min_frequency`
  - 유성 프레임의 `frequency` 최소값
  - 소수 둘째 자리까지 반올림
  - 유성 프레임이 없으면 `null`

- `max_frequency`
  - 유성 프레임의 `frequency` 최대값
  - 소수 둘째 자리까지 반올림
  - 유성 프레임이 없으면 `null`

- `min_midi`
  - 유성 프레임의 `midi_note` 최소값
  - 유성 프레임이 없으면 `null`

- `max_midi`
  - 유성 프레임의 `midi_note` 최대값
  - 유성 프레임이 없으면 `null`

- `avg_frequency`
  - 유성 프레임의 `frequency` 평균값
  - 소수 둘째 자리까지 반올림
  - 유성 프레임이 없으면 `null`

### 4. 실제 오디오 업로드 테스트

- [x] WAV 파일 테스트
- [x] MP3 파일 테스트
- [x] WebM 파일 테스트
- [x] 짧은 파일 테스트
- [x] 긴 파일 테스트

테스트 결과:

- `tone_short.wav` 업로드 성공 (`200`)
- `tone_long.wav` 업로드 성공 (`200`)
- `silence.wav` 업로드 성공 (`200`)
- 실제 MP3 파일 업로드 후 결과 화면 표시 확인
- 실제 WebM 파일 업로드 후 결과 화면 표시 확인

### 5. pitch 품질 확인

- [x] 음정 값이 과하게 튀지 않는지 확인
- [x] 무성 구간이 잘 `null` 처리되는지 확인
- [x] 프레임 간격이 시각화에 적절한지 확인
- [x] 프론트 Piano Roll에서 자연스럽게 보이는지 확인

확인 결과:

- 440Hz tone 파일에서 `frequency`가 안정적으로 `439.96` 근처로 유지됨
- silence 파일에서 전 프레임이 `null`로 반환됨
- `hop_length=512`, `22050Hz` 기준 약 `23ms` 프레임 간격 확인

### 6. 예외 케이스 테스트

- [x] 지원하지 않는 확장자 업로드
- [x] 파일명 없는 요청 테스트
- [x] 50MB 초과 파일 테스트
- [x] 디코딩 불가 파일 테스트
- [ ] 피치 추출 실패 상황 확인

확인된 응답:

- 지원하지 않는 확장자: `422`
- 파일명 없음: `422`
- 50MB 초과: `422`
- 디코딩 불가 파일: `422`

### 7. 임시 파일 처리 점검

- [x] 업로드 시 temp 파일이 생성되는지 확인
- [x] 분석 후 temp 파일이 삭제되는지 확인
- [x] 실패 상황에서도 temp 파일이 남지 않는지 확인

확인 결과:

- 테스트 후 `backend/temp`에는 `.gitkeep`만 남음

### 8. 프론트 연동 확인

- [x] 업로드 후 `PianoRoll`이 실제 응답으로 렌더링되는지 확인
- [x] `AnalysisSummary`가 summary 데이터를 정상 표시하는지 확인
- [x] 녹음 업로드와 파일 업로드가 둘 다 정상 동작하는지 확인

확인 결과:

- `tone_short.wav` 업로드 시 수평에 가까운 440Hz 그래프 정상 표시
- 실제 녹음 업로드 시 구간별로 변하는 pitch 그래프 정상 표시
- 실제 WAV 파일 업로드 시 음성 구간이 분절된 형태로 정상 표시
- `AnalysisSummary`의 길이 / 감지 프레임 / 음역 범위가 모두 표시됨
- 상태 문구 `WAV 변환 중...`, `분석 중...`, `분석 완료 (...)` 표시 개선 완료

### 9. 로컬 개발 환경 점검

- [x] CORS 설정 확인
- [x] `localhost`와 `127.0.0.1` 환경 모두 점검
- [x] 프론트와 백엔드 동시 실행 시 문제 없는지 확인

확인 결과:

- `Origin: http://localhost:3000` preflight 통과
- `Origin: http://127.0.0.1:3001` preflight 통과
- 프론트 `3000`, 백엔드 `8000` 동시 실행 확인

### 10. Step 2용 샘플 응답 정리

- [x] 성공 응답 예시 JSON 저장
- [x] 오류 응답 예시 JSON 저장
- [x] 발표/보고용 샘플 결과 확보

저장 위치:

- `test_assets/api_samples/upload_success_tone_short.json`
- `test_assets/api_samples/error_invalid_extension.json`
- `test_assets/api_samples/error_too_large.json`

### 11. API 문서 정리

- [x] `/api/upload` 요청 형식 문서화
- [x] 응답 필드 문서화
- [x] 오류 응답 문서화
- [x] null 처리 규칙 문서화

문서:

- `backend_api_step2_spec.md`

### 12. MIDI overlay 대비 구조 초안 작성

- [x] 향후 기준 멜로디 데이터 구조 초안 작성
- [x] `reference_pitch` 필드 후보 정리
- [x] Step 3 확장 가능한 응답 형태 메모

정리 위치:

- `backend_api_step2_spec.md`의 향후 확장 포인트 섹션

### 13. Step 2 완료 체크

- [x] 실제 업로드 결과로 프론트 시각화 성공
- [x] 주요 예외 상황에서 서버가 안정적으로 응답
- [x] Step 2 백엔드 문서 정리 완료

### 14. 완료 보고 정리

- [x] Step 2에서 구현한 백엔드 기능 요약
- [x] 테스트 결과 요약
- [x] 남은 리스크 정리
- [x] Step 3로 넘길 항목 정리

---

## 우선순위 요약

### 현재 상태

- [x] `/api/upload` 응답 구조 확정
- [x] 실제 업로드 테스트
- [x] 프론트 시각화 연결 확인
- [x] 예외 케이스 테스트
- [x] 문서화
- [x] Step 3 확장 초안 작성

---

## 완료 기준 한 줄 정리

Step 2 백엔드는 **“업로드한 오디오를 안정적으로 분석해서 프론트 Piano Roll에 바로 그릴 수 있는 pitch 데이터와 summary를 제공하는 상태”**가 되면 완료다.

---

## Step 2 완료 상태

현재 Step 2 백엔드는 완료 상태로 본다.

완료 근거:

- `/api/upload` 응답 스키마 확정
- pitch / summary 규칙 정리 완료
- WAV / MP3 / WebM 업로드 결과 확인
- 실제 녹음 업로드 확인
- `PianoRoll` / `AnalysisSummary` 렌더링 확인
- 예외 응답 검증 완료
- API 문서 및 샘플 응답 정리 완료

Step 2 완료 후 참고 메모:

- 인위적으로 `pitch 추출 실패(500)`를 재현하는 테스트는 별도 테스트 작업으로 분리 가능

---

## 역할 분리 정리

### 내가 할 수 있는 것

- [x] 백엔드 서버 실행 및 상태 확인
- [x] `/api/upload` API 호출 테스트
- [x] WAV 기반 업로드 성공 케이스 검증
- [x] 잘못된 확장자 / 용량 초과 / 디코딩 실패 검증
- [x] temp 파일 정리 여부 확인
- [x] CORS 동작 확인
- [x] 응답 JSON 샘플 저장
- [x] Step 2 문서화

### 내가 추가로 할 수 있는 것

- [x] 네가 올려준 실제 MP3 파일로 업로드 테스트
- [x] 네가 올려준 실제 WebM 파일로 업로드 테스트
- [ ] 필요하면 `500` 재현용 테스트 코드를 임시로 넣어서 서버 오류 경로 검증
- [ ] 프론트 연동 중 깨지는 부분이 있으면 코드 수정

### 네가 직접 확인해야 하는 것

- [x] 브라우저에서 실제 `PianoRoll`이 보이는지 확인
- [x] 브라우저에서 `AnalysisSummary`가 정상 표시되는지 확인
- [x] 실제 마이크 녹음 후 업로드가 되는지 확인
- [x] 실제 MP3 파일 선택 업로드가 되는지 확인
- [x] 실제 WebM 파일 선택 업로드가 되는지 확인

---

## 네가 직접 확인해야 하는 항목 상세 가이드

### 1. 브라우저에서 `PianoRoll` 확인

#### 목적

백엔드가 돌려준 `pitch` 배열이 프론트에서 실제 그래프로 렌더링되는지 확인

#### 방법

1. 브라우저에서 `http://127.0.0.1:3000` 접속
2. 메인 화면이 뜨면 `파일 선택` 버튼 클릭
3. 아래 파일 중 하나 선택
   - `/home/sunhan/Sound-learn/Sound-learn/test_assets/tone_short.wav`
   - `/home/sunhan/Sound-learn/Sound-learn/test_assets/tone_long.wav`
4. 업로드 후 결과 화면으로 전환되는지 확인
5. 아래를 체크
   - 그래프가 아예 안 비는지
   - 에러 메시지가 없는지
   - 직선 혹은 연속된 음정선이 보이는지
   - 긴 파일은 그래프가 너무 깨지지 않는지

#### 정상 기준

- 업로드 후 결과 화면이 바로 나타남
- `PianoRoll` 영역이 비어 있지 않음
- tone 파일이면 거의 일정한 음높이 라인이 보임

---

### 2. 브라우저에서 `AnalysisSummary` 확인

#### 목적

백엔드 `summary` 값이 프론트 요약 카드에 제대로 들어가는지 확인

#### 방법

1. 위와 같은 방식으로 `tone_short.wav` 업로드
2. 결과 화면 상단 혹은 요약 카드 영역 확인
3. 아래 항목이 비정상적으로 비어 있거나 `undefined`로 보이지 않는지 체크
   - duration
   - voiced frames
   - total frames
   - min/max frequency
   - avg frequency

#### 정상 기준

- 숫자 값이 정상 출력됨
- `undefined`, `NaN`, 빈칸 같은 이상값이 없음

---

### 3. 실제 마이크 녹음 업로드 확인

#### 목적

브라우저 녹음 → WebM 생성 → WAV 변환 → 백엔드 업로드까지 전체 흐름 확인

#### 방법

1. `http://127.0.0.1:3000` 접속
2. `녹음 시작` 버튼 클릭
3. 브라우저가 마이크 권한을 물으면 `허용`
4. 2~3초 정도 일정한 음으로 허밍하거나 소리를 냄
5. `녹음 중지` 버튼 클릭
6. 상태 문구를 확인
   - `WAV 변환 중...`
   - `분석 중...`
   - `분석 완료 (...)`
7. 결과 화면이 뜨는지 확인

#### 정상 기준

- 마이크 권한 허용 후 녹음 시작됨
- 중지 후 자동 업로드 진행
- 결과 화면 전환 성공
- 오류 메시지가 없음

#### 실패 시 체크할 것

- 브라우저 콘솔 에러
- 마이크 권한 거부 여부
- 백엔드 서버 실행 여부

---

### 4. 실제 MP3 파일 업로드 확인

#### 목적

확장자뿐 아니라 실제 인코딩된 MP3 파일이 정상 디코딩되는지 확인

#### 방법

1. 실제 MP3 파일 하나 준비
2. 브라우저에서 `파일 선택` 클릭
3. MP3 파일 업로드
4. 결과 화면 또는 오류 메시지 확인
5. 아래를 같이 확인
   - 그래프가 직선 하나로만 보이는지
   - 음역 범위가 한 음만 나오는지
   - 실제 보컬처럼 구간별 변화가 보이는지

#### 정상 기준

- 업로드 후 분석 완료
- 결과 화면 표시
- `422 오디오 파일을 디코딩할 수 없습니다.`가 나오지 않음
- 보컬 파일이면 그래프가 완전한 직선 하나가 아니라 구간별 변화가 보임

#### 추천 테스트 파일 조건

- 3~10초 정도 짧은 보컬 또는 단일 음 파일
- 너무 큰 파일 말고 10MB 이하 권장

---

### 5. 실제 WebM 파일 업로드 확인

#### 목적

실제 브라우저 녹음 파일 또는 WebM 파일이 정상 처리되는지 확인

#### 방법

1. 브라우저 녹음으로 생성한 파일이 있거나, 실제 WebM 파일 준비
2. `파일 선택`으로 업로드
3. 분석 완료 여부 확인
4. 그래프와 요약이 정상 표시되는지 확인

#### 정상 기준

- 업로드 후 분석 성공
- 결과 화면 표시
- 디코딩 오류 없음
- `PianoRoll`과 `AnalysisSummary`가 함께 표시됨

---

### 6. 확인 후 나한테 알려줘야 하는 것

아래 형식으로 보내주면 내가 바로 다음 작업 이어서 할 수 있다.

```text
PianoRoll: 정상 / 이상
AnalysisSummary: 정상 / 이상
녹음 업로드: 정상 / 이상
MP3 업로드: 정상 / 이상
WebM 업로드: 정상 / 이상
에러 메시지: (있으면 그대로 복붙)
```

---

## 지금 기준 결론

Step 2 백엔드는 서버/API/문서 기준으로 대부분 정리됐고, 현재 남은 핵심은 **브라우저에서 실제 업로드와 렌더링을 확인하는 사용자 검증 단계**다.

---

## Step 2 종료 메모

Step 2 백엔드는 완료 처리한다.

Step 3로 넘길 때 바로 이어서 볼 항목:

- 기준 MIDI 데이터 구조 설계
- `reference_pitch` 응답 포맷 구체화
- 사용자 pitch와 기준 멜로디 비교 로직 설계
- DTW 정렬 로직 분리
