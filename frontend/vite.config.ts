import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

/**
 * O painel fala com o backend pela mesma origem (`/api` e `/realtime`): o
 * Vite faz o proxy em desenvolvimento e o nginx no Docker. Assim o cookie do
 * refresh token (`SameSite=Strict`, `Path=/api/auth`) funciona sem CORS.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy: Record<string, ProxyOptions> = {
    '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: false },
    '/realtime': { target: env.REALTIME_PROXY_TARGET ?? 'ws://localhost:3002', ws: true },
  };

  return {
    plugins: [react()],
    server: { port: 3000, strictPort: true, proxy },
    preview: { port: 3000, strictPort: true, proxy },
    build: { sourcemap: true },
  };
});
