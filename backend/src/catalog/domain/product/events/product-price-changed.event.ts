import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { ProductId } from '../product-id.js';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type.js';

export type ProductPriceChangedPayload = {
  previousPriceCents: number;
  newPriceCents: number;
};

export class ProductPriceChanged extends DomainEvent<ProductPriceChangedPayload> {
  readonly eventName = 'catalog.product.price-changed';
  readonly aggregateType = PRODUCT_AGGREGATE_TYPE;

  constructor(productId: ProductId, occurredAt: Date, payload: ProductPriceChangedPayload) {
    super(productId.value, occurredAt, payload);
  }
}
