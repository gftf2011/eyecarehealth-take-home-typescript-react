import { randomUUID } from 'node:crypto';

import type { SNSClient } from '@aws-sdk/client-sns';
import type { SQSClient } from '@aws-sdk/client-sqs';
import { inject } from 'vitest';

import { createSnsClient, createSqsClient, type AwsClientConfig } from '../aws-clients';
import { ensureMessagingTopology, type MessagingTopology, type MessagingTopologySpec } from '../messaging-topology';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Endpoint do Floci de teste (ver containers-global-setup). */
    awsEndpoint: string;
  }
}

/** Configuração apontando para o Floci de teste (credenciais quaisquer). */
export function testAwsConfig(): AwsClientConfig {
  return {
    region: 'us-east-1',
    endpoint: inject('awsEndpoint'),
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };
}

export type TestMessaging = MessagingTopology & { readonly sns: SNSClient; readonly sqs: SQSClient };

/**
 * Tópico, fila e fila morta FIFO com nomes únicos: cada teste fica isolado no
 * Floci compartilhado, sem precisar limpá-lo. Visibility timeout curto para
 * as retentativas caberem no teste.
 */
export async function createTestMessaging(overrides: Partial<MessagingTopologySpec> = {}): Promise<TestMessaging> {
  const config = testAwsConfig();
  const sns = createSnsClient(config);
  const sqs = createSqsClient(config);
  const suffix = randomUUID().slice(0, 8);
  const topology = await ensureMessagingTopology(sns, sqs, {
    topicName: `test-events-${suffix}.fifo`,
    queueName: `test-queue-${suffix}.fifo`,
    deadLetterQueueName: `test-dlq-${suffix}.fifo`,
    maxReceiveCount: 2,
    visibilityTimeoutSeconds: 1,
    ...overrides,
  });
  return { ...topology, sns, sqs };
}
