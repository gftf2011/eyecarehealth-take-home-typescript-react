import { z } from 'zod';

import { Money } from '../../../shared-kernel/domain';
import { paginationSchema } from '../../../shared-kernel/infra';
import {
  DELIVERY_ISSUE_DECISIONS,
  DELIVERY_ISSUE_REASONS,
  DELIVERY_ISSUE_RESOLUTIONS,
  Order,
  OrderStatus,
  type OrderProps,
} from '../../domain';

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** Corpo de um pedido na API (`GET /orders/:id`, itens de `GET /orders`, `PATCH .../status`). */
export const orderSchema = z.object({
  id: z.string().min(1),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  status: z.string(),
  totalAmount: z.number(),
  deliveryPerson: z.object({ id: z.string(), name: z.string() }).nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      product: z.object({ id: z.string(), name: z.string() }),
      quantity: z.number().int().positive(),
      unitPrice: z.number(),
    }),
  ),
  statusHistory: z.array(
    z.object({
      from: z.string().nullable(),
      to: z.string(),
      changedAt: isoDate,
      reason: z.string().nullable(),
    }),
  ),
  deliveryIssues: z.array(
    z.object({
      id: z.string(),
      reason: z.enum(DELIVERY_ISSUE_REASONS),
      note: z.string().nullable(),
      reportedAt: isoDate,
      resolvedAt: isoDate.nullable(),
      resolution: z.enum(DELIVERY_ISSUE_RESOLUTIONS).nullable(),
    }),
  ),
  deliveryIssueDecisions: z.array(z.enum(DELIVERY_ISSUE_DECISIONS)),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type OrderBody = z.output<typeof orderSchema>;

export const orderPageSchema = z.object({
  data: z.array(orderSchema),
  pagination: paginationSchema,
});

/** Corpo da API → agregado (valores em reais viram `Money` em centavos). */
export function toOrder(body: OrderBody): Order {
  const props: OrderProps = {
    id: body.id,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    deliveryAddress: body.deliveryAddress,
    status: OrderStatus.create(body.status),
    totalAmount: Money.fromDecimal(body.totalAmount, 'totalAmount'),
    deliveryPerson: body.deliveryPerson,
    items: body.items.map((item) => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: Money.fromDecimal(item.unitPrice, 'unitPrice'),
    })),
    statusHistory: body.statusHistory.map((change) => ({
      from: change.from === null ? null : OrderStatus.create(change.from).value,
      to: OrderStatus.create(change.to).value,
      changedAt: change.changedAt,
      reason: change.reason,
    })),
    deliveryIssues: body.deliveryIssues,
    deliveryIssueDecisions: body.deliveryIssueDecisions,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
  return Order.restore(props);
}
