import { NotFoundError } from '../../../../shared-kernel/domain';

export class OrderNotFoundError extends NotFoundError {
  readonly code = 'ORDER_NOT_FOUND';

  constructor(orderId: string) {
    super('Pedido não encontrado', [{ orderId }]);
  }
}
