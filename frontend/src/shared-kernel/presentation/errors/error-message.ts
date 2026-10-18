import { RateLimitedError } from '../../application';
import { DomainError } from '../../domain';

const UNEXPECTED_MESSAGE = 'Algo deu errado. Tente novamente.';

/**
 * Mensagem para mostrar ao usuário. Erros conhecidos já trazem uma mensagem
 * legível (do Value Object ou da API); qualquer outro vira uma mensagem
 * genérica, sem vazar detalhes técnicos.
 */
export function errorMessage(error: unknown): string {
  if (!(error instanceof DomainError)) return UNEXPECTED_MESSAGE;

  const seconds = error instanceof RateLimitedError ? error.retryAfterSeconds : null;
  if (seconds !== null && seconds > 0) {
    return `${error.message.replace(/\.$/, '')}. Tente novamente em ${seconds} s.`;
  }
  return error.message;
}
