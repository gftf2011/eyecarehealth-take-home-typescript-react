import type { LocalDate } from '../../../shared-kernel/domain';

/**
 * Modelos de leitura dos relatórios, como o Reporting os enxerga. São só
 * leitura: os números são calculados pelo backend (SQL agregado); aqui eles
 * chegam em centavos e minutos, prontos para exibir.
 */

export type DailyRevenue = {
  readonly date: LocalDate;
  readonly revenueCents: number;
  readonly orders: number;
};

/** Receita dos pedidos entregues no período, pela data da entrega. */
export type RevenueReport = {
  readonly totalCents: number;
  readonly totalOrders: number;
  readonly averageOrderCents: number;
  /** Um ponto por dia do período, inclusive dias sem venda. */
  readonly daily: readonly DailyRevenue[];
};

export const REPORTED_ORDER_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
] as const;

export type ReportedOrderStatus = (typeof REPORTED_ORDER_STATUSES)[number];

/** Pedidos criados no período, por status atual (os seis status sempre presentes). */
export type OrdersByStatusReport = {
  readonly data: readonly { readonly status: ReportedOrderStatus; readonly count: number }[];
  readonly total: number;
};

export type TopProduct = {
  readonly productId: string;
  readonly productName: string;
  readonly totalQuantity: number;
  readonly totalRevenueCents: number;
};

/** Produtos mais vendidos (só pedidos entregues), em ordem. */
export type TopProductsReport = {
  readonly products: readonly TopProduct[];
};

export const REPORTED_VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car'] as const;

export type ReportedVehicleType = (typeof REPORTED_VEHICLE_TYPES)[number];

export type VehicleDeliveryTime = {
  readonly vehicleType: ReportedVehicleType;
  readonly averageMinutes: number;
  readonly fastestMinutes: number;
  readonly slowestMinutes: number;
  readonly count: number;
};

/** Tempo entre a criação e a entrega. Sem entregas, as métricas são `null`. */
export type DeliveryTimeReport = {
  readonly averageMinutes: number | null;
  readonly fastestMinutes: number | null;
  readonly slowestMinutes: number | null;
  readonly totalDelivered: number;
  readonly byVehicleType: readonly VehicleDeliveryTime[];
};
