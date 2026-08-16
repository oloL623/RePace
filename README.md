# RePace Frontend

React와 Vite로 만든 RePace 러닝 프런트엔드입니다.

## 로컬 실행

```bash
npm ci
npm run dev -- --host localhost
```

환경변수는 `.env.example`을 참고해 `.env` 또는 `.env.local`에 설정합니다.

## Gemini 음성 코칭

라이브런의 시작·일시정지·코스 이탈과 시간·거리·페이스·과거 기록 비교 등
모든 음성 안내를 Gemini TTS로 생성합니다.

```env
GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_API_KEY
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
GEMINI_TTS_VOICE=Sulafat
```

`GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`는 Vite 서버에서만 읽으며 `VITE_`
접두사를 붙이지 않습니다.
브라우저는 `/api/voice-coach/tts`에 문장만 보내고 API 키를 받지 않습니다.
Gemini 요청 또는 오디오 재생이 실패하면 다른 목소리로 대체하지 않고 화면에
재시도 안내를 표시합니다.

정적 파일만 배포하는 환경에서는 같은 경로의 서버 프록시를 별도로 제공해야
합니다. 현재 프록시는 Vite 개발 서버와 `vite preview`에서 동작합니다.

## Vite 기본 안내

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
