import { z } from 'zod';

import { paginationSchema } from '../../../shared-kernel/infra';
import {
  ImageUrl,
  PreparationTime,
  Product,
  ProductCategory,
  ProductDescription,
  ProductName,
  ProductPrice,
  type ProductDetails,
} from '../../domain';

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** Corpo de um produto na API (preço em reais). */
export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  preparationTime: z.number(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type ProductBody = z.output<typeof productSchema>;

export const productPageSchema = z.object({
  data: z.array(productSchema),
  pagination: paginationSchema,
});

/** Corpo da API → agregado, passando pelos mesmos Value Objects (dados fora das regras viram erro). */
export function toProduct(body: ProductBody): Product {
  return Product.restore({
    id: body.id,
    name: ProductName.create(body.name),
    description: ProductDescription.create(body.description),
    price: ProductPrice.fromDecimal(body.price),
    category: ProductCategory.create(body.category),
    imageUrl: body.imageUrl === null ? null : ImageUrl.create(body.imageUrl),
    isAvailable: body.isAvailable,
    preparationTime: PreparationTime.ofMinutes(body.preparationTime),
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  });
}

/** Detalhes validados → corpo de `POST`/`PUT` (só os campos presentes). */
export function toProductRequestBody(details: Partial<ProductDetails>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (details.name !== undefined) body.name = details.name.value;
  if (details.description !== undefined) body.description = details.description.value;
  if (details.price !== undefined) body.price = details.price.toDecimal();
  if (details.category !== undefined) body.category = details.category.value;
  if (details.imageUrl !== undefined) body.imageUrl = details.imageUrl?.value ?? null;
  if (details.preparationTime !== undefined) body.preparationTime = details.preparationTime.minutes;
  if (details.isAvailable !== undefined) body.isAvailable = details.isAvailable;
  return body;
}
