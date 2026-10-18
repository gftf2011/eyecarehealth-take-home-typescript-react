import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';

type Failure = { status: number; code: string; message: string };

/** Imitação de `/api/reports/*`: respostas configuráveis e registro das consultas. */
export class FakeReportsApi {
  revenue: JsonBodyType = {
    startDate: '2026-10-01',
    endDate: '2026-10-17',
    totalRevenue: 1234.5,
    totalOrders: 30,
    averageOrderValue: 41.15,
    dailyRevenue: [
      { date: '2026-10-16', revenue: 600, orders: 14 },
      { date: '2026-10-17', revenue: 634.5, orders: 16 },
    ],
  };

  ordersByStatus: JsonBodyType = {
    data: [
      { status: 'pending', count: 2 },
      { status: 'preparing', count: 1 },
      { status: 'ready', count: 3 },
      { status: 'delivering', count: 1 },
      { status: 'delivered', count: 30 },
      { status: 'cancelled', count: 3 },
    ],
    total: 40,
  };

  topProducts: JsonBodyType = {
    data: [
      { productId: 'p-burger', productName: 'X-Burger Especial', totalQuantity: 42, totalRevenue: 1381.8 },
      { productId: 'p-juice', productName: 'Suco de Laranja', totalQuantity: 18, totalRevenue: 225 },
    ],
  };

  deliveryTime: JsonBodyType = {
    averageMinutes: 38.5,
    fastestMinutes: 18,
    slowestMinutes: 95,
    totalDelivered: 30,
    byVehicleType: [
      { vehicleType: 'motorcycle', averageMinutes: 31, fastestMinutes: 18, slowestMinutes: 60, count: 20 },
      { vehicleType: 'bicycle', averageMinutes: 53.5, fastestMinutes: 30, slowestMinutes: 95, count: 10 },
    ],
  };

  /** Faz um relatório específico falhar (ex.: `top-products`). */
  readonly failures = new Map<string, Failure>();
  readonly queries: { report: string; params: URLSearchParams }[] = [];

  handlers(): HttpHandler[] {
    const route = (report: string, body: () => JsonBodyType) =>
      http.get(apiUrl(`/reports/${report}`), ({ request }) => {
        this.queries.push({ report, params: new URL(request.url).searchParams });
        const failure = this.failures.get(report);
        if (failure !== undefined) {
          return HttpResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status });
        }
        return HttpResponse.json(body());
      });

    return [
      route('revenue', () => this.revenue),
      route('orders-by-status', () => this.ordersByStatus),
      route('top-products', () => this.topProducts),
      route('average-delivery-time', () => this.deliveryTime),
    ];
  }
}
