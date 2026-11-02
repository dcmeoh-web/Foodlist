import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 이 설정 파일이 있는 폴더(webapp). 서버를 어느 폴더에서 실행해도 .env.local 을 같은 곳에서 읽는다.
const appDir = fileURLToPath(new URL('.', import.meta.url));

// 내 컴퓨터에서만 쓰므로 localhost로만 연다 (같은 네트워크의 다른 기기에서는 접속할 수 없다)
export default defineConfig(({ mode }) => {
  // VITE_ 접두사가 없는 변수(SUPABASE_SERVICE_ROLE_KEY)까지 읽는다. 이 값은 브라우저 코드에 들어가지 않는다.
  const env = loadEnv(mode, appDir, '');
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const useProxy = Boolean(url && serviceKey);

  // service_role 키가 있으면 개발 서버가 REST API 호출에 그 키를 붙여 대신 보낸다.
  // 브라우저는 /supabase/rest/v1 로만 요청하고, 인증 · 스토리지 같은 다른 경로는 프록시하지 않는다.
  const proxy = useProxy
    ? {
        '/supabase/rest/v1': {
          target: url,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase/, ''),
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    define: { __SUPABASE_PROXY__: JSON.stringify(useProxy) },
    server: { host: '127.0.0.1', port: 5173, proxy },
    preview: { host: '127.0.0.1', proxy },
  };
});
