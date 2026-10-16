import { z } from 'zod';

/**
 * Proxies confiáveis para ler o IP real do cliente em `X-Forwarded-For`.
 * Aceita uma lista de IPs/CIDRs (`10.0.0.0/8,172.16.0.0/12`) ou o número de
 * saltos (`1`). Nunca "confiar em todos": o cliente forjaria o cabeçalho e
 * escaparia do rate limit.
 */
const trustProxySchema = z
  .string()
  .trim()
  .optional()
  .transform((raw, context): string[] | number | false => {
    if (raw === undefined || raw === '') return false;
    if (/^\d+$/.test(raw)) return Number(raw);
    if (raw === 'true' || raw === '*') {
      context.addIssue({
        code: 'custom',
        message: 'Informe IPs/CIDRs ou número de saltos; confiar em todos os proxies é inseguro',
      });
      return z.NEVER;
    }
    return raw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().min(1),
  /** Opcional: com Redis, o rate limit é compartilhado entre réplicas e sobrevive a reinícios. */
  REDIS_URL: z.string().min(1).optional(),
  TRUST_PROXY: trustProxySchema,
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.output<typeof envSchema>;

/** Lê e valida as variáveis de ambiente; falha no boot se algo estiver errado. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
