import {
  PreparationTime,
  Product,
  ProductCategory,
  ProductDescription,
  ProductName,
  ProductPrice,
  type ProductCategoryValue,
} from '../..';

export const CREATED_AT = '2026-10-17T12:00:00.000Z';

/** Corpo de um produto como a API devolve. */
export type ProductBodyFixture = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategoryValue;
  imageUrl: string | null;
  isAvailable: boolean;
  preparationTime: number;
  createdAt: string;
  updatedAt: string;
};

export function productBody(overrides: Partial<ProductBodyFixture> = {}): ProductBodyFixture {
  return {
    id: 'product-1',
    name: 'X-Burger Especial',
    description: 'Pão brioche, blend 180g, queijo cheddar e molho da casa',
    price: 32.9,
    category: 'meal',
    imageUrl: null,
    isAvailable: true,
    preparationTime: 15,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function buildProduct(overrides: Partial<ProductBodyFixture> = {}): Product {
  const body = productBody(overrides);
  return Product.restore({
    id: body.id,
    name: ProductName.create(body.name),
    description: ProductDescription.create(body.description),
    price: ProductPrice.fromDecimal(body.price),
    category: ProductCategory.create(body.category),
    imageUrl: null,
    isAvailable: body.isAvailable,
    preparationTime: PreparationTime.ofMinutes(body.preparationTime),
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
}
