import type { SessionEndReason, SessionState, SessionStore } from '../../application';
import type { Session } from '../../domain';

/**
 * Sessão só em memória: some ao fechar ou recarregar a aba, de propósito
 * (nada de token em `localStorage`, onde um XSS o leria). Começa em
 * `restoring` até a primeira tentativa de restaurar pelo cookie.
 */
export class InMemorySessionStore implements SessionStore {
  #state: SessionState = { status: 'restoring' };
  readonly #listeners = new Set<() => void>();

  state(): SessionState {
    return this.#state;
  }

  authenticate(session: Session): void {
    this.#change({ status: 'authenticated', session });
  }

  end(reason: SessionEndReason | null): void {
    this.#change({ status: 'anonymous', endedBy: reason });
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #change(next: SessionState): void {
    this.#state = next;
    for (const listener of [...this.#listeners]) listener();
  }
}
