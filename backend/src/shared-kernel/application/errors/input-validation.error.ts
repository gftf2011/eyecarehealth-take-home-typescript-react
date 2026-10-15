import { DomainError, type DomainErrorDetail } from '../../domain';

/**
 * Entrada de um caso de uso com um ou mais campos inválidos. Agrupa os erros
 * de todos os Value Objects para o cliente corrigir tudo de uma vez.
 */
export class InputValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(details: readonly DomainErrorDetail[]) {
    super('Dados inválidos', details);
  }
}
