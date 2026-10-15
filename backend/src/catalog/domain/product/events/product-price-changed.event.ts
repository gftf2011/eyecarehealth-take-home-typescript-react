import { DomainEvent } from '../../../../shared-kernel/domain';
import type { ProductId } from '../product-id';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type';

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
