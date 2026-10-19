import { http, HttpResponse, type HttpHandler } from 'msw';

import { fakeCursorPage } from '../../../shared-kernel/infra/testing/fake-cursor-page';
import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';
import { OrderStatus } from '../../domain';
import type { OrderBodyFixture } from '../../domain/order/testing/order.fixture';

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/**
 * Imitação de `/api/orders` com as regras da API real que a tela usa:
 * filtro por status, paginação, ordenação por data e a máquina de estados
 * (inclusive o entregador obrigatório para despachar).
 */
export class FakeOrdersApi {
  orders: OrderBodyFixture[] = [];
  /** Query string de cada `GET /orders`, para o teste conferir os filtros enviados. */
  readonly listQueries: URLSearchParams[] = [];
  readonly statusChanges: { id: string; status: string }[] = [];
  readonly returns: { id: string; reason: string }[] = [];
  readonly decisions: { id: string; decision: string }[] = [];

  /** Pedidos iniciais (copiados: mudanças de status não vazam entre testes). */
  given(...orders: OrderBodyFixture[]): void {
    this.orders = orders.map((order) => structuredClone(order));
  }

  /** Muda um pedido "por fora" (ex.: outro gestor agiu depois que a tela carregou). */
  update(id: string, patch: Partial<OrderBodyFixture>): void {
    const order = this.orders.find((candidate) => candidate.id === id);
    if (order === undefined) throw new Error(`pedido ${id} não existe no fake`);
    Object.assign(order, patch);
  }

  handlers(): HttpHandler[] {
    return [
      http.get(apiUrl('/orders'), ({ request }) => {
        const query = new URL(request.url).searchParams;
        this.listQueries.push(query);
        const status = query.get('status');
        const descending = (query.get('sortOrder') ?? 'desc') === 'desc';

        const matching = this.orders
          .filter((order) => status === null || order.status === status)
          .sort((a, b) => (descending ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));

        return HttpResponse.json(fakeCursorPage(matching, query));
      }),

      http.get(apiUrl('/orders/:id'), ({ params }) => {
        const order = this.orders.find((candidate) => candidate.id === params.id);
        return order === undefined
          ? apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado')
          : HttpResponse.json(order);
      }),

      http.patch(apiUrl('/orders/:id/status'), async ({ params, request }) => {
        const { status } = (await request.json()) as { status: string };
        const order = this.orders.find((candidate) => candidate.id === params.id);
        if (order === undefined) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado');
        this.statusChanges.push({ id: order.id, status });

        if (!OrderStatus.isValid(status) || !OrderStatus.of(order.status).canTransitionTo(status)) {
          return apiError(422, 'INVALID_STATUS_TRANSITION', `Transição de ${order.status} para ${status} não permitida`);
        }
        if (status === 'delivering' && order.deliveryPerson === null) {
          return apiError(422, 'ASSIGNMENT_NOT_ALLOWED', 'O pedido precisa de um entregador');
        }
        order.status = status;
        order.updatedAt = new Date().toISOString();
        return HttpResponse.json(order);
      }),

      http.post(apiUrl('/orders/:id/delivery-issue/:decision'), ({ params }) => {
        const order = this.orders.find((candidate) => candidate.id === params.id);
        if (order === undefined) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado');
        const decision = String(params.decision);
        this.decisions.push({ id: order.id, decision });
        const open = order.deliveryIssues.find((issue) => issue.resolvedAt === null);
        if (open === undefined) return apiError(422, 'NO_OPEN_DELIVERY_ISSUE', 'Esta entrega não tem problema relatado pelo entregador');
        const now = new Date().toISOString();
        if (!order.deliveryIssueDecisions.includes(decision === 'cancel' ? 'cancel' : 'retry')) {
          return apiError(422, 'DECISION_NOT_ALLOWED', 'Não é possível tentar de novo quando o cliente recusou o pedido');
        }
        Object.assign(open, { resolvedAt: now, resolution: decision === 'cancel' ? 'cancelled' : 'retried' });
        order.deliveryIssueDecisions = [];
        if (decision === 'cancel') {
          order.statusHistory.push({ from: 'delivering', to: 'cancelled', changedAt: now, reason: 'Entrega não realizada' });
          order.status = 'cancelled';
        }
        order.updatedAt = now;
        return HttpResponse.json(order);
      }),

      http.post(apiUrl('/orders/:id/return-to-assignment'), async ({ params, request }) => {
        const { reason } = (await request.json()) as { reason: string };
        const order = this.orders.find((candidate) => candidate.id === params.id);
        if (order === undefined) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado');
        this.returns.push({ id: order.id, reason });
        if (order.status !== 'delivering') {
          return apiError(422, 'INVALID_STATUS_TRANSITION', `Não é possível alterar o status de '${order.status}' para 'ready'`);
        }
        const now = new Date().toISOString();
        order.statusHistory.push({ from: 'delivering', to: 'ready', changedAt: now, reason: reason.trim() });
        Object.assign(order, { status: 'ready', deliveryPerson: null, updatedAt: now });
        return HttpResponse.json(order);
      }),
    ];
  }
}
