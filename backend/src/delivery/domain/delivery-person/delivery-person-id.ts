import { UniqueId } from '../../../shared-kernel/domain';

export class DeliveryPersonId extends UniqueId {
  declare private readonly brand: 'DeliveryPersonId';

  static generate(): DeliveryPersonId {
    return new DeliveryPersonId(UniqueId.newUuid());
  }

  static from(raw: string): DeliveryPersonId {
    return new DeliveryPersonId(raw, 'deliveryPersonId');
  }
}
