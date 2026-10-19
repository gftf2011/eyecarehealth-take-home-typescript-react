import { z } from 'zod';

import { parseDurationMs } from './duration';

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

/** Duração legível (`15m`, `7d`) convertida para milissegundos. */
const durationSchema = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((raw, context) => {
      const ms = parseDurationMs(raw);
      if (ms === null || ms <= 0) {
        context.addIssue({ code: 'custom', message: 'Use o formato 30s, 15m, 12h ou 7d' });
        return z.NEVER;
      }
      return ms;
    });

/** HS256 exige segredo forte: no mínimo 32 caracteres (256 bits). */
const jwtSecretSchema = z.string().min(32, 'O segredo JWT deve ter pelo menos 32 caracteres');

const booleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.string().min(1),
    /** Obrigatório: os contadores de rate limit vivem no Redis (compartilhados entre réplicas). */
    REDIS_URL: z.string().min(1),
    TRUST_PROXY: trustProxySchema,
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    JWT_SECRET: jwtSecretSchema,
    JWT_REFRESH_SECRET: jwtSecretSchema,
    JWT_EXPIRES_IN: durationSchema('15m'),
    JWT_REFRESH_EXPIRES_IN: durationSchema('7d'),
    /** Padrão: cookies `Secure` em produção; desligue só em desenvolvimento sem HTTPS. */
    COOKIE_SECURE: booleanSchema.optional(),
    BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(10),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    /** Workers do otimizador de atribuição (padrão: núcleos − 1, no máximo 2). */
    OPTIMIZER_WORKERS: z.coerce.number().int().min(1).max(32).optional(),
    /** Sugestões esperando um worker livre; além disso, 503 OPTIMIZER_BUSY. */
    OPTIMIZER_MAX_QUEUED: z.coerce.number().int().min(0).max(1_000).default(4),
    /** Tempo máximo de uma sugestão; depois disso, 503 OPTIMIZER_TIMEOUT. */
    OPTIMIZER_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
    /** Até quantas células (pedidos × entregadores) calcular na thread da API. */
    OPTIMIZER_INLINE_MAX_CELLS: z.coerce.number().int().min(0).default(10_000),
  })
  .refine((env) => env.JWT_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'Use segredos diferentes para access e refresh token',
  })
  .transform(({ COOKIE_SECURE, ...env }) => ({
    ...env,
    COOKIE_SECURE: COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

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
