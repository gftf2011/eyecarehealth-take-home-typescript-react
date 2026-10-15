import {
  ImageUrl,
  PreparationTime,
  Product,
  ProductCategory,
  ProductDescription,
  ProductId,
  ProductName,
  ProductPrice,
  type CreateProductParams,
} from '../../index.js';

export const CREATED_AT = new Date('2025-01-15T10:30:00Z');
export const LATER = new Date('2025-01-16T08:00:00Z');

export function buildCreateProductParams(
  overrides: Partial<CreateProductParams> = {},
): CreateProductParams {
  return {
    id: ProductId.generate(),
    name: ProductName.create('X-Burger Especial'),
    description: ProductDescription.create('Hamburguer artesanal com queijo cheddar e bacon'),
    price: ProductPrice.fromDecimal(32.9),
    category: ProductCategory.create('meal'),
    imageUrl: ImageUrl.create('https://example.com/burger.jpg'),
    preparationTime: PreparationTime.ofMinutes(25),
    now: CREATED_AT,
    ...overrides,
  };
}

/** Produto recém-criado, já sem os eventos de criação. */
export function buildProduct(overrides: Partial<CreateProductParams> = {}): Product {
  const product = Product.create(buildCreateProductParams(overrides));
  product.pullDomainEvents();
  return product;
}
