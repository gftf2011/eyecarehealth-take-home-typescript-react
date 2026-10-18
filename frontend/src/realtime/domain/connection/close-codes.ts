/** Códigos de fechamento do gateway (4000–4999 da aplicação; 1000–1015 da RFC 6455). */
export const CLOSE_CODES = {
  normal: 1000,
  goingAway: 1001,
  abnormal: 1006,
  internalError: 1011,
  serviceRestart: 1012,
  tryAgainLater: 1013,
  invalidMessage: 4400,
  unauthorized: 4401,
  forbidden: 4403,
} as const;

/** O que o painel faz quando a conexão fecha. */
export type CloseReaction =
  /** Token ausente, inválido ou vencido: renova a sessão e reconecta. */
  | 'renew-and-reconnect'
  /** Queda, deploy, servidor sobrecarregado: reconecta com espera crescente. */
  | 'reconnect'
  /** O perfil não pode assinar o canal: não adianta tentar de novo. */
  | 'give-up';

/**
 * Reação a cada código. Na dúvida (códigos desconhecidos, queda de rede), o
 * painel tenta de novo: o pior caso é uma reconexão a mais com backoff.
 */
export function reactionTo(code: number): CloseReaction {
  if (code === CLOSE_CODES.unauthorized) return 'renew-and-reconnect';
  if (code === CLOSE_CODES.forbidden) return 'give-up';
  // Mensagem fora do protocolo é bug do cliente: repetir a mesma mensagem não ajuda.
  if (code === CLOSE_CODES.invalidMessage) return 'give-up';
  return 'reconnect';
}
