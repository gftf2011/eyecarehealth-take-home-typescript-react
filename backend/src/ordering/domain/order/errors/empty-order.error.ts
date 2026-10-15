import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class EmptyOrderError extends InvalidValueError {
  readonly code = 'EMPTY_ORDER';

  constructor() {
    super('items', 'O pedido deve ter pelo menos um item');
  }
}
