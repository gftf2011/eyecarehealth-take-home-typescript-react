import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** Só uma entrega em andamento pode ter um problema relatado. */
export class DeliveryNotInProgressError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_NOT_IN_PROGRESS';

  constructor() {
    super('Só é possível relatar problema numa entrega em andamento');
  }
}
