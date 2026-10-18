export type ReconnectBackoffOptions = {
  readonly baseMs: number;
  readonly maxMs: number;
};

const DEFAULTS: ReconnectBackoffOptions = { baseMs: 1_000, maxMs: 30_000 };

/**
 * Espera entre tentativas de reconexão: dobra a cada falha até um teto, com
 * aleatoriedade ("equal jitter": metade fixa, metade sorteada). Assim, quando
 * o gateway reinicia, as abas de todos os gestores não reconectam no mesmo
 * instante.
 */
export class ReconnectBackoff {
  private constructor(private readonly options: ReconnectBackoffOptions) {}

  static create(options: Partial<ReconnectBackoffOptions> = {}): ReconnectBackoff {
    const merged = { ...DEFAULTS, ...options };
    if (merged.baseMs <= 0 || merged.maxMs < merged.baseMs) {
      throw new RangeError('Backoff inválido: base > 0 e teto >= base');
    }
    return new ReconnectBackoff(merged);
  }

  /**
   * @param attempt tentativa que vai acontecer (0 = primeira reconexão).
   * @param random número em [0, 1) (injetado para os testes serem determinísticos).
   */
  delayMs(attempt: number, random: number): number {
    const exponential = Math.min(this.options.maxMs, this.options.baseMs * 2 ** Math.max(0, attempt));
    const half = exponential / 2;
    return Math.round(half + half * Math.min(Math.max(random, 0), 1));
  }
}
