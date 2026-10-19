import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** Já há um problema relatado esperando o gestor decidir. */
export class DeliveryIssueAlreadyOpenError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_ISSUE_ALREADY_OPEN';

  constructor() {
    super('Já há um problema nesta entrega aguardando a decisão do gestor');
  }
}
