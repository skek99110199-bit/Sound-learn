# 📌 프로젝트 상세 설계: Sound-Learn

사용자 가창 음성을 AI로 분석하여 원곡(MIDI)과 비교하고, 시각적 가이드와 개인화된 피드백을 제공하는 웹 기반 보컬 분석 서비스입니다.

---

# 1. 개요 스냅샷

| 항목         | 내용                                                                 |
| ---------- | ------------------------------------------------------------------ |
| 서비스명       | Sound-Learn                                                        |
| 설명         | AI 기반 보컬 분석 및 피드백 웹 서비스                                            |
| 언어 / 프레임워크 | TypeScript · React (Next.js) / Python (FastAPI)                    |
| 핵심 라이브러리   | Librosa, CREPE (Pitch Extraction), Tone.js (Audio Playback)        |
| 데이터 형식     | Audio (WAV/MP3), MIDI (Reference Standard), JSON (Analysis Result) |
| AI 모델      | OpenAI GPT-4o (피드백 생성), CREPE (딥러닝 기반 Pitch Tracking)              |
| 핵심 지표      | Pitch Accuracy (음정), Rhythmic Precision (박자), Vocal Range (음역대)    |
| 진입점        | app/page.tsx (Frontend) / main.py (Backend API)                    |

---

# 2. 디렉터리 구조

```plaintext
melody-project/
├── frontend/ (Next.js)
│   ├── components/
│   │   ├── recorder/         # 녹음 및 파형 표시
│   │   ├── visualization/    # Piano Roll (Canvas/SVG)
│   │   └── report/           # AI 피드백 및 통계 UI
│   ├── hooks/                # useAudioAnalyzer, useTimer
│   └── store/                # 상태 관리 (Zustand/Recoil)
│
└── backend/ (FastAPI)
    ├── api/
    │   ├── upload.py         # 파일 수신 및 전처리
    │   ├── analysis.py       # Pitch 추출 및 비교
    │   └── feedback.py       # AI 피드백 생성
    ├── core/
    │   ├── pitch_engine.py   # 음정 추출
    │   └── aligner.py        # DTW 정렬
    └── models/
        └── midis/            # 기준 곡 데이터
```

---

# 3. 시스템 아키텍처

```plaintext
[사용자 가창] ──(녹음/업로드)──> [Frontend UI]
                                   │
                                   ▼
                          [API Gateway]
                                   │
                                   ▼
                    [Backend AI 분석 엔진]
                                   │
        ┌──────────────────────────────────────┐
        │                                      │
        │  Pitch Engine → 주파수 추출 (f₀)     │
        │  Aligner → 시간 정렬 (DTW)           │
        │  LLM Agent → 피드백 생성             │
        │                                      │
        └──────────────────────────────────────┘
                                   │
                                   ▼
                        (JSON 결과 반환)
                                   │
                                   ▼
                    [Frontend 결과 대시보드]
                                   │
                                   ▼
             Piano Roll 시각화 (정답 vs 사용자)
```

---

# 4. 핵심 모듈 상세

## 4.1 Pitch Engine (음정 추출)

### ✔ 개요

* CREPE 기반 딥러닝 모델 사용
* 보조적으로 Librosa 활용 가능

### ✔ 특징

* 노이즈 환경에서도 안정적인 주파수 추출
* 시간 단위로 Pitch 데이터 생성

### ✔ 음계 변환 공식

```math
P = 69 + 12 × log2(f / 440)
```

* f: 주파수 (Hz)
* P: MIDI Note Number

---

## 4.2 Aligner (박자 및 싱크 보정)

### ✔ 사용 알고리즘

* Dynamic Time Warping (DTW)

### ✔ 역할

* 사용자 노래와 원곡의 시간 차이 보정
* 속도 차이를 허용하면서 최적 매칭 수행

### ✔ 중요성

* DTW가 없으면 단순한 박자 차이도 음정 오류로 판단됨
* 전체 분석 정확도를 결정하는 핵심 모듈

---

## 4.3 AI Feedback Generator

### ✔ 입력 데이터

* 평균 음정 오차 (cent)
* 음역대별 정확도
* 특정 구간 이탈률

### ✔ 처리 방식

1. 분석 결과를 요약 데이터로 변환
2. 프롬프트 구성
3. LLM 호출

### ✔ 출력 예시

* “전반적으로 음정이 낮은 경향이 있습니다.”
* “고음 구간에서 불안정한 발성이 관찰됩니다.”

### ✔ 특징

* “보컬 트레이너” 페르소나 적용
* 단순 결과 → 해석 가능한 피드백으로 변환

---

# 5. 단계별 로드맵 (Step-by-Step)

