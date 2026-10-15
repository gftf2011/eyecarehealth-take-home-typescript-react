import type { Product, ProductCategoryValue } from '../../domain';

/** Representação de saída de um produto: só tipos primitivos, sem VOs. */
export type ProductDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Em reais, com no máximo 2 casas decimais. */
  readonly price: number;
  readonly category: ProductCategoryValue;
  readonly imageUrl: string | null;
  readonly isAvailable: boolean;
  readonly preparationTime: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id.value,
    name: product.name.value,
    description: product.description.value,
    price: product.price.toDecimal(),
    category: product.category.value,
    imageUrl: product.imageUrl?.value ?? null,
    isAvailable: product.isAvailable,
    preparationTime: product.preparationTime.minutes,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
