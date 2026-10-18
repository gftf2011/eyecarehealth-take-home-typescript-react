import { z } from 'zod';

import { LocalDate, Money } from '../../../shared-kernel/domain';
import {
  REPORTED_ORDER_STATUSES,
  REPORTED_VEHICLE_TYPES,
  type DeliveryTimeReport,
  type OrdersByStatusReport,
  type RevenueReport,
  type TopProductsReport,
} from '../../domain';

const cents = (reais: number): number => Money.fromDecimal(reais).cents;

export const revenueSchema = z.object({
  totalRevenue: z.number().nonnegative(),
  totalOrders: z.number().int().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
  dailyRevenue: z.array(
    z.object({ date: z.string(), revenue: z.number().nonnegative(), orders: z.number().int().nonnegative() }),
  ),
});

export const ordersByStatusSchema = z.object({
  data: z.array(z.object({ status: z.enum(REPORTED_ORDER_STATUSES), count: z.number().int().nonnegative() })),
  total: z.number().int().nonnegative(),
});

export const topProductsSchema = z.object({
  data: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      totalQuantity: z.number().int().nonnegative(),
      totalRevenue: z.number().nonnegative(),
    }),
  ),
});

const minutes = z.number().nonnegative();

export const deliveryTimeSchema = z.object({
  averageMinutes: minutes.nullable(),
  fastestMinutes: minutes.nullable(),
  slowestMinutes: minutes.nullable(),
  totalDelivered: z.number().int().nonnegative(),
  byVehicleType: z.array(
    z.object({
      vehicleType: z.enum(REPORTED_VEHICLE_TYPES),
      averageMinutes: minutes,
      fastestMinutes: minutes,
      slowestMinutes: minutes,
      count: z.number().int().nonnegative(),
    }),
  ),
});

export function toRevenueReport(body: z.output<typeof revenueSchema>): RevenueReport {
  return {
    totalCents: cents(body.totalRevenue),
    totalOrders: body.totalOrders,
    averageOrderCents: cents(body.averageOrderValue),
    daily: body.dailyRevenue.map((day) => ({
      date: LocalDate.parse(day.date),
      revenueCents: cents(day.revenue),
      orders: day.orders,
    })),
  };
}

export function toOrdersByStatusReport(body: z.output<typeof ordersByStatusSchema>): OrdersByStatusReport {
  return { data: body.data, total: body.total };
}

export function toTopProductsReport(body: z.output<typeof topProductsSchema>): TopProductsReport {
  return {
    products: body.data.map((product) => ({
      productId: product.productId,
      productName: product.productName,
      totalQuantity: product.totalQuantity,
      totalRevenueCents: cents(product.totalRevenue),
    })),
  };
}

export function toDeliveryTimeReport(body: z.output<typeof deliveryTimeSchema>): DeliveryTimeReport {
  return body;
}
