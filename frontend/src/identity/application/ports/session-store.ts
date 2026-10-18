import type { Session } from '../../domain';

/** Por que não há sessão: o usuário saiu ou a sessão expirou (refresh recusado). */
export type SessionEndReason = 'signed-out' | 'expired';

export type SessionState =
  /** Verificando, ao abrir o painel, se o cookie de refresh ainda vale. */
  | { readonly status: 'restoring' }
  | { readonly status: 'authenticated'; readonly session: Session }
  | { readonly status: 'anonymous'; readonly endedBy: SessionEndReason | null };

/**
 * Guarda a sessão atual em memória e avisa quem observa (a interface reage a
 * login, renovação e expiração). `state()` devolve a mesma referência até a
 * próxima mudança.
 */
export interface SessionStore {
  state(): SessionState;
  authenticate(session: Session): void;
  end(reason: SessionEndReason | null): void;
  subscribe(listener: () => void): () => void;
}
