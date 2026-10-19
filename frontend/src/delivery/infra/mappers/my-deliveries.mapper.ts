import { z } from 'zod';

import { Money } from '../../../shared-kernel/domain';
import { COURIER_DELIVERY_STATUSES, COURIER_ISSUE_REASONS, type CourierDelivery, type MyDeliveries } from '../../domain';

/** Só os campos de pedido que a tela do entregador usa (ACL sobre o Ordering). */
const courierOrderSchema = z.object({
  id: z.string(),
  status: z.enum(COURIER_DELIVERY_STATUSES),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  totalAmount: z.number(),
  items: z.array(z.object({ product: z.object({ name: z.string() }), quantity: z.number().int().positive() })),
  deliveryIssues: z.array(
    z.object({
      reason: z.enum(COURIER_ISSUE_REASONS),
      note: z.string().nullable(),
      reportedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
      resolvedAt: z.string().nullable(),
    }),
  ),
  createdAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});

export const myDeliveriesSchema = z.object({
  deliveryPerson: z.object({ id: z.string(), name: z.string() }),
  inProgress: courierOrderSchema.nullable(),
  upcoming: z.array(courierOrderSchema),
});

function toCourierDelivery(order: z.output<typeof courierOrderSchema>): CourierDelivery {
  return {
    orderId: order.id,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    latitude: order.latitude,
    longitude: order.longitude,
    items: order.items.map((item) => ({ productName: item.product.name, quantity: item.quantity })),
    totalCents: Money.fromDecimal(order.totalAmount, 'totalAmount').cents,
    openIssue: openIssueOf(order.deliveryIssues),
    createdAt: order.createdAt,
  };
}

function openIssueOf(issues: z.output<typeof courierOrderSchema>['deliveryIssues']): CourierDelivery['openIssue'] {
  const open = issues.find((issue) => issue.resolvedAt === null);
  return open === undefined ? null : { reason: open.reason, note: open.note, reportedAt: open.reportedAt };
}

export function toMyDeliveries(body: z.output<typeof myDeliveriesSchema>): MyDeliveries {
  return {
    courier: body.deliveryPerson,
    inProgress: body.inProgress === null ? null : toCourierDelivery(body.inProgress),
    upcoming: body.upcoming.map(toCourierDelivery),
  };
}
