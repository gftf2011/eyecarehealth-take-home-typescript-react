import type { Scheduler } from '../scheduler';

/**
 * Junta uma rajada em, no máximo, uma recarga por intervalo:
 * - o primeiro item sai **na hora** (um evento isolado não espera nada);
 * - os que chegam durante o intervalo se acumulam e saem juntos no fim dele;
 * - sem novos itens no intervalo, volta a ficar ocioso.
 *
 * Assim, 50 eventos por segundo custam a mesma coisa que um a cada
 * `intervalMs`, por tela aberta, e a tela nunca fica mais que `intervalMs`
 * atrasada.
 */
export class RefreshThrottle<T> {
  readonly #scheduler: Scheduler;
  readonly #intervalMs: number;
  readonly #flush: (batch: readonly T[]) => void;
  #pending: T[] = [];
  #cancelWindow: (() => void) | null = null;

  constructor(scheduler: Scheduler, intervalMs: number, flush: (batch: readonly T[]) => void) {
    this.#scheduler = scheduler;
    this.#intervalMs = intervalMs;
    this.#flush = flush;
  }

  push(item: T): void {
    if (this.#cancelWindow !== null) {
      this.#pending.push(item);
      return;
    }
    this.#flush([item]);
    this.#openWindow();
  }

  /** Itens que ainda vão sair no fim do intervalo atual. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Descarta o que estava acumulado e encerra o intervalo (ex.: a tela vai recarregar tudo). */
  reset(): void {
    this.#pending = [];
    this.#cancelWindow?.();
    this.#cancelWindow = null;
  }

  #openWindow(): void {
    this.#cancelWindow = this.#scheduler.schedule(() => {
      this.#cancelWindow = null;
      if (this.#pending.length === 0) return;
      const batch = this.#pending;
      this.#pending = [];
      this.#flush(batch);
      this.#openWindow();
    }, this.#intervalMs);
  }
}
