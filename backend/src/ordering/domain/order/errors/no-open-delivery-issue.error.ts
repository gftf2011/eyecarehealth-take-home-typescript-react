import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** A ação do gestor só existe para uma entrega com problema relatado (e ainda em andamento). */
export class NoOpenDeliveryIssueError extends BusinessRuleViolationError {
  readonly code = 'NO_OPEN_DELIVERY_ISSUE';

  constructor() {
    super('Esta entrega não tem problema relatado pelo entregador');
  }
}
