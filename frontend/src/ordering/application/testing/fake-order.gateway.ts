import type { Page } from '../../../shared-kernel/application';
import type { Order, OrderListCriteria, OrderStatusValue } from '../../domain';
import { buildOrder } from '../../domain/order/testing/order.fixture';
import type { OrderGateway } from '../ports/order-gateway';

/** Gateway em memória: devolve os pedidos configurados e registra o que recebeu. */
export class FakeOrderGateway implements OrderGateway {
  orders: Order[] = [buildOrder()];
  readonly listCalls: OrderListCriteria[] = [];
  readonly statusChanges: { id: string; status: OrderStatusValue }[] = [];
  changeStatusAnswer: ((id: string, status: OrderStatusValue) => Promise<Order>) | null = null;

  list(criteria: OrderListCriteria): Promise<Page<Order>> {
    this.listCalls.push(criteria);
    return Promise.resolve({
      data: this.orders,
      pagination: { page: criteria.page, limit: criteria.limit, total: this.orders.length, totalPages: 1 },
    });
  }

  findById(id: string): Promise<Order> {
    const order = this.orders.find((candidate) => candidate.id === id);
    return order === undefined ? Promise.reject(new Error(`pedido ${id} não configurado`)) : Promise.resolve(order);
  }

  changeStatus(id: string, status: OrderStatusValue): Promise<Order> {
    this.statusChanges.push({ id, status });
    if (this.changeStatusAnswer !== null) return this.changeStatusAnswer(id, status);
    return Promise.resolve(buildOrder({ id, status }));
  }
}
