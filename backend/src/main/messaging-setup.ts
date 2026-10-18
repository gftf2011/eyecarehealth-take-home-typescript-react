/**
 * Cria a topologia de mensageria no Floci (desenvolvimento) ou numa conta
 * AWS: tópico SNS de eventos, fila do tempo real com fila morta e a
 * assinatura entre eles. Pode rodar de novo sem efeito; roda uma vez antes
 * do relay e do gateway, como o `migrate`. Em produção, prefira declarar os
 * mesmos recursos na infraestrutura como código.
 */
import { PRODUCT_UPDATES_TOPIC } from '../catalog/application/messages/product-update.message';
import { ORDER_UPDATES_TOPIC } from '../ordering/application/messages/order-update.message';
import { createSnsClient, createSqsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { ensureMessagingTopology } from '../shared-kernel/infra/messaging/aws/messaging-topology';
import { awsClientConfig, loadMessagingSetupEnv } from './config/messaging-env';

const RETRY_EVERY_MS = 1_000;

async function main(): Promise<void> {
  const env = loadMessagingSetupEnv();
  const config = awsClientConfig(env);
  const sns = createSnsClient(config);
  const sqs = createSqsClient(config);
  const spec = {
    topicName: env.EVENTS_TOPIC_NAME,
    queueName: env.REALTIME_QUEUE_NAME,
    deadLetterQueueName: env.REALTIME_DLQ_NAME,
    maxReceiveCount: env.REALTIME_MAX_RECEIVE_COUNT,
    visibilityTimeoutSeconds: env.REALTIME_VISIBILITY_TIMEOUT_SECONDS,
    // A fila do tempo real só recebe o que o painel acompanha.
    topics: [ORDER_UPDATES_TOPIC, PRODUCT_UPDATES_TOPIC],
  };

  // O emulador pode ainda estar subindo: tenta até o prazo.
  const deadline = Date.now() + env.MESSAGING_SETUP_TIMEOUT_MS;
  try {
    for (;;) {
      try {
        const topology = await ensureMessagingTopology(sns, sqs, spec);
        console.info(`Tópico      ${topology.topicArn}`);
        console.info(`Fila        ${topology.queue.arn} (até ${spec.maxReceiveCount} recebimentos)`);
        console.info(`Fila morta  ${topology.deadLetterQueue.arn}`);
        return;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_EVERY_MS));
      }
    }
  } finally {
    sns.destroy();
    sqs.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
