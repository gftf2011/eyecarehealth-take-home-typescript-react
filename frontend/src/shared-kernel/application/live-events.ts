/** Evento de integração vindo do backend em tempo real (ex.: um pedido mudou). */
export type LiveEvent = {
  /** Único por evento: repetidos já foram descartados antes de chegar aqui. */
  readonly id: string;
  readonly topic: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

/**
 * Canal dos eventos em tempo real dentro do painel. O contexto Realtime
 * publica; cada contexto assina os tópicos que lhe interessam e atualiza as
 * próprias telas, sem que um conheça o outro.
 */
export interface LiveEventBus {
  publish(event: LiveEvent): void;
  /** A conexão voltou depois de cair: eventos podem ter se perdido, então recarregue. */
  resync(): void;
  subscribe(topic: string, listener: (event: LiveEvent) => void): () => void;
  onResync(listener: () => void): () => void;
}
