import { z } from 'zod';

import { SORT_DIRECTIONS } from '../../../shared-kernel/domain';
import {
  isoDateTime,
  optionalBooleanQuery,
  optionalIntegerQuery,
  CURSOR_DOC,
  LIMIT_DOC,
  pageOf,
  uuid,
} from '../../../shared-kernel/presentation';
import { PRODUCT_CATEGORIES, PRODUCT_SORT_FIELDS } from '../../domain';

/*
 * Schemas HTTP do Catalog: validam a forma da requisição nos controllers e
 * geram a documentação OpenAPI. As regras de negócio (tamanhos, preço > 0)
 * são dos Value Objects; aqui só aparecem como documentação (`meta`), sem
 * validar de novo.
 */

const productFields = {
  name: z.string().meta({ description: 'Nome do produto', minLength: 3, maxLength: 120, examples: ['X-Burger Especial'] }),
  description: z.string().meta({
    minLength: 10,
    maxLength: 500,
    examples: ['Hambúrguer artesanal com queijo cheddar e bacon'],
  }),
  price: z.number().meta({ description: 'Em reais, maior que zero e com até 2 casas decimais', exclusiveMinimum: 0, examples: [32.9] }),
  category: z.string().meta({ enum: [...PRODUCT_CATEGORIES], examples: ['meal'] }),
  imageUrl: z
    .string()
    .nullable()
    .optional()
    .meta({ description: 'URL http(s) da imagem (até 500 caracteres) ou `null`', examples: ['https://example.com/burger.jpg'] }),
  isAvailable: z.boolean().optional().meta({ description: 'Padrão `true` na criação' }),
  preparationTime: z.number().meta({ description: 'Tempo de preparo em minutos (inteiro de 1 a 120)', minimum: 1, maximum: 120, examples: [25] }),
};

export const createProductBodySchema = z.object(productFields);

/** Atualização parcial: só os campos enviados mudam. */
export const updateProductBodySchema = z.object(productFields).partial();

export const listProductsQuerySchema = z.object({
  cursor: z.string().optional().meta({ description: CURSOR_DOC }),
  limit: optionalIntegerQuery.meta({ description: LIMIT_DOC, minimum: 1, maximum: 100 }),
  search: z.string().optional().meta({ description: 'Busca parcial no nome, sem diferenciar maiúsculas' }),
  category: z.string().optional().meta({ enum: [...PRODUCT_CATEGORIES] }),
  isAvailable: optionalBooleanQuery,
  sortBy: z.string().optional().meta({ enum: [...PRODUCT_SORT_FIELDS], description: 'Padrão `createdAt`' }),
  sortOrder: z.string().optional().meta({ enum: [...SORT_DIRECTIONS], description: 'Padrão `desc`' }),
});

export const productSchema = z
  .strictObject({
    id: uuid,
    name: z.string(),
    description: z.string(),
    price: z.number().meta({ description: 'Em reais' }),
    category: z.enum(PRODUCT_CATEGORIES),
    imageUrl: z.string().nullable(),
    isAvailable: z.boolean(),
    preparationTime: z.number().int().meta({ description: 'Minutos' }),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  });

export const productPageSchema = pageOf(productSchema);
