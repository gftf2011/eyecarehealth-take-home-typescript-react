import { z } from 'zod';

export type AppConfig = {
  /** URL absoluta da API. Padrão: `/api` na mesma origem (proxy do Vite ou do nginx). */
  readonly apiBaseUrl: string;
  /** WebSocket do tempo real. Padrão: `/realtime` na mesma origem (`ws:` ou `wss:`). */
  readonly realtimeUrl: string;
};

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().trim().min(1).optional(),
  VITE_REALTIME_URL: z.string().trim().min(1).optional(),
});

/** Lê e valida a configuração no boot; falha cedo com mensagem clara. */
export function loadAppConfig(
  env: Record<string, unknown> = import.meta.env,
  origin: string = window.location.origin,
): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configuração inválida: ${z.prettifyError(parsed.error)}`);
  }
  const base = parsed.data.VITE_API_BASE_URL ?? '/api';
  const realtime = new URL(parsed.data.VITE_REALTIME_URL ?? '/realtime', origin);
  if (realtime.protocol === 'http:') realtime.protocol = 'ws:';
  if (realtime.protocol === 'https:') realtime.protocol = 'wss:';
  return { apiBaseUrl: new URL(base, origin).toString(), realtimeUrl: realtime.toString() };
}
