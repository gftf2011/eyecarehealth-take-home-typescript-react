import { z } from 'zod';

import { Money } from '../../../shared-kernel/domain';
import { VEHICLE_TYPES, type AvailableCourier, type ReadyOrder } from '../../domain';

/**
 * Só os campos de pedido que o Delivery usa (ACL): se o Ordering acrescentar
 * campos, nada aqui muda.
 */
export const readyOrdersSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      customerName: z.string(),
      deliveryAddress: z.string(),
      totalAmount: z.number(),
      deliveryPerson: z.object({ name: z.string() }).nullable(),
      items: z.array(z.object({ quantity: z.number().int().positive() })),
      createdAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    }),
  ),
  pagination: z.object({ total: z.number().int().nonnegative() }),
});

export const availableCouriersSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      vehicleType: z.enum(VEHICLE_TYPES),
      currentLatitude: z.number().nullable(),
      currentLongitude: z.number().nullable(),
    }),
  ),
});

export function toReadyOrders(body: z.output<typeof readyOrdersSchema>): ReadyOrder[] {
  return body.data.map((order) => ({
    id: order.id,
    customerName: order.customerName,
    deliveryAddress: order.deliveryAddress,
    totalCents: Money.fromDecimal(order.totalAmount, 'totalAmount').cents,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    assignedDeliveryPersonName: order.deliveryPerson?.name ?? null,
    createdAt: order.createdAt,
  }));
}

export function toAvailableCouriers(body: z.output<typeof availableCouriersSchema>): AvailableCourier[] {
  return body.data.map((courier) => ({
    id: courier.id,
    name: courier.name,
    vehicleType: courier.vehicleType,
    hasLocation: courier.currentLatitude !== null && courier.currentLongitude !== null,
  }));
}
