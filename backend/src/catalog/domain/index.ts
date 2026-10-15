export {
  Product,
  type CreateProductParams,
  type ProductDetails,
  type ProductDetailsChanges,
  type ProductSnapshot,
  type RemoveProductParams,
} from './product/product.js';
export { ProductId } from './product/product-id.js';
export type { ProductRepository } from './product/repositories/product.repository.js';
export * from './product/errors/index.js';
export * from './product/events/index.js';
export { ImageUrl } from './product/value-objects/image-url.js';
export { PreparationTime } from './product/value-objects/preparation-time.js';
export {
  PRODUCT_CATEGORIES,
  ProductCategory,
  type ProductCategoryValue,
} from './product/value-objects/product-category.js';
export { ProductDescription } from './product/value-objects/product-description.js';
export { ProductName } from './product/value-objects/product-name.js';
export { ProductPrice } from './product/value-objects/product-price.js';
