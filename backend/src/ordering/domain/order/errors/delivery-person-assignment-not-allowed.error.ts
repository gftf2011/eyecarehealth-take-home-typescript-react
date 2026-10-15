import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';
import type { OrderStatusValue } from '../value-objects/order-status';

export class DeliveryPersonAssignmentNotAllowedError extends BusinessRuleViolationError {
  readonly code = 'ASSIGNMENT_NOT_ALLOWED';

  constructor(status: OrderStatusValue) {
    super(`Não é possível atribuir entregador a um pedido com status '${status}'`, [{ status }]);
  }
}
