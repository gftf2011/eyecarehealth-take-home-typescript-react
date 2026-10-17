import { Redis } from 'ioredis';

export type RedisSubscriptionOptions = {
  /** Nome da conexão no Redis (`CLIENT LIST`), para observabilidade. */
  readonly connectionName?: string;
  readonly onMessage: (channel: string, body: string) => void;
  /** Erros de conexão (o cliente segue reconectando e se reinscreve sozinho). */
  readonly onError: (error: Error) => void;
};

/**
 * Assinatura de canais pub/sub. Usa conexão **dedicada**: em modo subscribe o
 * Redis não aceita outros comandos nela. Depois de uma queda, o ioredis
 * reconecta e refaz as inscrições (`autoResubscribe`); o que foi publicado
 * no intervalo não é reenviado (pub/sub não guarda mensagens).
 */
export class RedisSubscription {
  readonly #client: Redis;

  private constructor(client: Redis) {
    this.#client = client;
  }

  static async open(
    url: string,
    channels: readonly string[],
    options: RedisSubscriptionOptions,
  ): Promise<RedisSubscription> {
    const client = new Redis(url, {
      connectTimeout: 2_000,
      autoResubscribe: true,
      ...(options.connectionName !== undefined && { connectionName: options.connectionName }),
    });
    client.on('error', options.onError);
    client.on('message', options.onMessage);
    await client.subscribe(...channels);
    return new RedisSubscription(client);
  }

  /** Conectado e inscrito (usado pelo health check). */
  get isReady(): boolean {
    return this.#client.status === 'ready';
  }

  async close(): Promise<void> {
    if (this.#client.status === 'ready') await this.#client.quit();
    else this.#client.disconnect();
  }
}
