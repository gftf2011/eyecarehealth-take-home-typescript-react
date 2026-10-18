export { toProductDto, type ProductDto } from './dtos/product.dto';
export { InvalidProductFilterError } from './errors/invalid-product-filter.error';
export {
  listProductsInputErrors,
  parseListProductsInput,
  type ListProductsInput,
} from './inputs/list-products.input';
export {
  EMPTY_PRODUCT_FORM,
  parseProductFormInput,
  productFormErrors,
  productFormInputFrom,
  type ProductFormField,
  type ProductFormInput,
} from './inputs/product-form.input';
export type { ProductGateway, RequestOptions } from './ports/product-gateway';
export { CreateProductUseCase } from './usecases/create-product/create-product.usecase';
export { ListProductsUseCase } from './usecases/list-products/list-products.usecase';
export {
  RemoveProductUseCase,
  type RemoveProductInput,
} from './usecases/remove-product/remove-product.usecase';
export {
  SetProductAvailabilityUseCase,
  type SetProductAvailabilityInput,
} from './usecases/set-product-availability/set-product-availability.usecase';
export {
  UpdateProductUseCase,
  type UpdateProductInput,
} from './usecases/update-product/update-product.usecase';
