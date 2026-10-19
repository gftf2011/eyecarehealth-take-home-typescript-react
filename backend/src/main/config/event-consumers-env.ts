import { z } from 'zod';

import { awsEnvShape, orderingQueueEnvShape } from './messaging-env';

/**
 * Configuração do processo dos consumidores de eventos: banco, AWS e as filas
 * que ele lê. Falha no boot se algo estiver errado.
 */
const eventConsumersEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  ...awsEnvShape,
  ...orderingQueueEnvShape,
  /** Porta interna só do health check (não é exposta ao público). */
  EVENT_CONSUMERS_HEALTH_HOST: z.string().default('0.0.0.0'),
  EVENT_CONSUMERS_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3004),
});

export type EventConsumersEnv = z.output<typeof eventConsumersEnvSchema>;

export function loadEventConsumersEnv(source: NodeJS.ProcessEnv = process.env): EventConsumersEnv {
  const result = eventConsumersEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas (event-consumers):\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
