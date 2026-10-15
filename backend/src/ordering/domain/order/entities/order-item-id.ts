import { UniqueId } from '../../../../shared-kernel/domain/index.js';

export class OrderItemId extends UniqueId {
  declare private readonly brand: 'OrderItemId';

  static generate(): OrderItemId {
    return new OrderItemId(UniqueId.newUuid());
  }

  static from(raw: string): OrderItemId {
    return new OrderItemId(raw, 'orderItemId');
  }
}
