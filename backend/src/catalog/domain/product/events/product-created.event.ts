import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { ProductId } from '../product-id';
import type { ProductCategoryValue } from '../value-objects/product-category';
import { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type';

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
