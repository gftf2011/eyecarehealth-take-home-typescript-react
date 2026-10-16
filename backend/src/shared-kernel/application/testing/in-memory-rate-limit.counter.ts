import type { RateLimitCounter, RateLimitHit } from '../index';

type Window = { count: number; expiresAt: number };

/** Acima deste tamanho, janelas expiradas são varridas a cada contagem. */
const SWEEP_THRESHOLD = 10_000;

/**
 * Contador de janela fixa em memória, só para testes de unidade (relógio
 * controlável, sem I/O). Em execução, o rate limit usa sempre o Redis.
 */
export class InMemoryRateLimitCounter implements RateLimitCounter {
  readonly #windows = new Map<string, Window>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = this.now();
    if (this.#windows.size > SWEEP_THRESHOLD) this.sweep(now);

    const current = this.#windows.get(key);
    const window =
      current === undefined || current.expiresAt <= now
        ? { count: 0, expiresAt: now + windowMs }
        : current;
    window.count += 1;
    this.#windows.set(key, window);

    return { count: window.count, ttlMs: window.expiresAt - now };
  }

  async peek(key: string): Promise<RateLimitHit> {
    const now = this.now();
    const window = this.#windows.get(key);
    if (window === undefined || window.expiresAt <= now) return { count: 0, ttlMs: 0 };
    return { count: window.count, ttlMs: window.expiresAt - now };
  }

  private sweep(now: number): void {
    for (const [key, window] of this.#windows) {
      if (window.expiresAt <= now) this.#windows.delete(key);
    }
  }
}
