import { channelOf, MESSAGE_CHANNEL_PREFIX } from '../../shared-kernel/infra/cache/redis/redis-channel';
import type { RedisConnection } from '../../shared-kernel/infra/cache/redis/redis-connection';
import { lazily, meter } from '../../shared-kernel/infra/observability/telemetry';
import { toRealtimeEvent } from './broker-envelope';

const forwarded = lazily(() =>
  meter().createCounter('fastmeals.realtime.events.forwarded', {
    description: 'Eventos repassados da fila para as réplicas do gateway, por tópico',
    unit: '{event}',
  }),
);

/** A mensagem da fila não segue o envelope do relay: repetir não adianta. */
export class InvalidEnvelopeError extends Error {
  constructor() {
    super('Mensagem da fila fora do envelope do relay');
    this.name = 'InvalidEnvelopeError';
  }
}

/**
 * Ponte da fila do tempo real (SQS) para o Redis pub/sub. A fila entrega cada
 * mensagem a **uma** réplica do gateway; o Redis a espalha para **todas**, e
 * cada uma repassa aos painéis conectados nela.
 *
 * Lança se não conseguir publicar (Redis fora) ou se o envelope for inválido:
 * a mensagem volta à fila e, no limite de recebimentos, vai para a fila morta.
 */
export class RealtimeFanoutForwarder {
  constructor(
    private readonly redis: RedisConnection,
    private readonly channelPrefix = MESSAGE_CHANNEL_PREFIX,
  ) {}

  async forward(body: string): Promise<void> {
    const event = toRealtimeEvent(body);
    if (event === null) throw new InvalidEnvelopeError();
    await this.redis.publish(channelOf(event.topic, this.channelPrefix), body);
    forwarded().add(1, { 'messaging.destination.name': event.topic });
  }
}
