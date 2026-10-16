import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().min(1),
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
