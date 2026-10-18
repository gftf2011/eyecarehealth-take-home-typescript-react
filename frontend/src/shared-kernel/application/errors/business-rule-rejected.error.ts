import { BusinessRuleViolationError, type DomainErrorDetail } from '../../domain';

/** `422`: a API recusou a operação por uma regra de negócio (ex.: transição inválida). */
export class BusinessRuleRejectedError extends BusinessRuleViolationError {
  constructor(
    readonly code: string,
    message: string,
    details: readonly DomainErrorDetail[] = [],
  ) {
    super(message, details);
  }
}
