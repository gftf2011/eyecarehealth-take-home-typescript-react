import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';
import type { OrderStatusValue } from '../value-objects/order-status';

export class InvalidStatusTransitionError extends BusinessRuleViolationError {
  readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(from: OrderStatusValue, to: OrderStatusValue, reason?: string) {
    const message = `Não é possível alterar o status de '${from}' para '${to}'`;
    super(reason === undefined ? message : `${message}: ${reason}`, [{ from, to }]);
  }
}
