import {
  CreateTopicCommand,
  ListSubscriptionsByTopicCommand,
  SetSubscriptionAttributesCommand,
  SubscribeCommand,
  type SNSClient,
} from '@aws-sdk/client-sns';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  SetQueueAttributesCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs';

import { TOPIC_ATTRIBUTE } from './sns-message.publisher';

/** Uma fila SQS: a URL para as chamadas e o ARN para políticas e redrive. */
export type QueueRef = { readonly url: string; readonly arn: string };

export type MessagingTopologySpec = {
  /** Tópico SNS FIFO onde o relay publica todos os eventos (termina em `.fifo`). */
  readonly topicName: string;
  /** Fila FIFO assinante do tópico (ex.: a do tempo real; termina em `.fifo`). */
  readonly queueName: string;
  /** A fila morta de uma fila FIFO também precisa ser FIFO. */
  readonly deadLetterQueueName: string;
  /** Recebimentos sem sucesso até a mensagem ir para a fila morta. */
  readonly maxReceiveCount: number;
  /** Quanto tempo a mensagem some da fila enquanto é processada. */
  readonly visibilityTimeoutSeconds: number;
  /** Tópicos lógicos que a fila recebe (filtro da assinatura). Vazio = todos. */
  readonly topics?: readonly string[];
};

export type MessagingTopology = {
  readonly topicArn: string;
  readonly queue: QueueRef;
  readonly deadLetterQueue: QueueRef;
};

/** Mensagens mortas ficam o máximo que o SQS permite: dá tempo de investigar. */
const DEAD_LETTER_RETENTION_SECONDS = 14 * 24 * 60 * 60;

/** Nome de tópico ou fila FIFO: a AWS exige o sufixo. */
const FIFO_SUFFIX = '.fifo';

/** Lança se algum nome não for de recurso FIFO (antes de criar qualquer coisa). */
function assertFifoNames(spec: MessagingTopologySpec): void {
  const wrong = [spec.topicName, spec.queueName, spec.deadLetterQueueName].filter((name) => !name.endsWith(FIFO_SUFFIX));
  if (wrong.length > 0) throw new Error(`Tópico e filas precisam ser FIFO (terminar em ${FIFO_SUFFIX}): ${wrong.join(', ')}`);
}

/**
 * Cria (ou confere) tópico, fila, fila morta e assinatura, **todos FIFO**:
 * - tópico com deduplicação explícita (o relay manda o id do outbox como
 *   `MessageDeduplicationId`; conteúdo igual pode ser evento legítimo) e
 *   vazão por grupo (`FifoThroughputScope=MessageGroup`);
 * - fila com deduplicação e vazão por grupo (`DeduplicationScope` e
 *   `FifoThroughputLimit`), o modo de alta vazão do SQS FIFO.
 *
 * Pode rodar de novo sem efeito: é o `messaging-setup` do ambiente local. Em
 * produção, os mesmos recursos viriam da infraestrutura como código.
 */
export async function ensureMessagingTopology(
  sns: SNSClient,
  sqs: SQSClient,
  spec: MessagingTopologySpec,
): Promise<MessagingTopology> {
  assertFifoNames(spec);
  const { TopicArn: topicArn } = await sns.send(
    new CreateTopicCommand({
      Name: spec.topicName,
      Attributes: { FifoTopic: 'true', ContentBasedDeduplication: 'false', FifoThroughputScope: 'MessageGroup' },
    }),
  );
  if (topicArn === undefined) throw new Error(`Tópico ${spec.topicName} sem ARN`);

  const deadLetterQueue = await createQueue(sqs, spec.deadLetterQueueName);
  await setQueueAttributes(sqs, deadLetterQueue, { MessageRetentionPeriod: String(DEAD_LETTER_RETENTION_SECONDS) });

  // Criada só com `FifoQueue` (que não muda depois) e configurada em seguida:
  // `CreateQueue` com atributos diferentes dos atuais falha,
  // `SetQueueAttributes` só sobrescreve.
  const queue = await createQueue(sqs, spec.queueName);
  await setQueueAttributes(sqs, queue, {
    VisibilityTimeout: String(spec.visibilityTimeoutSeconds),
    DeduplicationScope: 'messageGroup',
    FifoThroughputLimit: 'perMessageGroupId',
    RedrivePolicy: JSON.stringify({ deadLetterTargetArn: deadLetterQueue.arn, maxReceiveCount: spec.maxReceiveCount }),
    // Na AWS, a fila só aceita mensagens do nosso tópico.
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'sns.amazonaws.com' },
          Action: 'sqs:SendMessage',
          Resource: queue.arn,
          Condition: { ArnEquals: { 'aws:SourceArn': topicArn } },
        },
      ],
    }),
  });

  await subscribe(sns, topicArn, queue, spec.topics ?? []);
  return { topicArn, queue, deadLetterQueue };
}

/** Fila existente pelo nome (os processos a resolvem no boot). */
export async function findQueue(sqs: SQSClient, name: string): Promise<QueueRef> {
  const { QueueUrl: url } = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
  if (url === undefined) throw new Error(`Fila ${name} não encontrada`);
  return { url, arn: await queueArnOf(sqs, url) };
}

async function createQueue(sqs: SQSClient, name: string): Promise<QueueRef> {
  const { QueueUrl: url } = await sqs.send(new CreateQueueCommand({ QueueName: name, Attributes: { FifoQueue: 'true' } }));
  if (url === undefined) throw new Error(`Fila ${name} sem URL`);
  return { url, arn: await queueArnOf(sqs, url) };
}

async function queueArnOf(sqs: SQSClient, url: string): Promise<string> {
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['QueueArn'] }));
  const arn = Attributes?.QueueArn;
  if (arn === undefined) throw new Error(`Fila ${url} sem ARN`);
  return arn;
}

async function setQueueAttributes(sqs: SQSClient, queue: QueueRef, attributes: Record<string, string>): Promise<void> {
  await sqs.send(new SetQueueAttributesCommand({ QueueUrl: queue.url, Attributes: attributes }));
}

/**
 * Assina a fila no tópico com entrega crua (a fila recebe o envelope, sem o
 * invólucro JSON do SNS) e, se houver, o filtro por tópico lógico. Uma
 * assinatura existente só tem o filtro atualizado: nunca duplica.
 */
async function subscribe(sns: SNSClient, topicArn: string, queue: QueueRef, topics: readonly string[]): Promise<void> {
  const filterPolicy = topics.length > 0 ? JSON.stringify({ [TOPIC_ATTRIBUTE]: [...topics] }) : undefined;
  const { Subscriptions = [] } = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }));
  const existing = Subscriptions.find((subscription) => subscription.Endpoint === queue.arn);

  if (existing?.SubscriptionArn === undefined) {
    await sns.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: 'sqs',
        Endpoint: queue.arn,
        Attributes: { RawMessageDelivery: 'true', ...(filterPolicy !== undefined && { FilterPolicy: filterPolicy }) },
      }),
    );
    return;
  }
  if (filterPolicy !== undefined) {
    await sns.send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: existing.SubscriptionArn,
        AttributeName: 'FilterPolicy',
        AttributeValue: filterPolicy,
      }),
    );
  }
}
