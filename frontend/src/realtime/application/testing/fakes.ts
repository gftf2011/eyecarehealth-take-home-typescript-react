import type { Scheduler } from '../../../shared-kernel/application';
import type { RealtimeSocket, RealtimeSocketFactory, RealtimeSocketHandlers } from '../ports/realtime-socket';
import type { RealtimeTokenSource } from '../ports/realtime-token-source';

/** Uma conexão aberta pelo serviço, controlada pelo teste como se fosse o gateway. */
export class FakeSocket implements RealtimeSocket {
  readonly sent: string[] = [];
  closedByClient = false;

  constructor(private readonly handlers: RealtimeSocketHandlers) {}

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closedByClient = true;
  }

  open(): void {
    this.handlers.onOpen();
  }

  receive(message: unknown): void {
    this.handlers.onMessage(typeof message === 'string' ? message : JSON.stringify(message));
  }

  ready(): void {
    this.receive({ type: 'ready', expiresAt: '2026-10-18T12:15:00.000Z' });
  }

  closeByServer(code: number): void {
    this.handlers.onClose(code);
  }

  get authTokens(): string[] {
    return this.sent.map((text) => (JSON.parse(text) as { accessToken: string }).accessToken);
  }
}

export class FakeSocketFactory implements RealtimeSocketFactory {
  readonly sockets: FakeSocket[] = [];

  open(handlers: RealtimeSocketHandlers): RealtimeSocket {
    const socket = new FakeSocket(handlers);
    this.sockets.push(socket);
    return socket;
  }

  get last(): FakeSocket {
    const socket = this.sockets.at(-1);
    if (socket === undefined) throw new Error('nenhuma conexão aberta');
    return socket;
  }
}

/** Agendador manual: o teste decide quando as tarefas rodam. */
export class ManualScheduler implements Scheduler {
  readonly pending: { task: () => void; delayMs: number }[] = [];

  schedule(task: () => void, delayMs: number): () => void {
    const entry = { task, delayMs };
    this.pending.push(entry);
    return () => {
      const index = this.pending.indexOf(entry);
      if (index >= 0) this.pending.splice(index, 1);
    };
  }

  runNext(): number {
    const entry = this.pending.shift();
    if (entry === undefined) throw new Error('nada agendado');
    entry.task();
    return entry.delayMs;
  }
}

export class FakeTokenSource implements RealtimeTokenSource {
  token: string | null = 'token-1';
  renewTo: string | null = 'token-renovado';
  renewals = 0;
  readonly #listeners = new Set<(token: string | null) => void>();

  current(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  renew(): Promise<string | null> {
    this.renewals += 1;
    this.token = this.renewTo;
    return Promise.resolve(this.renewTo);
  }

  subscribe(listener: (token: string | null) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  change(token: string | null): void {
    this.token = token;
    for (const listener of [...this.#listeners]) listener(token);
  }
}
