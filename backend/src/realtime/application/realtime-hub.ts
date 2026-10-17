import type { RealtimeSession } from './realtime-session';
import { CLOSE_CODES, type RealtimeEvent } from './realtime-protocol';

/**
 * Sessões abertas nesta réplica do gateway. Cada réplica recebe todos os
 * eventos do broker e os entrega às próprias conexões (fan-out).
 */
export class RealtimeHub {
  readonly #sessions = new Set<RealtimeSession>();

  get connectionCount(): number {
    return this.#sessions.size;
  }

  get authenticatedCount(): number {
    let count = 0;
    for (const session of this.#sessions) if (session.isAuthenticated) count += 1;
    return count;
  }

  add(session: RealtimeSession): void {
    this.#sessions.add(session);
  }

  remove(session: RealtimeSession): void {
    this.#sessions.delete(session);
  }

  /** Entrega a todas as sessões autenticadas (as demais ignoram). */
  broadcast(event: RealtimeEvent): void {
    for (const session of this.#sessions) session.deliver(event);
  }

  /** Encerramento do processo: avisa os clientes para reconectarem. */
  shutdownAll(): void {
    for (const session of this.#sessions) session.shutdown(CLOSE_CODES.serviceRestart, 'Servidor reiniciando');
    this.#sessions.clear();
  }
}
