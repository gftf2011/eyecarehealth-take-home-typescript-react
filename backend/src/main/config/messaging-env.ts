import { z } from 'zod';

import type { AwsClientConfig } from '../../shared-kernel/infra/messaging/aws/aws-clients';

/**
 * AWS (SNS/SQS). Sem `AWS_ENDPOINT_URL`, a AWS de verdade; com ele, o Floci
 * local. Credenciais pela cadeia padrão do SDK (`AWS_ACCESS_KEY_ID` etc.).
 */
export const awsEnvShape = {
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_ENDPOINT_URL: z.url().optional(),
};

/** Tópico e filas são FIFO (ordem por agregado e deduplicação): a AWS exige o sufixo. */
const fifoName = (fallback: string) =>
  z.string().min(1).endsWith('.fifo', 'Precisa ser um recurso FIFO (terminar em .fifo)').default(fallback);

/** Nomes da fila do tempo real e da fila morta dela. */
export const realtimeQueueEnvShape = {
  REALTIME_QUEUE_NAME: fifoName('fastmeals-realtime.fifo'),
  REALTIME_DLQ_NAME: fifoName('fastmeals-realtime-dlq.fifo'),
};

export function awsClientConfig(env: { AWS_REGION: string; AWS_ENDPOINT_URL?: string | undefined }): AwsClientConfig {
  return { region: env.AWS_REGION, endpoint: env.AWS_ENDPOINT_URL };
}

/** `messaging-setup`: o que criar e com que limites. */
const messagingSetupEnvSchema = z.object({
  ...awsEnvShape,
  ...realtimeQueueEnvShape,
  EVENTS_TOPIC_NAME: fifoName('fastmeals-events.fifo'),
  /** Recebimentos sem sucesso até a mensagem ir para a fila morta. */
  REALTIME_MAX_RECEIVE_COUNT: z.coerce.number().int().min(1).max(1_000).default(5),
  /** Quanto a mensagem some da fila enquanto é processada (e espera até reaparecer). */
  REALTIME_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(43_200).default(30),
  /** Quanto esperar o emulador/AWS responder antes de desistir. */
  MESSAGING_SETUP_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(60_000),
});

/** CLI da fila morta do SQS. */
const eventsDeadLettersEnvSchema = z.object({ ...awsEnvShape, ...realtimeQueueEnvShape });

export type MessagingSetupEnv = z.output<typeof messagingSetupEnvSchema>;
export type EventsDeadLettersEnv = z.output<typeof eventsDeadLettersEnvSchema>;

export function loadMessagingSetupEnv(source: NodeJS.ProcessEnv = process.env): MessagingSetupEnv {
  return parse(messagingSetupEnvSchema, source, 'messaging-setup');
}

export function loadEventsDeadLettersEnv(source: NodeJS.ProcessEnv = process.env): EventsDeadLettersEnv {
  return parse(eventsDeadLettersEnvSchema, source, 'events-dead-letters');
}

function parse<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv, process: string): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas (${process}):\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
