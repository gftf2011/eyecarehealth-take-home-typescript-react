import type { Clock } from '../../../shared-kernel/application';
import type { SessionStore } from '../../application';

export type SessionRenewalSchedulerOptions = {
  /** Quanto antes do vencimento renovar. */
  readonly marginMs?: number;
  /** Intervalo mínimo entre renovações (protege contra tokens de vida muito curta). */
  readonly minDelayMs?: number;
  /** Nova tentativa depois de uma falha transitória (rede, 5xx). */
  readonly retryDelayMs?: number;
};

type Renewer = { renewNow(): Promise<string | null> };

/**
 * Mantém a sessão viva enquanto o painel está aberto: agenda a renovação um
 * pouco antes do access token vencer. Assim o painel em tempo real não fica
 * com token vencido, e uma sessão revogada (refresh recusado) leva ao login
 * na hora, sem esperar o usuário clicar em algo.
 */
export class SessionRenewalScheduler {
  readonly #marginMs: number;
  readonly #minDelayMs: number;
  readonly #retryDelayMs: number;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly sessions: SessionStore,
    private readonly renewer: Renewer,
    private readonly clock: Clock,
    options: SessionRenewalSchedulerOptions = {},
  ) {
    this.#marginMs = options.marginMs ?? 60_000;
    this.#minDelayMs = options.minDelayMs ?? 5_000;
    this.#retryDelayMs = options.retryDelayMs ?? 30_000;
  }

  start(): void {
    if (this.#unsubscribe !== null) return;
    this.#unsubscribe = this.sessions.subscribe(() => this.#reschedule());
    this.#reschedule();
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#clear();
  }

  #reschedule(): void {
    this.#clear();
    const state = this.sessions.state();
    if (state.status !== 'authenticated') return;

    const expiresInMs = state.session.accessTokenExpiresAt.getTime() - this.clock.now().getTime();
    this.#schedule(Math.max(this.#minDelayMs, expiresInMs - this.#marginMs));
  }

  #schedule(delayMs: number): void {
    this.#timer = setTimeout(() => {
      this.#timer = null;
      // Sucesso ou expiração mudam a sessão e reagendam pelo subscribe.
      this.renewer.renewNow().catch(() => {
        if (this.sessions.state().status === 'authenticated') this.#schedule(this.#retryDelayMs);
      });
    }, delayMs);
  }

  #clear(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
