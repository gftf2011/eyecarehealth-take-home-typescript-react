import { z } from 'zod';

/** Lista separada por vírgula; `*` não é aceito (qualquer site abriria sockets). */
const originsSchema = z
  .string()
  .default('http://localhost:3000')
  .transform((raw, context) => {
    const origins = raw.split(',').map((origin) => origin.trim()).filter((origin) => origin !== '');
    if (origins.includes('*')) {
      context.addIssue({ code: 'custom', message: 'Liste as origens permitidas; "*" é inseguro' });
      return z.NEVER;
    }
    return origins;
  });

/**
 * Configuração do gateway de tempo real: só Redis e o segredo do access
 * token (sem banco nem configurações da API).
 */
const realtimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().min(1),
  /** O mesmo segredo da API: o gateway só verifica tokens, nunca emite. */
  JWT_SECRET: z.string().min(32, 'O segredo JWT deve ter pelo menos 32 caracteres'),
  REALTIME_HOST: z.string().default('0.0.0.0'),
  REALTIME_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  REALTIME_ALLOWED_ORIGINS: originsSchema,
});

export type RealtimeEnv = z.output<typeof realtimeEnvSchema>;

export function loadRealtimeEnv(source: NodeJS.ProcessEnv = process.env): RealtimeEnv {
  const result = realtimeEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas (realtime-gateway):\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
