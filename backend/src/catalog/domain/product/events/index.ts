import type { ProductAvailabilityChanged } from './product-availability-changed.event.js';
import type { ProductCreated } from './product-created.event.js';
import type { ProductPriceChanged } from './product-price-changed.event.js';
import type { ProductRemoved } from './product-removed.event.js';
import type { ProductUpdated } from './product-updated.event.js';

export { PRODUCT_AGGREGATE_TYPE } from './product-aggregate-type.js';
export {
  ProductAvailabilityChanged,
  type ProductAvailabilityChangedPayload,
} from './product-availability-changed.event.js';
export { ProductCreated, type ProductCreatedPayload } from './product-created.event.js';
export {
  ProductPriceChanged,
  type ProductPriceChangedPayload,
} from './product-price-changed.event.js';
export { ProductRemoved } from './product-removed.event.js';
export {
  ProductUpdated,
  type ProductDetailField,
  type ProductUpdatedPayload,
} from './product-updated.event.js';

export type ProductDomainEvent =
  | ProductCreated
  | ProductUpdated
  | ProductPriceChanged
  | ProductAvailabilityChanged
  | ProductRemoved;
