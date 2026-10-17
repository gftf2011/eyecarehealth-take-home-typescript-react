import type {
  DeliveryTimeReport,
  OrdersByStatusReport,
  ReportedOrderStatus,
  ReportedVehicleType,
  RevenueReport,
  TopProductsReport,
} from '../../domain';

/** Valores monetários em reais; datas como `YYYY-MM-DD` (dias locais do negócio). */
export type RevenueReportDto = {
  readonly startDate: string;
  readonly endDate: string;
  readonly totalRevenue: number;
  readonly totalOrders: number;
  readonly averageOrderValue: number;
  readonly dailyRevenue: readonly { readonly date: string; readonly revenue: number; readonly orders: number }[];
};

export type OrdersByStatusReportDto = {
  readonly data: readonly { readonly status: ReportedOrderStatus; readonly count: number }[];
  readonly total: number;
};

export type TopProductsReportDto = {
  readonly data: readonly {
    readonly productId: string;
    readonly productName: string;
    readonly totalQuantity: number;
    readonly totalRevenue: number;
  }[];
};

/** Sem entregas no período, média/mínimo/máximo são `null` (não há o que medir). */
export type DeliveryTimeReportDto = {
  readonly averageMinutes: number | null;
  readonly fastestMinutes: number | null;
  readonly slowestMinutes: number | null;
  readonly totalDelivered: number;
  readonly byVehicleType: readonly {
    readonly vehicleType: ReportedVehicleType;
    readonly averageMinutes: number;
    readonly fastestMinutes: number;
    readonly slowestMinutes: number;
    readonly count: number;
  }[];
};

export function toRevenueReportDto(report: RevenueReport): RevenueReportDto {
  return {
    startDate: report.period.start.toString(),
    endDate: report.period.end.toString(),
    totalRevenue: report.totalRevenue.toDecimal(),
    totalOrders: report.totalOrders,
    averageOrderValue: report.averageOrderValue.toDecimal(),
    dailyRevenue: report.dailyRevenue.map((day) => ({
      date: day.date.toString(),
      revenue: day.revenue.toDecimal(),
      orders: day.orders,
    })),
  };
}

export function toOrdersByStatusReportDto(report: OrdersByStatusReport): OrdersByStatusReportDto {
  return { data: report.data.map(({ status, count }) => ({ status, count })), total: report.total };
}

export function toTopProductsReportDto(report: TopProductsReport): TopProductsReportDto {
  return {
    data: report.data.map((product) => ({
      productId: product.productId,
      productName: product.productName,
      totalQuantity: product.totalQuantity,
      totalRevenue: product.totalRevenue.toDecimal(),
    })),
  };
}

export function toDeliveryTimeReportDto(report: DeliveryTimeReport): DeliveryTimeReportDto {
  return {
    averageMinutes: report.averageMinutes,
    fastestMinutes: report.fastestMinutes,
    slowestMinutes: report.slowestMinutes,
    totalDelivered: report.totalDelivered,
    byVehicleType: report.byVehicleType.map((group) => ({
      vehicleType: group.vehicleType,
      averageMinutes: group.averageMinutes,
      fastestMinutes: group.fastestMinutes,
      slowestMinutes: group.slowestMinutes,
      count: group.count,
    })),
  };
}
