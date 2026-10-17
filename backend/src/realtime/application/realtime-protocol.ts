import type { JsonObject } from '../../shared-kernel/domain';

/** Evento de integração repassado aos clientes (vindo do broker). */
export type RealtimeEvent = {
  /** Chave de idempotência: o cliente descarta repetidos (entrega pelo menos uma vez). */
  readonly id: string;
  readonly topic: string;
  readonly occurredAt: string;
  readonly payload: JsonObject;
};

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { readonly type: 'ready'; readonly expiresAt: string }
  | ({ readonly type: 'event' } & RealtimeEvent);

/**
 * Códigos de fechamento do WebSocket. A faixa 4000–4999 é da aplicação; os
 * da faixa 1000 seguem a RFC 6455.
 */
export const CLOSE_CODES = {
  /** Mensagem do cliente fora do protocolo. */
  invalidMessage: 4400,
  /** Sem autenticação no prazo, token inválido ou expirado: reconectar com token válido. */
  unauthorized: 4401,
  /** Autenticado, mas sem permissão para o canal. */
  forbidden: 4403,
  /** Erro inesperado no servidor. */
  internalError: 1011,
  /** Servidor reiniciando (deploy): reconectar. */
  serviceRestart: 1012,
  /** Cliente lento demais para acompanhar: reconectar e recarregar. */
  tryAgainLater: 1013,
} as const;

export type CloseCode = (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES];

/** Conexão de um cliente, vista pela aplicação (sem saber de WebSocket). */
export interface RealtimeConnection {
  send(message: ServerMessage): void;
  close(code: CloseCode, reason: string): void;
}
