import type { ProductAvailabilityChanged } from './product-availability-changed.event';
import type { ProductCreated } from './product-created.event';
import type { ProductPriceChanged } from './product-price-changed.event';
import type { ProductRemoved } from './product-removed.event';
import type { ProductUpdated } from './product-updated.event';

export { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type';
export {
  ProductAvailabilityChanged,
  type ProductAvailabilityChangedPayload,
} from './product-availability-changed.event';
export { ProductCreated, type ProductCreatedPayload } from './product-created.event';
export {
  ProductPriceChanged,
  type ProductPriceChangedPayload,
} from './product-price-changed.event';
export { ProductRemoved } from './product-removed.event';
export {
  ProductUpdated,
  type ProductDetailField,
  type ProductUpdatedPayload,
} from './product-updated.event';

export type ProductDomainEvent =
  | ProductCreated
  | ProductUpdated
  | ProductPriceChanged
  | ProductAvailabilityChanged
  | ProductRemoved;
