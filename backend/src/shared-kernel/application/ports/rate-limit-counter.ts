export type RateLimitHit = {
  /** Requisições contadas na janela atual. */
  readonly count: number;
  /** Quanto falta para a janela atual expirar, em milissegundos (0 se não há janela). */
  readonly ttlMs: number;
};

/**
 * Port do contador de janela fixa por chave. A implementação (memória ou
 * Redis, compartilhado entre réplicas) é escolhida no composition root.
 */
export interface RateLimitCounter {
  /** Conta um evento para `key`; a janela de `windowMs` começa no primeiro. */
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  /** Lê a contagem atual sem incrementar. */
  peek(key: string): Promise<RateLimitHit>;
}
