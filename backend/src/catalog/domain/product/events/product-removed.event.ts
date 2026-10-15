import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { ProductId } from '../product-id';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type';

export class ProductRemoved extends DomainEvent<Record<string, never>> {
  readonly eventName = 'catalog.product.removed';
  readonly aggregateType = PRODUCT_AGGREGATE_TYPE;

  constructor(productId: ProductId, occurredAt: Date) {
    super(productId.value, occurredAt, {});
  }
}
