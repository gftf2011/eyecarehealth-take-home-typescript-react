import type { RealtimeSocket, RealtimeSocketFactory, RealtimeSocketHandlers } from '../../application';

/**
 * WebSocket do navegador para o gateway (`/realtime` na mesma origem, via
 * proxy do Vite ou do nginx). O navegador envia o Origin, que o gateway
 * confere na allowlist; o token vai na primeira mensagem, nunca na URL.
 */
export class BrowserRealtimeSocketFactory implements RealtimeSocketFactory {
  constructor(private readonly url: string) {}

  open(handlers: RealtimeSocketHandlers): RealtimeSocket {
    const socket = new WebSocket(this.url);
    socket.addEventListener('open', () => handlers.onOpen());
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data === 'string') handlers.onMessage(event.data);
    });
    const onClose = (event: CloseEvent): void => handlers.onClose(event.code);
    socket.addEventListener('close', onClose);

    return {
      send: (text) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(text);
      },
      close: () => {
        // Fechamento pedido pelo painel: não é uma queda, não reconecta.
        socket.removeEventListener('close', onClose);
        socket.close(1000, 'Encerrado pelo painel');
      },
    };
  }
}
