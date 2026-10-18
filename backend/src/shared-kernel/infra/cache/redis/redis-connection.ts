import { once } from 'node:events';

import { Redis } from 'ioredis';

export type RedisConnectionOptions = {
  /** Erros de conexão (o cliente segue reconectando em segundo plano). */
  readonly onError: (error: Error) => void;
};

/**
 * Conexão Redis da aplicação. Encapsula o ioredis: o resto do código usa só
 * esta classe e os adapters desta pasta.
 *
 * Configurada para falhar rápido (sem fila offline, uma tentativa por
 * comando): com o Redis fora do ar, quem usa decide o que fazer em vez de as
 * requisições ficarem penduradas.
 */
export class RedisConnection {
  readonly #client: Redis;

  private constructor(client: Redis) {
    this.#client = client;
  }

  static open(url: string, options: RedisConnectionOptions): RedisConnection {
    const client = new Redis(url, {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    client.on('error', options.onError);
    return new RedisConnection(client);
  }

  /** Aguarda a conexão ficar pronta para receber comandos. */
  async ready(): Promise<void> {
    if (this.#client.status === 'ready') return;
    await once(this.#client, 'ready');
  }

  /** Conectado e aceitando comandos (sem fila offline, comandos fora disso falham). */
  get isReady(): boolean {
    return this.#client.status === 'ready';
  }

  /** Lança se o Redis não responder (usado pelo health check). */
  async ping(): Promise<void> {
    await this.#client.ping();
  }

  /** Executa um script Lua atomicamente. Uso restrito aos adapters de infra. */
  async evalScript(script: string, keys: readonly string[], args: readonly (string | number)[]): Promise<unknown> {
    return this.#client.eval(script, keys.length, ...keys, ...args);
  }

  /** Publica em um canal pub/sub; devolve quantos assinantes receberam. */
  async publish(channel: string, message: string): Promise<number> {
    return this.#client.publish(channel, message);
  }

  /** Encerra a conexão: graciosamente se conectado, imediatamente se não. */
  async close(): Promise<void> {
    if (this.#client.status === 'ready') await this.#client.quit();
    else this.#client.disconnect();
  }
}
