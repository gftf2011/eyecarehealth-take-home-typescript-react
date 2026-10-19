import type { Page } from '../../../shared-kernel/application';
import type { Order, OrderListCriteria, OrderStatusValue, ReturnReason } from '../../domain';

export type RequestOptions = {
  /** Cancela a requisição (ex.: o usuário trocou o filtro antes da resposta). */
  readonly signal?: AbortSignal;
};

/** Pedidos na API: a fonte da verdade, que valida e persiste cada mudança. */
export interface OrderGateway {
  list(criteria: OrderListCriteria, options?: RequestOptions): Promise<Page<Order>>;
  findById(id: string, options?: RequestOptions): Promise<Order>;
  /** `PATCH /orders/:id/status`; devolve o pedido já atualizado. */
  changeStatus(id: string, status: OrderStatusValue): Promise<Order>;
  /** `POST /orders/:id/return-to-assignment`: a entrega volta para `ready`, sem entregador. */
  returnToAssignment(id: string, reason: ReturnReason): Promise<Order>;
}
