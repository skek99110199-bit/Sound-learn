📌 프로젝트 상세 설계: 널 위한 멜로디 (Melody for You)사용자 가창 음성을 AI로 분석하여 원곡(MIDI)과 비교하고, 시각적 가이드와 개인화된 피드백을 제공하는 웹 기반 보컬 분석 서비스입니다.

1. 개요 스냅샷 항목내용언어 / 프레임워크TypeScript · React (Next.js) / Python (FastAPI)핵심 라이브러리Librosa, Crepe (Pitch Extraction), Tone.js (Audio Playback)데이터 형식Audio (WAV/MP3), MIDI (Reference Standard), JSON (Analysis Result)AI 모델OpenAI GPT-4o (Feedback), CREPE (Deep Learning Pitch Tracking)핵심 지표Pitch Accuracy (음정), Rhythmic Precision (박자), Vocal Range (음역대)진입점app/page.tsx (Frontend) / main.py (Backend API)

2. 디렉터리 구조Plaintextmelody-project/
├── frontend/ (Next.js)
│   ├── components/
│   │   ├── recorder/         # 실시간 녹음 및 파형 표시
│   │   ├── visualization/    # Piano Roll (Canvas/SVG) 렌더러
│   │   └── report/           # AI 피드백 및 통계 카드
│   ├── hooks/                # useAudioAnalyzer, useTimer 등
│   └── store/                # 분석 결과 및 오디오 상태 관리 (Zustand/Recoil)
└── backend/ (Python FastAPI)
    ├── api/
    │   ├── upload.py         # 파일 수신 및 전처리
    │   ├── analysis.py       # Pitch 추출 및 DTW 비교 로직
    │   └── feedback.py       # LLM 프롬프트 생성 및 응답
    ├── core/
    │   ├── pitch_engine.py   # Crepe/Librosa 기반 음높이 추정
    │   └── aligner.py        # Dynamic Time Warping (박자 보정)
    └── models/
        └── midis/            # 기준 곡 데이터 (JSON/MIDI)
3. 시스템 아키텍처Plaintext[사용자 가창] ──(녹음/업로드)──> [Frontend UI]
                                   │
                                   ▼
[AI 분석 엔진 (Backend)] <──(WAV 전송)── [API Gateway]
   │
   ├─> [Pitch Engine] ──(추출)──> 주파수 데이터($f_0$)
   ├─> [Aligner] ──(비교)──> 기준 MIDI와 시간축 정렬
   └─> [LLM Agent] ──(생성)──> 분석 데이터 기반 텍스트 피드백
                                   │
                                   ▼
[결과 대시보드] <──(JSON 응답)── [Frontend]
   │
   └─ Piano Roll 시각화 (정답 vs 내 목소리)
4. 핵심 모듈 상세

4.1 Pitch Engine (음정 추출)CREPE 모델: 딥러닝 기반 모델을 사용하여 배경 소음이 있는 환경에서도 정확한 주파수를 추출합니다.음계 변환: 추출된 $Hz$ 단위를 MIDI Note 번호로 변환합니다.$P = 69 + 12 \times \log_2(f / 440)$

4.2 Aligner (박자 및 싱크 보정)DTW (Dynamic Time Warping): 사용자가 노래를 조금 늦게 시작하거나 빠르게 불렀을 때, 시간축을 유연하게 늘려 기준 음정과 매칭시킵니다.이 과정이 없으면 단순한 박자 실수도 음정 오류로 표시되므로 가장 중요한 로직입니다

4.3 AI Feedback Generator데이터 요약: "평균 음정 오차: 15센트", "고음역대(C5 이상) 이탈률: 40%" 등 수치화된 데이터를 프롬프트로 변환합니다.페르소나 설정: "전문 보컬 트레이너" 역할을 부여하여 사용자에게 격려와 개선책을 동시에 전달합니다.5. 단계별 로드맵 (Step-by-Step)

Step 1: MVP 환경 구축 (1-2주)목표: 녹음된 파일에서 주파수를 추출하여 숫자로 보여주기.할 일: FastAPI 서버 세팅, Librosa를 이용한 기본 Pitch 추출 테스트, 클라이언트 업로드 기능 구현.

Step 2: Piano Roll 시각화 구현 (3-4주)목표: 노래방 화면처럼 음정 궤적을 화면에 그리기.할 일: Canvas API를 사용하여 기준 멜로디(MIDI)를 배경에 그리고, 그 위에 분석된 사용자 Pitch 데이터를 오버레이.

Step 3: 데이터 비교 알고리즘 고도화 (5주)목표: 박자가 틀려도 음정이 맞으면 '정답'으로 인정하기.할 일: DTW 알고리즘 적용, 반음($100$ cents) 단위의 정밀도 판정 로직 개발.

Step 4: AI 피드백 및 리포트 완성 (6주)목표: 분석 결과를 사람이 읽기 쉬운 문장으로 제공하기.할 일: OpenAI API 연동, 가창 통계(최고음, 최저음, 정확도) 대시보드 UI 제작.

Step 5: 서비스 최적화 및 배포 (7-8주)목표: 실제 사용자가 쓸 수 있는 속도와 안정성 확보.할 일: 오디오 파일 압축 전송, 서버 비동기 처리, Vercel/AWS 배포.6. 기대 기능 (Feature Set)기능상세 설명다이내믹 피드백"이 마디에서 샵(#)이 됐어요"와 같은 구간별 정밀 분석음역대 체크사용자의 가창 데이터를 바탕으로 '당신에게 어울리는 노래' 추천비포 & 애프터연습 전후의 음정 정확도 그래프 비교 기능공유하기분석 결과지와 시각화 차트를 이미지로 저장하여 SNS 공유
