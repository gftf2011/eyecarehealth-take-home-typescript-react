import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** Só uma sugestão ainda pendente pode ser aceita ou rejeitada. */
export class AssignmentNotPendingError extends BusinessRuleViolationError {
  readonly code = 'ASSIGNMENT_NOT_PENDING';

  constructor(orderId: string) {
    super('Esta sugestão já foi decidida', [{ orderId }]);
  }
}
