import type { MessagePublisher, PublishedMessage } from '../../../application';
import type { RedisConnection } from './redis-connection';

/** Prefixo dos canais da aplicação no Redis (o tópico vem depois). */
export const MESSAGE_CHANNEL_PREFIX = 'fastmeals:';

/** Canal Redis de um tópico, ex.: `fastmeals:ordering.order-updates`. */
export function channelOf(topic: string, prefix = MESSAGE_CHANNEL_PREFIX): string {
  return `${prefix}${topic}`;
}

/** Corpo publicado no canal: o envelope que o gateway repassa aos clientes. */
export type MessageEnvelope = {
  readonly id: string;
  readonly topic: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly payload: PublishedMessage['payload'];
};

/**
 * Publica no Redis pub/sub. Pub/sub não guarda mensagens: quem não estiver
 * assinando no momento não recebe — por isso o cliente recarrega o estado ao
 * reconectar, e o outbox continua sendo a fonte de verdade.
 */
export class RedisMessagePublisher implements MessagePublisher {
  constructor(
    private readonly connection: RedisConnection,
    private readonly channelPrefix = MESSAGE_CHANNEL_PREFIX,
  ) {}

  async publish(message: PublishedMessage): Promise<void> {
    const envelope: MessageEnvelope = {
      id: message.id,
      topic: message.topic,
      version: message.version,
      aggregateId: message.aggregateId,
      occurredAt: message.occurredAt.toISOString(),
      payload: message.payload,
    };
    await this.connection.publish(channelOf(message.topic, this.channelPrefix), JSON.stringify(envelope));
  }
}
