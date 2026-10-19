import { z } from 'zod';

import { SORT_DIRECTIONS } from '../../../shared-kernel/domain';
import { isoDateTime, optionalIntegerQuery, PAGE_DOC, pageOf, uuid } from '../../../shared-kernel/presentation';
import { ORDER_SORT_FIELDS, ORDER_STATUSES } from '../../domain';

/*
 * Schemas HTTP do Ordering: validam a forma nos controllers e geram a
 * documentação. As regras (telefone, tamanhos, coordenadas, transições) são
 * do domínio; aqui só aparecem como documentação (`meta`).
 */

const LOCAL_DATE = { description: 'Dia local de São Paulo (`YYYY-MM-DD`), inclusive', format: 'date', examples: ['2026-10-17'] };

export const placeOrderBodySchema = z.object({
  customerName: z.string().meta({ minLength: 3, maxLength: 100, examples: ['Maria Oliveira'] }),
  customerPhone: z.string().meta({ description: 'Formato `(DD) 9XXXX-XXXX` ou `(DD) XXXX-XXXX`', examples: ['(21) 98765-4321'] }),
  deliveryAddress: z.string().meta({ minLength: 10, maxLength: 300, examples: ['Av. Brasil, 456, Rio de Janeiro - RJ'] }),
  latitude: z.number().meta({ minimum: -90, maximum: 90, examples: [-22.9068] }),
  longitude: z.number().meta({ minimum: -180, maximum: 180, examples: [-43.1729] }),
  items: z
    .array(
      z.object({
        productId: z.string().meta({ format: 'uuid', description: 'Produto disponível do cardápio' }),
        quantity: z.number().meta({ description: 'Inteiro positivo', minimum: 1, examples: [2] }),
      }),
    )
    .meta({ description: 'Ao menos um item; o preço vem do cardápio no momento do pedido (o total nunca vem do cliente)', minItems: 1 }),
});

export const listOrdersQuerySchema = z.object({
  page: optionalIntegerQuery.meta({ description: PAGE_DOC, minimum: 1 }),
  limit: optionalIntegerQuery.meta({ minimum: 1, maximum: 100 }),
  status: z.string().optional().meta({ enum: [...ORDER_STATUSES] }),
  startDate: z.string().optional().meta({ ...LOCAL_DATE, description: `Criados a partir deste dia. ${LOCAL_DATE.description}` }),
  endDate: z.string().optional().meta({ ...LOCAL_DATE, description: `Criados até este dia. ${LOCAL_DATE.description}` }),
  sortBy: z.string().optional().meta({ enum: [...ORDER_SORT_FIELDS], description: 'Padrão `createdAt`' }),
  sortOrder: z.string().optional().meta({ enum: [...SORT_DIRECTIONS], description: 'Padrão `desc`' }),
});

export const changeOrderStatusBodySchema = z.object({
  status: z.string().meta({
    enum: [...ORDER_STATUSES],
    description:
      'Transições válidas: `pending → preparing | cancelled`, `preparing → ready | cancelled`, `ready → delivering | cancelled` (exige entregador atribuído e disponível), `delivering → delivered`.',
  }),
});

export const deliveryPersonIdBodySchema = z.object({
  deliveryPersonId: z.string().meta({ format: 'uuid', description: 'Entregador ativo e sem entrega em andamento' }),
});

export const orderSchema = z.strictObject({
  id: uuid,
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.enum(ORDER_STATUSES),
  totalAmount: z.number().meta({ description: 'Soma de `unitPrice × quantity`, em reais' }),
  deliveryPerson: z.strictObject({ id: uuid, name: z.string() }).nullable(),
  items: z.array(
    z.strictObject({
      id: uuid,
      product: z.strictObject({ id: uuid, name: z.string() }),
      quantity: z.number().int(),
      unitPrice: z.number().meta({ description: 'Preço no momento do pedido, em reais' }),
    }),
  ),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const orderPageSchema = pageOf(orderSchema);
