import type { LiveEventBus, Scheduler } from '../../../shared-kernel/application';
import { CLOSE_CODES, ReconnectBackoff, RecentEventIds, reactionTo, type LiveStatus } from '../../domain';
import { authMessage, parseServerMessage } from '../messages/server-message';
import type { RealtimeSocket, RealtimeSocketFactory } from '../ports/realtime-socket';
import type { RealtimeTokenSource } from '../ports/realtime-token-source';

export type LiveConnectionDependencies = {
  readonly sockets: RealtimeSocketFactory;
  readonly tokens: RealtimeTokenSource;
  readonly events: LiveEventBus;
  readonly scheduler: Scheduler;
  /** Número em [0, 1) para o jitter do backoff (injetado nos testes). */
  readonly random: () => number;
  readonly backoff?: ReconnectBackoff;
};

/**
 * Conexão do painel com o gateway de tempo real:
 *
 * - conecta quando há sessão e se autentica pela primeira mensagem;
 * - quando o Identity renova o token, reautentica na mesma conexão;
 * - token recusado (`4401`): renova e reconecta; queda ou deploy: reconecta
 *   com espera crescente e aleatória; sem permissão (`4403`): desiste;
 * - descarta eventos repetidos (entrega "pelo menos uma vez");
 * - depois de uma queda, pede às telas que recarreguem (o pub/sub não guarda
 *   o que passou enquanto o painel estava desconectado).
 */
export class LiveConnection {
  readonly #listeners = new Set<() => void>();
  readonly #recent = new RecentEventIds();
  readonly #backoff: ReconnectBackoff;
  #status: LiveStatus = 'idle';
  #socket: RealtimeSocket | null = null;
  #token: string | null = null;
  #attempt = 0;
  #cancelRetry: (() => void) | null = null;
  #awaitingFirstReady = false;
  #wasLive = false;
  #unsubscribeTokens: (() => void) | null = null;

  constructor(private readonly deps: LiveConnectionDependencies) {
    this.#backoff = deps.backoff ?? ReconnectBackoff.create();
  }

  status(): LiveStatus {
    return this.#status;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    if (this.#unsubscribeTokens !== null) return;
    this.#unsubscribeTokens = this.deps.tokens.subscribe((token) => this.#onToken(token));
    this.#onToken(await this.deps.tokens.current());
  }

  stop(): void {
    this.#unsubscribeTokens?.();
    this.#unsubscribeTokens = null;
    this.#disconnect();
  }

  #onToken(token: string | null): void {
    if (token === null) {
      this.#disconnect();
      return;
    }
    const changed = token !== this.#token;
    this.#token = token;
    if (this.#status === 'forbidden') return;
    if (this.#socket === null && this.#cancelRetry === null) {
      this.#connect();
    } else if (changed && this.#socket !== null && this.#status === 'live') {
      // Token renovado: estende a sessão no gateway sem derrubar a conexão.
      this.#socket.send(authMessage(token));
    }
  }

  #connect(): void {
    this.#cancelRetry = null;
    this.#awaitingFirstReady = true;
    this.#setStatus(this.#attempt === 0 ? 'connecting' : 'reconnecting');
    this.#socket = this.deps.sockets.open({
      onOpen: () => {
        if (this.#token !== null) this.#socket?.send(authMessage(this.#token));
      },
      onMessage: (text) => this.#onMessage(text),
      onClose: (code) => void this.#onClose(code),
    });
  }

  #onMessage(text: string): void {
    const message = parseServerMessage(text);
    if (message === null) return;

    if (message.type === 'ready') {
      if (this.#awaitingFirstReady && this.#wasLive) this.deps.events.resync();
      this.#awaitingFirstReady = false;
      this.#wasLive = true;
      this.#attempt = 0;
      this.#setStatus('live');
      return;
    }

    if (!this.#recent.remember(message.id)) return;
    this.deps.events.publish({
      id: message.id,
      topic: message.topic,
      occurredAt: message.occurredAt,
      payload: message.payload,
    });
  }

  async #onClose(code: number): Promise<void> {
    this.#socket = null;
    if (this.#token === null) return;

    const reaction = reactionTo(code);
    if (reaction === 'give-up') {
      this.#setStatus(code === CLOSE_CODES.forbidden ? 'forbidden' : 'unavailable');
      return;
    }
    if (reaction === 'renew-and-reconnect') {
      const renewed = await this.deps.tokens.renew().catch(() => this.#token);
      if (renewed === null) {
        this.#disconnect();
        return;
      }
      this.#token = renewed;
    }
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    const delay = this.#backoff.delayMs(this.#attempt, this.deps.random());
    this.#attempt += 1;
    this.#setStatus('reconnecting');
    this.#cancelRetry = this.deps.scheduler.schedule(() => this.#connect(), delay);
  }

  #disconnect(): void {
    this.#cancelRetry?.();
    this.#cancelRetry = null;
    this.#socket?.close();
    this.#socket = null;
    this.#token = null;
    this.#attempt = 0;
    this.#wasLive = false;
    this.#setStatus('idle');
  }

  #setStatus(status: LiveStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    for (const listener of [...this.#listeners]) listener();
  }
}
