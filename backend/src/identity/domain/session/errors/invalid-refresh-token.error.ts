import { AuthenticationError } from '../../../../shared-kernel/domain/index';

export type InvalidRefreshTokenReason = 'not-found' | 'expired' | 'revoked' | 'reuse-detected';

/**
 * Refresh token recusado. O motivo fica disponível para logs/auditoria, mas a
 * mensagem para o cliente é genérica.
 */
export class InvalidRefreshTokenError extends AuthenticationError {
  readonly code = 'INVALID_REFRESH_TOKEN';
  readonly reason: InvalidRefreshTokenReason;

  constructor(reason: InvalidRefreshTokenReason) {
    super('Refresh token inválido ou expirado');
    this.reason = reason;
  }
}
