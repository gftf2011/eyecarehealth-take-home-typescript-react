import { http, HttpResponse, type HttpHandler } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';

/** Pedido como `/api/me/deliveries` devolve (o mesmo corpo de `/api/orders`). */
export type CourierOrderBody = {
  id: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivering' | 'delivered';
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  totalAmount: number;
  deliveryPerson: { id: string; name: string } | null;
  items: { id: string; product: { id: string; name: string }; quantity: number; unitPrice: number }[];
  createdAt: string;
};

export function courierOrder(overrides: Partial<CourierOrderBody> = {}): CourierOrderBody {
  return {
    id: 'order-1',
    status: 'delivering',
    customerName: 'João Silva',
    customerPhone: '(11) 99999-1234',
    deliveryAddress: 'Rua das Flores, 123, São Paulo - SP',
    latitude: -23.5891,
    longitude: -46.6378,
    totalAmount: 78.3,
    deliveryPerson: { id: 'courier-1', name: 'Carlos Santos' },
    items: [{ id: 'item-1', product: { id: 'p-burger', name: 'X-Burger Especial' }, quantity: 2, unitPrice: 32.9 }],
    createdAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  };
}

/**
 * Imitação das rotas `/api/me/...` do entregador: só os pedidos dele, a
 * confirmação (`422` fora de `delivering`) e a localização.
 */
export class FakeMyDeliveriesApi {
  courier = { id: 'courier-1', name: 'Carlos Santos' };
  orders: CourierOrderBody[] = [];
  readonly confirmations: string[] = [];
  readonly locations: { latitude: number; longitude: number }[] = [];
  loads = 0;

  given(...orders: CourierOrderBody[]): void {
    this.orders = orders.map((order) => structuredClone(order));
  }

  handlers(): HttpHandler[] {
    return [
      http.get(apiUrl('/me/deliveries'), () => {
        this.loads += 1;
        const open = this.orders.filter((order) => order.status !== 'delivered');
        return HttpResponse.json({
          deliveryPerson: this.courier,
          inProgress: open.find((order) => order.status === 'delivering') ?? null,
          upcoming: open.filter((order) => order.status !== 'delivering'),
        });
      }),

      http.post(apiUrl('/me/deliveries/:id/delivered'), ({ params }) => {
        const order = this.orders.find((candidate) => candidate.id === params.id);
        this.confirmations.push(String(params.id));
        if (order === undefined) {
          return HttpResponse.json({ error: { code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado' } }, { status: 404 });
        }
        if (order.status !== 'delivering') {
          return HttpResponse.json(
            { error: { code: 'INVALID_STATUS_TRANSITION', message: `Não é possível alterar o status de '${order.status}' para 'delivered'`, details: [{ from: order.status, to: 'delivered' }] } },
            { status: 422 },
          );
        }
        order.status = 'delivered';
        return HttpResponse.json(order);
      }),

      http.put(apiUrl('/me/location'), async ({ request }) => {
        const body = (await request.json()) as { latitude: number; longitude: number };
        this.locations.push(body);
        return HttpResponse.json({ id: this.courier.id, currentLatitude: body.latitude, currentLongitude: body.longitude });
      }),
    ];
  }
}
