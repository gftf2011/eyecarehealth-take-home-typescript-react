import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { ProductId } from '../product-id.js';
import type { ProductCategoryValue } from '../value-objects/product-category.js';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type.js';

export type ProductCreatedPayload = {
  name: string;
  priceCents: number;
  category: ProductCategoryValue;
  isAvailable: boolean;
};

export class ProductCreated extends DomainEvent<ProductCreatedPayload> {
  readonly eventName = 'catalog.product.created';
  readonly aggregateType = PRODUCT_AGGREGATE_TYPE;

  constructor(productId: ProductId, occurredAt: Date, payload: ProductCreatedPayload) {
    super(productId.value, occurredAt, payload);
  }
}
