import type { Insertable, Selectable } from 'kysely';

import { Money } from '../../../../shared-kernel/domain';
import { centsToDecimal, decimalToCents } from '../../../../shared-kernel/infra/database/numeric';
import {
  ImageUrl,
  PreparationTime,
  Product,
  ProductCategory,
  ProductDescription,
  ProductId,
  ProductName,
  ProductPrice,
} from '../../../domain';
import type { ProductsTable } from '../schema/catalog-database';

/** Linha → agregado. Passa pelos Value Objects: dado inválido no banco falha alto. */
export function toProduct(row: Selectable<ProductsTable>): Product {
  return Product.reconstitute(ProductId.from(row.id), {
    name: ProductName.create(row.name),
    description: ProductDescription.create(row.description),
    price: ProductPrice.fromMoney(Money.fromCents(decimalToCents(row.price))),
    category: ProductCategory.create(row.category),
    imageUrl: row.image_url === null ? null : ImageUrl.create(row.image_url),
    isAvailable: row.is_available,
    preparationTime: PreparationTime.ofMinutes(row.preparation_time),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removedAt: row.deleted_at,
  });
}

/** Agregado → linha. */
export function toProductRow(product: Product): Insertable<ProductsTable> {
  return {
    id: product.id.value,
    name: product.name.value,
    description: product.description.value,
    price: centsToDecimal(product.price.amount.cents),
    category: product.category.value,
    image_url: product.imageUrl?.value ?? null,
    is_available: product.isAvailable,
    preparation_time: product.preparationTime.minutes,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    deleted_at: product.removedAt,
  };
}
