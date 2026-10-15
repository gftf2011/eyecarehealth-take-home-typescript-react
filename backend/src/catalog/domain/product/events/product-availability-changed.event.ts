import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { ProductId } from '../product-id.js';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type.js';

export type ProductAvailabilityChangedPayload = {
  isAvailable: boolean;
};

export class ProductAvailabilityChanged extends DomainEvent<ProductAvailabilityChangedPayload> {
  readonly eventName = 'catalog.product.availability-changed';
  readonly aggregateType = PRODUCT_AGGREGATE_TYPE;

  constructor(
    productId: ProductId,
    occurredAt: Date,
    payload: ProductAvailabilityChangedPayload,
  ) {
    super(productId.value, occurredAt, payload);
  }
}
