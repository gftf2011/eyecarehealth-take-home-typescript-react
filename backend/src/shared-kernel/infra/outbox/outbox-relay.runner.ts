import type { Clock } from '../../application';
import type { OutboxRelayCycle } from './outbox-relay';

export type OutboxRelayRunnerOptions = {
  /** Mensagens por transação. */
  readonly batchSize: number;
  /** Espera entre ciclos quando não há (mais) pendentes. */
  readonly pollIntervalMs: number;
  /** Teto do backoff exponencial após falhas seguidas. Padrão: 10s. */
  readonly maxBackoffMs?: number;
  /** Quanto tempo manter mensagens já entregues. Padrão: 7 dias. */
  readonly retentionMs?: number;
  /** De quanto em quanto tempo remover as entregues antigas. Padrão: 1h. */
  readonly purgeEveryMs?: number;
  readonly clock: Clock;
  /** Erros do ciclo (banco fora do ar etc.): o loop continua, com backoff. */
  readonly onError: (error: unknown) => void;
};

const DEFAULT_MAX_BACKOFF_MS = 10_000;
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PURGE_EVERY_MS = 60 * 60 * 1000;

/**
 * Loop do relay do outbox:
 * - lote cheio → emenda o próximo sem esperar (vazão sob carga);
 * - sem pendentes → espera `pollIntervalMs` (latência máxima no painel);
 * - falha → backoff exponencial até `maxBackoffMs`, sem perder mensagens.
 *
 * `stop()` acorda o loop, espera o ciclo em andamento terminar e só então
 * resolve: nenhum lote fica pela metade no encerramento.
 */
export class OutboxRelayRunner {
  readonly #cycle: OutboxRelayCycle;
  readonly #options: Required<OutboxRelayRunnerOptions>;
  #running = false;
  #loop: Promise<void> | null = null;
  #wake: (() => void) | null = null;
  #lastCycleAt: Date | null = null;
  #lastPurgeAt: Date | null = null;
  #consecutiveFailures = 0;

  constructor(cycle: OutboxRelayCycle, options: OutboxRelayRunnerOptions) {
    this.#cycle = cycle;
    this.#options = {
      maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
      retentionMs: DEFAULT_RETENTION_MS,
      purgeEveryMs: DEFAULT_PURGE_EVERY_MS,
      ...options,
    };
  }

  /** Fim do último ciclo (com ou sem sucesso): batimento para o health check. */
  get lastCycleAt(): Date | null {
    return this.#lastCycleAt;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#loop = this.#run();
  }

  async stop(): Promise<void> {
    this.#running = false;
    this.#wake?.();
    await this.#loop;
    this.#loop = null;
  }

  /** O loop está vivo: rodando e com um ciclo concluído há no máximo `maxStaleMs`. */
  isAlive(maxStaleMs: number): boolean {
    if (!this.#running || this.#lastCycleAt === null) return false;
    return this.#options.clock.now().getTime() - this.#lastCycleAt.getTime() <= maxStaleMs;
  }

  async #run(): Promise<void> {
    while (this.#running) {
      const delayMs = await this.#cycleOnce();
      await this.#purgeIfDue();
      this.#lastCycleAt = this.#options.clock.now();
      // `stop()` pode ter chegado durante o ciclo: não dorme à toa no encerramento.
      if (delayMs > 0 && this.#running) await this.#sleep(delayMs);
    }
  }

  /** Roda um lote e devolve quanto esperar antes do próximo. */
  async #cycleOnce(): Promise<number> {
    try {
      const { published, failed } = await this.#cycle.relayBatch(this.#options.batchSize);
      if (failed > 0) return this.#backoff();
      this.#consecutiveFailures = 0;
      return published >= this.#options.batchSize ? 0 : this.#options.pollIntervalMs;
    } catch (error) {
      this.#options.onError(error);
      return this.#backoff();
    }
  }

  #backoff(): number {
    this.#consecutiveFailures += 1;
    const exponential = this.#options.pollIntervalMs * 2 ** this.#consecutiveFailures;
    return Math.min(exponential, this.#options.maxBackoffMs);
  }

  async #purgeIfDue(): Promise<void> {
    const now = this.#options.clock.now();
    if (this.#lastPurgeAt !== null && now.getTime() - this.#lastPurgeAt.getTime() < this.#options.purgeEveryMs) {
      return;
    }
    this.#lastPurgeAt = now;
    try {
      await this.#cycle.purgePublishedBefore(new Date(now.getTime() - this.#options.retentionMs));
    } catch (error) {
      this.#options.onError(error);
    }
  }

  /** Espera `ms`, mas acorda na hora se `stop()` for chamado. */
  async #sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      this.#wake = done;
      function done(): void {
        clearTimeout(timer);
        resolve();
      }
    });
    this.#wake = null;
  }
}
