import { InvalidValueError } from '../../../shared-kernel/domain';

export class TooManyOrderItemsError extends InvalidValueError {
  readonly code = 'TOO_MANY_ORDER_ITEMS';

  constructor(maxItems: number) {
    super('items', `O pedido deve ter no máximo ${maxItems} itens`);
  }
}
