# 백엔드 환경변수 설정 방법

## 필수 작업 — `.env` 파일 생성

백엔드 폴더(`Sound-learn/backend/`)에 `.env` 파일을 직접 만들어야 합니다.

> ⚠️ `.env` 파일은 API 키가 담겨 있어 **절대 git에 올리면 안 됩니다.**  
> `.gitignore`에 이미 등록되어 있으므로 자동으로 제외됩니다.

---

## 파일 위치

```
Sound-learn/
└── backend/
    └── .env   ← 여기에 만들기 (git에 올라가지 않음)
```

---

## .env 파일 내용

```
OPENAI_API_KEY=sk-proj-여기에_실제_키_붙여넣기
OPENAI_MODEL=gpt-4o-mini
```

---

## OpenAI API 키 발급 방법

1. https://platform.openai.com/api-keys 접속
2. 로그인 후 **"Create new secret key"** 클릭
3. 생성된 `sk-proj-...` 키 복사
4. `.env` 파일의 `OPENAI_API_KEY=` 뒤에 붙여넣기

> ⚠️ 키는 `sk-proj-`로 시작해야 합니다. `key_`로 시작하는 건 OpenAI 키가 아닙니다.  
> 크레딧이 없으면 429 오류가 납니다. https://platform.openai.com/settings/billing 에서 충전하세요.

---

## PowerShell로 .env 파일 빠르게 만들기

```powershell
@"
OPENAI_API_KEY=sk-proj-여기에붙여넣기
OPENAI_MODEL=gpt-4o-mini
"@ | Out-File -FilePath "Sound-learn\backend\.env" -Encoding utf8
```

---

## 서버 실행

```powershell
cd Sound-learn/backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

`.env` 파일이 있으면 서버 실행 시 자동으로 키를 읽습니다.  
매번 키를 입력할 필요 없습니다.
