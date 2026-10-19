import { UniqueId } from '../../../../shared-kernel/domain';

export class DeliveryIssueId extends UniqueId {
  declare private readonly brand: 'DeliveryIssueId';

  static generate(): DeliveryIssueId {
    return new DeliveryIssueId(UniqueId.newUuid());
  }

  static from(raw: string): DeliveryIssueId {
    return new DeliveryIssueId(raw, 'deliveryIssueId');
  }
}
