# Sound-Learn 로드맵 요약

이 문서는 루트 `roadmap.md`의 하위 프로젝트용 요약본입니다. 실제 개발 기준은 루트 `roadmap.md`와 각 Step 문서를 함께 확인합니다.

## 목표

사용자의 보컬 녹음 또는 오디오 파일을 분석해 기준 멜로디와 비교하고, 피치/리듬/음역 정보를 시각화한 뒤 AI 피드백을 제공하는 앱을 완성합니다.

## 단계별 진행

| Step | 목표 | 핵심 기능 | 상태 |
| --- | --- | --- | --- |
| Step 1 | MVP 환경 구축 | 녹음, 업로드, 피치 추출 | 완료 |
| Step 2 | 시각화 기반 구축 | `pitch`, `summary`, Piano Roll | 완료 |
| Step 3 | 비교 알고리즘 | DTW, cent 오차, 정확도 계산 | 1차 구현 |
| Step 4 | AI 피드백 | `/api/feedback`, 리포트 UI | 구현 진행 |
| Step 5 | 안정화/배포 | 테스트, 배포, 발표 준비 | 예정 |

## 앱 기능 확장 순서

1. 오디오 입력
   - 마이크 녹음
   - WAV/MP3/WebM 업로드

2. 피치 추출
   - 오디오 정규화
   - `librosa.pyin`
   - MIDI note 변환

3. 결과 표시
   - 분석 요약
   - Piano Roll
   - 무성 구간 처리

4. 기준 멜로디 비교
   - `reference_pitch`
   - DTW 정렬
   - cent 오차 계산

5. AI 리포트
   - 분석 결과 요약
   - 잘한 점/개선점/연습 팁
   - 집중 연습 구간

6. 배포와 발표
   - 프론트엔드 빌드 확인
   - 백엔드 환경변수 정리
   - 시연 시나리오 작성

## 문서 연결

- 전체 개요: `README.md`
- Step 1: `step1-completion-report.md`
- Step 2: `step2-completion-report.md`, `step2-backend-milestones.md`, `step2-change-summary.md`
- Step 3: `step3-frontend-handoff.md`, `step3-api-compare-spec.md`
- Step 4: `step4-requirements.md`, `step4-meta-prompt.md`
