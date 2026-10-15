import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { ProductId } from '../product-id';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type';

export type ProductDetailField =
  | 'name'
  | 'description'
  | 'price'
  | 'category'
  | 'imageUrl'
  | 'preparationTime';

export type ProductUpdatedPayload = {
  changedFields: readonly ProductDetailField[];
};

export class ProductUpdated extends DomainEvent<ProductUpdatedPayload> {
  readonly eventName = 'catalog.product.updated';
  readonly aggregateType = PRODUCT_AGGREGATE_TYPE;

  constructor(productId: ProductId, occurredAt: Date, payload: ProductUpdatedPayload) {
    super(productId.value, occurredAt, payload);
  }
}
