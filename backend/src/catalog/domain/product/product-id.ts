import { UniqueId } from '../../../shared-kernel/domain';

export class ProductId extends UniqueId {
  declare private readonly brand: 'ProductId';

  static generate(): ProductId {
    return new ProductId(UniqueId.newUuid());
  }

  static from(raw: string): ProductId {
    return new ProductId(raw, 'productId');
  }
}
