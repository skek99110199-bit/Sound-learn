# Codex Step 작업 체크리스트

이 문서는 Codex로 Sound-Learn의 Step 작업을 이어갈 때 매번 확인해야 할 절차를 정리한 문서입니다.

## 작업 전 필수 확인

1. 최신 코드와 문서를 먼저 확인합니다.
2. `Sound-learn/README.md`를 읽고 전체 앱 흐름을 파악합니다.
3. 현재 작업하려는 Step 문서를 읽습니다.
4. 이미 구현된 API와 컴포넌트가 있는지 코드에서 확인합니다.
5. 작업 전 계획을 세우고, 결정이 필요한 부분은 먼저 정리합니다.

## 권장 확인 순서

```text
1. 루트 README.md
2. Sound-learn/README.md
3. roadmap.md
4. 현재 Step 문서
5. 관련 API 명세 문서
6. 실제 코드
```

## Step별 기준 문서

| Step | 기준 문서 | 핵심 내용 |
| --- | --- | --- |
| Step 1 | `Sound-learn/step1-completion-report.md` | 녹음, 업로드, 피치 추출 기반 구축 |
| Step 2 | `Sound-learn/step2-completion-report.md` | 피치 응답 스키마 확정, Piano Roll 연동 |
| Step 3 | `Sound-learn/step3-frontend-handoff.md` | `/api/compare`, DTW 정렬, 정확도 계산 |
| Step 4 | `Sound-learn/step4-requirements.md` | `/api/feedback`, AI 리포트, 프론트 리포트 UI |
| 전체 일정 | `roadmap.md` | 12주 개발 로드맵 |

## Codex에게 줄 작업 프롬프트 형식

```text
README.md와 현재 Step 문서를 먼저 읽고, 프로젝트 구조와 현재 구현 상태를 파악한 뒤 작업해줘.
작업 중에는 plan을 세우고, 모르는 부분이나 결정하기 어려운 부분은 물어보면서 진행해줘.
```

특정 Step을 진행할 때:

```text
Sound-learn/stepN-purpose.md 형식의 현재 Step 문서를 기준으로 Step N 작업을 진행해줘.
README.md와 관련 API 명세도 함께 확인하고, 기존 구현과 충돌하지 않게 수정해줘.
작업 중에는 plan을 세우고, 모르는 부분이나 결정하기 어려운 부분은 물어보면서 진행해줘.
```

## 매번 체크할 항목

- [ ] 최신 문서를 읽었다.
- [ ] 현재 Step의 완료 기준을 확인했다.
- [ ] 관련 API 스키마를 확인했다.
- [ ] 프론트엔드와 백엔드의 연결 흐름을 확인했다.
- [ ] 기존 타입과 응답 필드명을 임의로 바꾸지 않았다.
- [ ] 변경 후 실행 또는 테스트 방법을 확인했다.
- [ ] 문서에 남길 변경 사항을 정리했다.

## 주의사항

- `/api/upload` 응답의 `pitch`, `summary`, `duration_sec` 필드는 프론트와 직접 연결되어 있으므로 임의 변경하지 않습니다.
- `/api/compare`는 기준 멜로디와 사용자 피치를 비교하는 독립 API입니다.
- `/api/feedback`은 전체 오디오가 아니라 요약된 분석 데이터만 AI에 전달합니다.
- OpenAI API key는 백엔드 환경변수로만 관리하고 프론트엔드에 노출하지 않습니다.