## Step 1: MVP 환경 구축 (1~2주)

### 목표

* 음성 파일에서 주파수 추출

### 작업

* FastAPI 서버 구축
* Librosa 기반 Pitch 추출
* 파일 업로드 기능 구현

---

## Step 2: Piano Roll 시각화 (3~4주)

### 목표

* 음정 데이터를 시각적으로 표현

### 작업

* Canvas 기반 그래프 구현
* MIDI 기준 멜로디 렌더링
* 사용자 Pitch overlay

---

## Step 3: 데이터 비교 알고리즘 고도화 (5주)

### 목표

* 박자 차이를 고려한 정확한 비교

### 작업

* DTW 알고리즘 적용
* ±100 cent 기준 판정 로직 구현

---

## Step 4: AI 피드백 및 리포트 (6주)

### 목표

* 분석 결과를 자연어로 제공

### 작업

* OpenAI API 연동
* 통계 데이터 생성
* 리포트 UI 구현

---

## Step 5: 최적화 및 배포 (7~8주)

### 목표

* 실제 서비스 수준 완성

### 작업

* 오디오 압축 및 전송 최적화
* 비동기 처리
* Vercel / AWS 배포

---

# 6. 기대 기능 (Feature Set)

| 기능         | 상세 설명              |
| ---------- | ------------------ |
| 다이내믹 피드백   | 특정 구간 음정 오류 분석     |
| 음역대 체크     | 사용자 음역 기반 분석       |
| 비포 & 애프터   | 연습 전후 비교           |
| 공유 기능      | 결과 이미지 저장 및 SNS 공유 |
| 맞춤 추천 (확장) | 사용자 음역 기반 곡 추천     |

---

# 👍 한 줄 요약

노래를 데이터로 분석하고 시각화하며 AI가 개선 방향까지 제공하는 보컬 피드백 웹 서비스







# 🎵 널 위한 멜로디 (Melody for You) - 상세 설계서

**작성자:** 김우영 (2271085)  
**소속:** 한성대학교 컴퓨터공학부 (Web & Mobile Software Track)

---

## 🏗️ 1. 시스템 아키텍처 및 데이터 흐름 (Data Pipeline)

전체 서비스는 사용자의 음성을 수집하여 AI 분석 후 시각화하는 6단계 파이프라인으로 구성됩니다.

1.  **Frontend** (`request_audio_stream`): 사용자 가창 시작 및 마이크 스트림 활성화.
2.  **Frontend** (`export_to_wav`): 녹음 완료 후 오디오 데이터를 서버(FastAPI)로 전송.
3.  **Backend** (`extract_pitch_crepe`): **CREPE** 모델을 통한 딥러닝 기반 정밀 음정 추출.
4.  **Backend** (`apply_dtw_alignment`): **[핵심]** DTW 알고리즘으로 사용자 박자와 기준곡 마디 동기화.
5.  **Backend** (`generate_ai_feedback`): GPT-4o 기반 개인화 보컬 리포트 및 피드백 생성.
6.  **Frontend** (`render_piano_roll`): 분석 결과 및 피아노 롤 시각화 대시보드 출력.

---

## 🛠️ 2. 백엔드 메소드 명세 (Python / FastAPI)

### [A] 음성 처리 및 특징 추출 (Pitch Engine)
사용자의 아날로그 음성 신호를 디지털 분석 데이터로 변환합니다.

| 메소드명 | 설명 | 비고 |
| :--- | :--- | :--- |
| `load_audio_stream()` | 업로드된 오디오 파일을 Numpy Array 형태로 로드 | librosa 활용 |
| `preprocess_noise_reduction()` | 배경 노이즈를 제거하여 음정 추출 정확도 향상 | 전처리 단계 |
| `extract_pitch_crepe()` | **CREPE** 모델을 사용하여 10ms 단위 주파수($f_0$) 추출 | Deep Learning |
| `convert_hz_to_midi()` | 추출된 주파수($Hz$)를 MIDI 노트 번호로 변환 | $f \rightarrow$ Note |
| `detect_vocal_range()` | 사용자의 최저/최고음을 계산하여 성종(음역대) 파악 | 개인화 데이터 |

### [B] 비교 및 교정 로직 (Alignment & Scoring)
박자 이탈을 허용하면서 순수 음정 실력을 평가하는 지능형 알고리즘입니다.

