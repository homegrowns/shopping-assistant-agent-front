import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // JSX 변환과 React Fast Refresh(HMR)를 활성화합니다.
  plugins: [react()],

  // `npm run dev`로 실행되는 로컬 개발 서버 설정입니다.
  server: {
    proxy: {
      // 프론트의 `/search` 요청을 로컬 FastAPI 서버로 전달합니다.
      // 이 프록시는 개발 환경에서만 적용되며, 배포 환경에는 적용되지 않습니다.
      '/search': 'http://127.0.0.1:8000',
    },
  },

  // Vitest 테스트 실행 환경 설정입니다.
  test: {
    // 브라우저 DOM API를 사용할 수 있도록 jsdom 환경에서 테스트합니다.
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // 테스트 중 window.location의 기본 주소로 사용됩니다.
        url: 'http://localhost:3000/',
      },
    },
    // 각 테스트 실행 전에 공통 매처와 초기 설정을 불러옵니다.
    setupFiles: './src/test/setup.js',
    // 테스트 사이에 mock 호출 기록과 구현을 자동으로 초기화합니다.
    clearMocks: true,
  },
});
