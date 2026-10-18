import { z } from 'zod';

import { awsEnvShape } from './messaging-env';

/**
 * Configuração do worker do outbox: só o que ele usa (sem segredos JWT nem
 * configurações da API). Falha no boot se algo estiver errado.
 */
const relayEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  ...awsEnvShape,
  /** Tópico SNS onde o relay publica (em dev, criado pelo `messaging-setup`). */
  EVENTS_TOPIC_ARN: z.string().startsWith('arn:', 'Informe o ARN do tópico SNS'),
  /** Espera entre ciclos sem pendentes: é a latência máxima até o painel. */
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(50).max(60_000).default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(100),
  /** Falhas permanentes de uma mensagem até ela ir para a fila morta. */
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
  /** Porta interna só do health check (não é exposta ao público). */
  RELAY_HEALTH_HOST: z.string().default('0.0.0.0'),
  RELAY_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3003),
});

export type RelayEnv = z.output<typeof relayEnvSchema>;

export function loadRelayEnv(source: NodeJS.ProcessEnv = process.env): RelayEnv {
  const result = relayEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas (outbox-relay):\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