| 메소드명 | 설명 | 핵심 기술 |
| :--- | :--- | :--- |
| `fetch_reference_midi()` | DB에서 곡의 기준 MIDI(정답) 데이터를 로드 | Reference Data |
| `apply_dtw_alignment()` | **Dynamic Time Warping**을 적용해 박자 밀림/당김 보정 | **핵심 알고리즘** |
| `calculate_accuracy_score()` | 보정된 데이터를 바탕으로 음정(Cents) 및 박자 점수화 | 정밀도 분석 |
| `identify_error_segments()` | 음정 불안정이나 이탈이 심했던 특정 마디(Segment) 추출 | 구간 분석 |



### [C] AI 리포트 생성 (Feedback Agent)
수치 데이터를 기반으로 사용자 맞춤형 텍스트 조언을 생성합니다.

| 메소드명 | 설명 | 비고 |
| :--- | :--- | :--- |
| `aggregate_vocal_data()` | 점수, 음역대, 이탈 구간 등을 LLM용 JSON으로 요약 | Data Mapping |
| `generate_ai_feedback()` | **GPT-4o**를 통해 전문 보컬 트레이너 톤의 피드백 생성 | Prompt Eng. |
| `suggest_matching_songs()` | 파악된 사용자 음역대에 최적화된 연습곡 추천 | 큐레이션 |

---

## 🎨 3. 프론트엔드 메소드 명세 (Next.js / TypeScript)

### [A] 녹음 및 오디오 관리 (Recording Hook)
웹 브라우저의 자원을 활용한 실시간 오디오 핸들링을 담당합니다.

| 메소드명 | 설명 | 기술 스택 |
| :--- | :--- | :--- |
| `request_audio_stream()` | 브라우저 마이크 권한 요청 및 미디어 스트림 활성화 | Web Audio API |
| `visualize_realtime_wave()` | 가창 중인 목소리를 실시간 파형(Waveform)으로 렌더링 | Canvas API |
| `export_to_wav()` | 녹음 종료 후 분석용 고음질 WAV 포맷 인코딩 | Audio Export |
| `upload_with_progress()` | 서버 전송 시 진행률(Progress) 시각화 | Axios/Fetch |

### [B] 결과 시각화 (Visualization Component)
사용자에게 분석 결과를 시각적으로 피드백하는 핵심 UI 컴포넌트입니다.

| 메소드명 | 설명 | 비고 |
| :--- | :--- | :--- |
| `render_piano_roll()` | Canvas를 사용하여 가로(시간), 세로(음정) 격자 생성 | UI 프레임 |
| `draw_reference_path()` | 정답 MIDI 데이터를 배경에 바(Bar) 형태로 표시 | 가이드라인 |
| `overlay_user_pitch()` | 분석된 사용자 음정 궤적을 선 그래프로 겹쳐 출력 | 가창 궤적 |
| `highlight_error_nodes()` | 음정 이탈 구간에 시각적 강조(빨간색 노드) 표시 | 오답 노트 |



### [C] 상태 관리 및 유틸리티 (Global Store)
전역 상태를 관리하고 사용자 편의 기능을 제공합니다.

| 메소드명 | 설명 | 비고 |
| :--- | :--- | :--- |
| `store_analysis_result()` | 서버 응답 데이터를 전역 상태에 저장 및 관리 | Zustand / Recoil |
| `capture_report_image()` | 분석 리포트 화면을 이미지 파일로 캡처 | SNS 공유용 |
| `compare_session_history()` | 이전 세션과 현재 데이터를 비교하여 성장 곡선 생성 | 데이터 트래킹 |

---

> **Copyright 2026. 김우영(2271085) all rights reserved.** > 본 문서는 프로젝트 '널 위한 멜로디'의 기술 설계를 포함하고 있습니다.





### 🛠️ [추가/수정] 백엔드 핵심 메소드 보완
| 구분 | 메소드명 | 변경/추가 사유 |
| :--- | :--- | :--- |
| 전처리 | `apply_loudness_normalization()` | **[추가]** 입력 볼륨 불균형으로 인한 분석 오류 방지 |
| 동기화 | `sync_start_threshold()` | **[추가]** 무음 구간을 제외하고 실제 가창 시작점 일치 시키기 |
| 정밀도 | `calculate_cent_deviation()` | **[수정]** 반음 단위를 넘어 1/100 단위(Cent)로 정밀 오차 계산 |
| 시각화 | `smooth_pitch_curve()` | **[추가]** 추출된 피치 데이터의 노이즈를 제거하여 부드러운 선으로 시각화 |

### 🚀 차별화 포인트 (Future Roadmap)
1. **Dynamic Feedback Loop**: 사용자가 많이 틀리는 구간을 AI가 파악하여 해당 부분만 집중 연습시키는 `generate_focus_session()` 메소드 구현.
2. **Social Ranking System**: 사용자간 정확도 순위를 매기는 `calculate_global_ranking()`을 통해 커뮤니티 요소 강화.
