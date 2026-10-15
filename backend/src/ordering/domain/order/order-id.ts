import { UniqueId } from '../../../shared-kernel/domain';

export class OrderId extends UniqueId {
  declare private readonly brand: 'OrderId';

  static generate(): OrderId {
    return new OrderId(UniqueId.newUuid());
  }

  static from(raw: string): OrderId {
    return new OrderId(raw, 'orderId');
  }
}
