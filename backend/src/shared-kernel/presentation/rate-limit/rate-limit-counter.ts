export type RateLimitHit = {
  /** Requisições contadas na janela atual, incluindo esta. */
  readonly count: number;
  /** Quanto falta para a janela atual expirar, em milissegundos. */
  readonly ttlMs: number;
};

/**
 * Port do contador de rate limit (janela fixa por chave). A camada HTTP só
 * conhece este contrato; a implementação (ex.: Redis, compartilhada entre
 * réplicas) é escolhida no composition root.
 */
export interface RateLimitCounter {
  /** Conta uma requisição para `key`; a janela de `windowMs` começa na primeira. */
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
}
