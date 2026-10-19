import { http, HttpResponse, type HttpHandler } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';
import type { VehicleTypeValue } from '../../domain';

export type FakeReadyOrder = {
  id: string;
  customerName: string;
  deliveryAddress: string;
  totalAmount: number;
};

export type FakeCourier = {
  id: string;
  name: string;
  vehicleType: VehicleTypeValue;
  location: { latitude: number; longitude: number } | null;
};

/**
 * Imitação das rotas que a tela de atribuição usa. A sugestão pareia os
 * pedidos e entregadores na ordem (o algoritmo real é testado no backend);
 * o despacho tira o pedido da lista e ocupa o entregador, como a API.
 */
export class FakeAssignmentApi {
  orders: FakeReadyOrder[] = [];
  couriers: FakeCourier[] = [];
  /** Pedidos que outro gestor despachou depois da sugestão: aceitar dá 422. */
  readonly staleOrders = new Set<string>();
  readonly dispatched: { orderId: string; deliveryPersonId: string }[] = [];
  suggestions = 0;
  /** Leituras do quadro (pedidos prontos). */
  boardQueries = 0;

  handlers(): HttpHandler[] {
    return [
      http.get(apiUrl('/orders'), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'ready') this.boardQueries += 1;
        const data = status === 'ready' ? this.orders : [];
        return HttpResponse.json({
          data: data.map((order) => ({
            ...order,
            status: 'ready',
            deliveryPerson: null,
            items: [{ id: `${order.id}-item`, product: { id: 'p', name: 'Produto' }, quantity: 2, unitPrice: 1 }],
            createdAt: '2026-10-17T15:00:00.000Z',
            updatedAt: '2026-10-17T15:00:00.000Z',
          })),
          pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 },
        });
      }),

      http.get(apiUrl('/delivery-persons'), () =>
        HttpResponse.json({
          data: this.couriers.map((courier) => ({
            id: courier.id,
            name: courier.name,
            phone: '(11) 98888-0000',
            vehicleType: courier.vehicleType,
            isActive: true,
            currentLatitude: courier.location?.latitude ?? null,
            currentLongitude: courier.location?.longitude ?? null,
            currentOrderId: null,
          })),
        }),
      ),

      http.post(apiUrl('/orders/optimize-assignment'), () => {
        this.suggestions += 1;
        const located = this.couriers.filter((courier) => courier.location !== null);
        const paired = this.orders.slice(0, located.length);
        const assignments = paired.map((order, index) => ({
          orderId: order.id,
          deliveryPersonId: located[index]?.id ?? '',
          estimatedDistanceKm: 1.5 + index,
          orderAddress: order.deliveryAddress,
          deliveryPersonName: located[index]?.name ?? '',
        }));
        return HttpResponse.json({
          assignments,
          unassigned: this.orders.slice(located.length).map((order) => ({
            orderId: order.id,
            orderAddress: order.deliveryAddress,
            reason: 'No available delivery person',
          })),
          unlocatedDeliveryPersons: this.couriers
            .filter((courier) => courier.location === null)
            .map((courier) => ({ id: courier.id, name: courier.name })),
          totalDistanceKm: assignments.reduce((total, assignment) => total + assignment.estimatedDistanceKm, 0),
          algorithm: 'hungarian',
          executionTimeMs: 0.37,
        });
      }),

      http.post(apiUrl('/orders/:id/dispatch'), async ({ params, request }) => {
        const orderId = String(params.id);
        const { deliveryPersonId } = (await request.json()) as { deliveryPersonId: string };
        if (this.staleOrders.has(orderId)) {
          return HttpResponse.json(
            { error: { code: 'INVALID_STATUS_TRANSITION', message: 'O pedido já saiu para entrega' } },
            { status: 422 },
          );
        }
        this.dispatched.push({ orderId, deliveryPersonId });
        this.orders = this.orders.filter((order) => order.id !== orderId);
        this.couriers = this.couriers.filter((courier) => courier.id !== deliveryPersonId);
        return HttpResponse.json({ id: orderId, status: 'delivering' });
      }),
    ];
  }
}
