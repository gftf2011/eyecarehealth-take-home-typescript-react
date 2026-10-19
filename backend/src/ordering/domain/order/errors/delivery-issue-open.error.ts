import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';

/** Com problema relatado, a entrega fica parada até o gestor decidir (nem o entregador nem o painel a concluem). */
export class DeliveryIssueOpenError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_ISSUE_OPEN';

  constructor() {
    super('Há um problema relatado nesta entrega: ela só continua depois da decisão do gestor');
  }
}
