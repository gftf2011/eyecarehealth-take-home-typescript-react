import { UniqueId } from '../../../../shared-kernel/domain/index.js';

/** Referência a um pedido do contexto Ordering. */
export class OrderId extends UniqueId {
  declare private readonly brand: 'Delivery.OrderId';

  static from(raw: string): OrderId {
    return new OrderId(raw, 'orderId');
  }
}
