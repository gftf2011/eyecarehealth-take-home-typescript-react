/** Prefixo dos canais da aplicação no Redis (o tópico vem depois). */
export const MESSAGE_CHANNEL_PREFIX = 'fastmeals:';

/** Canal Redis de um tópico, ex.: `fastmeals:ordering.order-updates`. */
export function channelOf(topic: string, prefix = MESSAGE_CHANNEL_PREFIX): string {
  return `${prefix}${topic}`;
}
