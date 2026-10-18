export type RealtimeSocketHandlers = {
  readonly onOpen: () => void;
  readonly onMessage: (text: string) => void;
  /** Fechou pelo servidor ou por queda; não é chamado quando o próprio painel fecha. */
  readonly onClose: (code: number) => void;
};

export interface RealtimeSocket {
  send(text: string): void;
  /** Fecha por decisão do painel (logout, saída da tela). */
  close(): void;
}

/** Abre conexões com o gateway de tempo real (o WebSocket fica na infra). */
export interface RealtimeSocketFactory {
  open(handlers: RealtimeSocketHandlers): RealtimeSocket;
}
