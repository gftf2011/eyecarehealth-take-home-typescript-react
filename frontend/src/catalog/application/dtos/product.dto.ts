import type { Product, ProductCategoryValue } from '../../domain';

/** O que a interface mostra de um produto (valores em centavos). */
export type ProductDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly category: ProductCategoryValue;
  readonly imageUrl: string | null;
  readonly isAvailable: boolean;
  /** Minutos. */
  readonly preparationTime: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name.value,
    description: product.description.value,
    priceCents: product.price.amount.cents,
    category: product.category.value,
    imageUrl: product.imageUrl?.value ?? null,
    isAvailable: product.isAvailable,
    preparationTime: product.preparationTime.minutes,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
