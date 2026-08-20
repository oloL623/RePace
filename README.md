# RePace Frontend

React와 Vite로 만든 RePace 러닝 프런트엔드입니다.

## 로컬 실행

```bash
npm ci
npm run dev -- --host localhost
```

환경변수는 `.env.example`을 참고해 `.env` 또는 `.env.local`에 설정합니다.

## 음성 코칭

라이브런의 시작·일시정지·코스 이탈과 시간·거리·페이스·과거 기록 비교 등
모든 음성 안내는 Android Chrome과 iOS Safari가 제공하는 한국어 내장 TTS로
재생합니다. 별도의 API 키나 음성 서버 설정은 필요하지 않습니다.

## iOS 백그라운드 러닝 테스트

iOS 앱은 Capacitor와 Core Location을 사용해 화면이 꺼진 동안에도 러닝 좌표를 기록합니다.

Mac에서 다음 명령을 실행합니다.

```bash
npm install
npm run ios:sync
npm run ios:open
```

Xcode에서 `App` 타깃의 Signing Team을 선택한 뒤 실제 iPhone으로 실행합니다. 위치 권한은 `항상 허용`과 `정확한 위치`를 켜야 합니다. 브라우저로 연 Vercel 화면은 기존 웹 GPS를 사용하며 백그라운드 기록은 네이티브 앱에서만 동작합니다.

백엔드 CORS 허용 목록에는 `capacitor://localhost`를 추가해야 합니다. 카카오 JavaScript 지도는 해당 스킴을 지원하지 않을 수 있으므로 네이티브 앱의 지도는 카카오 iOS 지도 SDK 전환이 별도로 필요합니다.

## Vite 기본 안내

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
