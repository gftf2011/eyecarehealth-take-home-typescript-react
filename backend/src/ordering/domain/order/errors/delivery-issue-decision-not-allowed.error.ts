import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** A decisão não cabe ao problema relatado (ex.: tentar de novo quando o cliente recusou). */
export class DeliveryIssueDecisionNotAllowedError extends BusinessRuleViolationError {
  readonly code = 'DECISION_NOT_ALLOWED';

  constructor(decision: string, why: string) {
    super(`Não é possível ${why}`, [{ decision }]);
  }
}
