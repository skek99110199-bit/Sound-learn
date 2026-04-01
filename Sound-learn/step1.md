# Step 1 완료 보고서 — MVP 환경 구축

**완료 기준일:** 2026-04-02
**해당 로드맵:** 1~2주차 (2026-03-30 ~ 2026-04-12)

---

## 1. 구현된 기능 목록

### 백엔드 (FastAPI / Python)

| 기능 | 파일 | 설명 |
|------|------|------|
| API 서버 실행 | `backend/main.py` | FastAPI 서버, CORS 설정 (localhost:3000 허용) |
| 음성 파일 업로드 | `backend/api/upload.py` | WAV / MP3 / WebM 파일 수신, 50MB 크기 제한 |
| 오디오 전처리 | `backend/api/upload.py` | 22050Hz 모노로 리샘플링 후 temp 폴더에 WAV로 저장 |
| 음정 추출 | `backend/core/pitch_engine.py` | librosa.pyin 기반, 약 23ms 단위 프레임별 주파수(Hz) 및 MIDI 노트 번호 추출 |
| 무성 구간 처리 | `backend/core/pitch_engine.py` | 묵음 / 노이즈 구간은 frequency, midi_note를 null로 반환 |
| Health Check | `backend/main.py` | `GET /` 엔드포인트 — 서버 정상 동작 확인용 |

### 프론트엔드 (Next.js 16 / TypeScript)

| 기능 | 파일 | 설명 |
|------|------|------|
| 메인 페이지 | `frontend/app/page.tsx` | 서비스 제목, 설명, 녹음 컴포넌트 배치 |
| 마이크 녹음 | `frontend/components/recorder/VoiceRecorder.tsx` | 브라우저 마이크 권한 요청 및 MediaRecorder로 녹음 시작 / 중지 |
| 실시간 파형 시각화 | `frontend/components/recorder/WaveformVisualizer.tsx` | Web Audio API + Canvas — 녹음 중 실시간 파형(Waveform) 표시 |
| 파일 업로드 | `frontend/components/recorder/VoiceRecorder.tsx` | 녹음 완료 후 WebM 파일을 백엔드에 자동 전송 |
| 상태 표시 | `frontend/components/recorder/VoiceRecorder.tsx` | 녹음 중 / 업로드 중 / 완료 / 오류 상태 메시지 표시 |
| 타입 정의 | `frontend/components/recorder/types.ts` | RecordingState, UploadResponse, VoiceRecorderProps 등 타입 정의 |

---

## 2. 업로드 API 입출력 명세

### 요청

```
POST http://localhost:8000/api/upload
Content-Type: multipart/form-data

[file] 오디오 파일 (WAV / MP3 / WebM)
```

### 응답 (성공 시)

```json
{
  "filename": "recording.webm",
  "saved_path": "temp/abc123_recording.wav",
  "duration_sec": 5.123,
  "original_sr": 44100,
  "normalized_sr": 22050
}
```

### 오류 응답

| 상황 | HTTP 코드 | 메시지 |
|------|-----------|--------|
| 지원하지 않는 파일 형식 | 422 | 지원하지 않는 파일 형식입니다. 허용: .wav, .mp3, .webm |
| 파일 크기 초과 (50MB) | 422 | 파일 크기가 50MB를 초과합니다. |

---

## 3. 음정 추출 결과 형식 (pitch_engine)

`extract_pitch(file_path)` 함수 반환값:

```json
[
  { "time": 0.023, "frequency": 220.0,  "midi_note": 57.0 },
  { "time": 0.046, "frequency": 261.63, "midi_note": 60.0 },
  { "time": 0.069, "frequency": null,   "midi_note": null  }
]
```

- `time`: 프레임 시작 시간 (초 단위, 약 23ms 간격)
- `frequency`: 추출된 주파수 (Hz), 무성 구간은 null
- `midi_note`: MIDI 노트 번호 (공식: `P = 69 + 12 × log2(f / 440)`), 무성 구간은 null

