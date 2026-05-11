# Sound-Learn 문서 안내

Sound-Learn은 사용자의 노래 또는 음성 녹음을 분석해 기준 멜로디와 비교하고, 피치 정확도와 리듬 차이를 시각화한 뒤 AI 피드백을 제공하는 보컬 학습 앱입니다.

## 먼저 볼 문서

| 문서 | 용도 |
| --- | --- |
| `Sound-learn/README.md` | 프로젝트 전체 개요, 앱 흐름, 기능, 실행 방법 |
| `roadmap.md` | 12주 개발 로드맵 |
| `codex-step-checklist.md` | Codex로 Step 작업을 이어갈 때 쓰는 체크리스트 |
| `Sound-learn/step1-completion-report.md` | Step 1 완료 내용: 녹음, 업로드, 기본 피치 추출 |
| `Sound-learn/step2-completion-report.md` | Step 2 완료 내용: 업로드 응답, 피치 요약, Piano Roll 연동 |
| `Sound-learn/step3-frontend-handoff.md` | Step 3 프론트 인계 내용: `/api/compare`, DTW 비교 결과 |
| `Sound-learn/step4-requirements.md` | Step 4 요구사항: AI 피드백, 리포트 UI |

## 앱 진행 흐름

1. 사용자가 브라우저에서 마이크로 녹음하거나 오디오 파일을 선택합니다.
2. 프론트엔드가 오디오를 백엔드 `/api/upload`로 전송합니다.
3. 백엔드가 오디오를 22050Hz 모노 WAV 기준으로 정규화하고 `librosa.pyin`으로 피치를 추출합니다.
4. 프론트엔드가 `AnalysisSummary`와 `PianoRoll`로 분석 결과를 보여줍니다.
5. 백엔드 `/api/compare`가 사용자 피치와 기준 멜로디를 DTW로 정렬하고 cent 오차와 정확도를 계산합니다.
6. 백엔드 `/api/feedback`이 비교 결과를 요약해 OpenAI API로 AI 피드백을 생성합니다.
7. 프론트엔드가 분석 요약, 비교 점수, Piano Roll, AI 리포트를 한 화면에 표시합니다.

## 현재 구현된 주요 기능

- 마이크 녹음 및 WAV/MP3/WebM 파일 업로드
- 오디오 정규화 및 임시 파일 정리
- 피치 프레임 추출: `time`, `frequency`, `midi_note`
- 무성 구간 `null` 처리
- 분석 요약: 감지 프레임 수, 전체 프레임 수, 최저/최고/평균 주파수
- Piano Roll 시각화
- 기준 멜로디와 사용자 피치 비교
- DTW 기반 정렬 및 `100 cent` 기준 정답 판정
- AI 피드백 리포트 생성 및 표시

## 실행 위치

실제 앱 코드는 `Sound-learn/` 폴더 안에 있습니다.

```bash
cd Sound-learn
```

백엔드와 프론트엔드 실행 방법은 `Sound-learn/README.md`를 기준으로 확인하면 됩니다.
