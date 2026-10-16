import type { InstantRange } from '../../../../shared-kernel/domain';

export type OrderStatusCountRow = {
  readonly status: string;
  readonly count: number;
};

/**
 * Port de leitura: contagem de pedidos por status atual, filtrando pela data
 * de criação do pedido (pedidos não entregues não têm data de entrega).
 * Status sem pedidos podem ser omitidos.
 */
export interface OrdersByStatusQuery {
  countByStatus(range: InstantRange): Promise<readonly OrderStatusCountRow[]>;
}
