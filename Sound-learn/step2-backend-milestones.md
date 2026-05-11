# Step 2 백엔드 마일스톤: Piano Roll 시각화 지원

작성일: 2026-04-11  
대상: Backend, FastAPI/Python  
목적: 프론트엔드가 업로드 결과만으로 Piano Roll을 안정적으로 렌더링할 수 있도록 백엔드 응답과 검증 기준을 정리합니다.

## Step 2 백엔드 목표

- `/api/upload` 응답을 프론트엔드 UI 계약으로 고정합니다.
- 피치 프레임을 일정한 형식으로 반환합니다.
- 요약 통계를 함께 반환합니다.
- 오류 케이스에서도 서버가 죽지 않고 명확한 응답을 반환합니다.
- Step 3에서 기준 멜로디 overlay와 비교 로직으로 확장할 수 있게 구조를 준비합니다.

## 현재 완료 상태

완료된 항목:

- FastAPI 서버 실행
- `/api/upload` 구현
- WAV/MP3/WebM 업로드 검증
- 22050Hz 모노 리샘플링
- `librosa.pyin` 기반 피치 추출
- 무성 구간 `null` 처리
- `pitch` 배열 반환
- `summary` 객체 반환
- CORS 개발 환경 반영
- 프론트엔드 `PianoRoll` 렌더링 확인

## 완료 조건

Step 2 백엔드는 아래 조건을 만족하면 완료로 봅니다.

- [x] 프론트엔드가 `/api/upload` 응답만으로 사용자 pitch를 시각화할 수 있다.
- [x] pitch frame 스키마와 null 처리 규칙이 문서화되어 있다.
- [x] 시각화에 필요한 요약값이 일관되게 반환된다.
- [x] 주요 예외 케이스 테스트 결과가 있다.
- [x] Step 3 확장을 위한 기준 멜로디 응답 구조 초안이 있다.

## 마일스톤 1: API 응답 계약 고정

필수 필드:

```json
{
  "filename": "recording.wav",
  "duration_sec": 5.217,
  "original_sr": 44100,
  "normalized_sr": 22050,
  "pitch": [],
  "summary": {}
}
```

완료 기준:

- [x] 프론트엔드 담당자가 별도 문의 없이 응답 구조를 이해할 수 있다.
- [x] 성공/실패 응답 예시가 문서화되어 있다.
- [x] 필드명 변경 없이 프론트엔드와 연결된다.

## 마일스톤 2: Pitch 데이터 검증

검증 기준:

- `time` 간격이 약 23ms 기준으로 일관된다.
- `frequency`는 Hz 단위이며 무성 구간은 `null`이다.
- `midi_note`는 MIDI note number이며 무성 구간은 `null`이다.
- 프레임 수가 과도하게 많아 렌더링을 방해하지 않는다.
- silence 입력에서 잘못된 유성 프레임이 대량 발생하지 않는다.

완료 기준:

- [x] 440Hz tone에서 거의 일정한 수평 피치가 나온다.
- [x] 실제 녹음에서 구간별 피치 변화가 보인다.
- [x] silence는 대부분 `null`로 처리된다.

## 마일스톤 3: 예외 처리

검증할 케이스:

- 지원하지 않는 확장자
- 50MB 초과 파일
- 디코딩 불가 파일
- 파일명 없음
- 무성 오디오
- 분석 중 오류
- 임시 파일 정리

완료 기준:

- [x] 주요 실패 상황에서 422 또는 명확한 오류를 반환한다.
- [x] 실패 상황에서도 서버 프로세스가 죽지 않는다.
- [x] 임시 파일이 남지 않는다.

## 마일스톤 4: 프론트엔드 연동

확인 항목:

- [x] 실제 `/api/upload` 응답으로 `PianoRoll`이 그려진다.
- [x] `duration_sec`과 frame 수가 화면 표시와 맞는다.
- [x] `summary` 값이 `AnalysisSummary`에 정상 반영된다.
- [x] `localhost`와 `127.0.0.1` CORS 환경에서 동작한다.
- [x] 녹음 업로드와 파일 업로드가 모두 동작한다.

## 마일스톤 5: Step 3 준비

Step 3 확장 초안:

```json
{
  "reference_pitch": [
    { "time": 0.0, "midi_note": 60 }
  ],
  "segments": [],
  "meta": {
    "song_id": "demo-song",
    "key": "C",
    "tempo": 120
  }
}
```

Step 3에서 할 일:

- 기준 멜로디 `reference_pitch` 입력 정의
- 사용자 `pitch`와 기준 멜로디를 DTW로 정렬
- cent 오차 계산
- 정확도 요약 반환

## 참고 파일

- `backend/main.py`
- `backend/api/upload.py`
- `backend/core/pitch_engine.py`
- `backend/core/config.py`
- `frontend/components/analysis/PianoRoll.tsx`
- `frontend/components/analysis/AnalysisSummary.tsx`
- `step2-api-upload-spec.md`
