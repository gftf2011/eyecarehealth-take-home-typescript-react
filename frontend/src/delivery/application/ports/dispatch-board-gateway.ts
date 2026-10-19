import type { AvailableCourier, ReadyOrder } from '../../domain';

export type RequestOptions = {
  readonly signal?: AbortSignal;
};

/**
 * Camada anticorrupção: os pedidos prontos pertencem ao Ordering, mas o
 * Delivery lê só o que precisa, no próprio formato, sem importar o outro
 * contexto (como a ACL `DispatchBoard` do backend).
 */
export interface DispatchBoardGateway {
  readyOrders(options?: RequestOptions): Promise<{ readonly orders: readonly ReadyOrder[]; readonly hasMore: boolean }>;
  availableCouriers(options?: RequestOptions): Promise<readonly AvailableCourier[]>;
}
