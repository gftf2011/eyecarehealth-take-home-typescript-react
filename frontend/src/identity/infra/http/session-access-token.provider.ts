import type { Clock, UseCase } from '../../../shared-kernel/application';
import type { AccessTokenProvider } from '../../../shared-kernel/infra';
import type { SessionDto, SessionStore } from '../../application';

/** Renova quando faltar menos que isso para o token vencer (evita chegar expirado à API). */
export const RENEWAL_MARGIN_MS = 30_000;

/**
 * Liga o cliente HTTP à sessão do Identity:
 *
 * - entrega o token atual, renovando antes se estiver vencendo;
 * - num `401`, renova uma vez — ou reaproveita o token novo se outra
 *   requisição já renovou nesse meio-tempo;
 * - várias requisições ao mesmo tempo compartilham **uma** renovação.
 */
export class SessionAccessTokenProvider implements AccessTokenProvider {
  #renewal: Promise<string | null> | null = null;

  constructor(
    private readonly sessions: SessionStore,
    private readonly renewSession: UseCase<void, SessionDto | null>,
    private readonly clock: Clock,
    private readonly marginMs: number = RENEWAL_MARGIN_MS,
  ) {}

  async currentToken(): Promise<string | null> {
    const state = this.sessions.state();
    if (state.status !== 'authenticated') return null;
    if (!state.session.isExpiringWithin(this.marginMs, this.clock.now())) {
      return state.session.accessToken;
    }
    return this.#renew();
  }

  async tokenRejected(rejectedToken: string): Promise<string | null> {
    const state = this.sessions.state();
    if (state.status !== 'authenticated') return null;
    if (state.session.accessToken !== rejectedToken) return state.session.accessToken;
    return this.#renew();
  }

  /** Renovação antecipada (agendador), compartilhando a renovação em andamento, se houver. */
  renewNow(): Promise<string | null> {
    return this.#renew();
  }

  #renew(): Promise<string | null> {
    this.#renewal ??= this.renewSession
      .execute()
      .then(() => this.#tokenInStore())
      .finally(() => {
        this.#renewal = null;
      });
    return this.#renewal;
  }

  #tokenInStore(): string | null {
    const state = this.sessions.state();
    return state.status === 'authenticated' ? state.session.accessToken : null;
  }
}
