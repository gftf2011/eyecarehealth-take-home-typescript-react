import { WebSocket } from 'ws';

import { CLOSE_CODES, type CloseCode, type RealtimeConnection, type ServerMessage } from '../application/realtime-protocol';

/**
 * Adapter `ws` → `RealtimeConnection`. Protege o processo de clientes lentos:
 * se o buffer de envio passar do limite, a conexão é fechada (o cliente
 * reconecta e recarrega) em vez de acumular memória indefinidamente.
 */
export class WebSocketConnection implements RealtimeConnection {
  constructor(
    private readonly socket: WebSocket,
    private readonly maxBufferedBytes: number,
  ) {}

  send(message: ServerMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    if (this.socket.bufferedAmount > this.maxBufferedBytes) {
      this.close(CLOSE_CODES.tryAgainLater, 'Cliente lento demais para acompanhar');
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  close(code: CloseCode, reason: string): void {
    if (this.socket.readyState === WebSocket.CLOSING || this.socket.readyState === WebSocket.CLOSED) return;
    this.socket.close(code, reason);
  }
}
