import type { LiveEvent, LiveEventBus } from '../../application';

/** Canal em memória (uma instância por aba). Um assinante que falha não impede os outros. */
export class InMemoryLiveEventBus implements LiveEventBus {
  readonly #topics = new Map<string, Set<(event: LiveEvent) => void>>();
  readonly #resync = new Set<() => void>();

  publish(event: LiveEvent): void {
    for (const listener of [...(this.#topics.get(event.topic) ?? [])]) {
      notify(() => listener(event));
    }
  }

  resync(): void {
    for (const listener of [...this.#resync]) notify(listener);
  }

  subscribe(topic: string, listener: (event: LiveEvent) => void): () => void {
    const listeners = this.#topics.get(topic) ?? new Set();
    listeners.add(listener);
    this.#topics.set(topic, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  onResync(listener: () => void): () => void {
    this.#resync.add(listener);
    return () => {
      this.#resync.delete(listener);
    };
  }
}

function notify(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    console.error('Falha ao tratar evento em tempo real', error);
  }
}