---

## 4. 실행 방법

### 사전 준비

- Python 3.11 이상
- Node.js 18 이상
- npm

---

### 백엔드 실행

```bash
# 1. 백엔드 폴더로 이동
cd Sound-learn/backend

# 2. 가상환경 활성화 (Windows)
venv\Scripts\activate

# 3. 패키지 설치 (처음 한 번만)
pip install -r requirements.txt

# 4. 서버 실행
uvicorn main:app --reload --port 8000
```

서버 실행 후 확인:
- API 문서: http://localhost:8000/docs
- Health Check: http://localhost:8000/

---

### 프론트엔드 실행

```bash
# 1. 프론트엔드 폴더로 이동
cd Sound-learn/frontend

# 2. 패키지 설치 (처음 한 번만)
npm install

# 3. 개발 서버 실행
npm run dev
```

실행 후 브라우저에서 접속:
- http://localhost:3000

---

### 실행 순서 요약

```
1. 백엔드 서버 시작  →  uvicorn main:app --reload --port 8000
2. 프론트엔드 시작   →  npm run dev
3. 브라우저에서      →  http://localhost:3000 접속
```

> 백엔드와 프론트엔드를 **동시에 실행**해야 녹음 및 업로드 기능이 정상 동작합니다.

---

## 5. 사용 흐름

```
브라우저 접속 (localhost:3000)
        │
        ▼
  "녹음 시작" 버튼 클릭
        │
        ▼
  마이크 권한 허용 → 실시간 파형 표시 시작
        │
        ▼
  "녹음 중지" 버튼 클릭
        │
        ▼
  WebM 오디오 파일 자동 업로드 (POST /api/upload)
        │
        ▼
  백엔드에서 22050Hz WAV로 변환 후 temp 폴더에 저장
        │
        ▼
  업로드 완료 메시지 표시 (예: "업로드 완료 (5.1초)")
```

---

## 6. 프로젝트 구조 (Step 1 기준)

```
Sound-learn/
├── backend/
│   ├── main.py               # FastAPI 서버 진입점
│   ├── requirements.txt      # 의존 패키지 목록
│   ├── api/
│   │   └── upload.py         # 파일 업로드 API
│   ├── core/
│   │   └── pitch_engine.py   # 음정 추출 엔진 (pyin 기반)
│   └── temp/                 # 업로드된 파일 임시 저장소
│
└── frontend/
    ├── app/
    │   ├── layout.tsx        # 공통 레이아웃
    │   └── page.tsx          # 메인 페이지
    └── components/
        └── recorder/
            ├── VoiceRecorder.tsx      # 녹음 + 업로드 컴포넌트
            ├── WaveformVisualizer.tsx # 실시간 파형 Canvas
            ├── types.ts               # 타입 정의
            └── index.ts               # 컴포넌트 export
```

---

## 7. 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 프레임워크 | Next.js | 16.2.1 |
| 프론트엔드 언어 | TypeScript | 5.x |
| UI 스타일링 | Tailwind CSS | 4.x |
| 백엔드 프레임워크 | FastAPI | 0.111.0+ |
| 백엔드 언어 | Python | 3.11+ |
| 오디오 처리 | librosa | 0.10.0+ |
| 오디오 저장 | soundfile | 0.12.1+ |
| 수치 연산 | numpy | 1.26.0+ |
| ASGI 서버 | uvicorn | 0.29.0+ |

---

## 8. 미구현 항목 (Step 2 이후)

| 기능 | 예정 주차 |
|------|-----------|
| pitch 추출 결과를 API 응답으로 반환 | 3주차 |
| MIDI 기준곡 데이터 처리 | 4주차 |
| 사용자 음성 vs 기준곡 비교 | 5주차 |
| DTW 박자 정렬 알고리즘 | 6주차 |
| Piano Roll 시각화 | 7주차 |
| AI 피드백 (GPT-4o 연동) | 9주차 |
| 배포 (Vercel / AWS) | 12주차 |
