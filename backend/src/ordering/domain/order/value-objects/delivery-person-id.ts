import { UniqueId } from '../../../../shared-kernel/domain/index.js';

/** Referência a um entregador do contexto Delivery. */
export class DeliveryPersonId extends UniqueId {
  declare private readonly brand: 'Ordering.DeliveryPersonId';

  static from(raw: string): DeliveryPersonId {
    return new DeliveryPersonId(raw, 'deliveryPersonId');
  }
}
