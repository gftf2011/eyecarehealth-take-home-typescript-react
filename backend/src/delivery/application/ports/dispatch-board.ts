import type { DeliveryPersonId, DispatchableOrder, OrderId } from '../../domain';

/** Entrega em andamento: um pedido `delivering` e o seu entregador. */
export type DeliveryInProgress = {
  readonly deliveryPersonId: DeliveryPersonId;
  readonly orderId: OrderId;
};

/**
 * Camada anticorrupção para o contexto Ordering: o "quadro de despacho" visto
 * pelo Delivery — quais pedidos aguardam entregador e quais entregadores já
 * estão em uma entrega. O Delivery não conhece o agregado Order, só esses fatos.
 */
export interface DispatchBoard {
  /** Pedidos com status `ready`, com endereço e coordenadas de entrega. */
  readyOrders(): Promise<readonly DispatchableOrder[]>;

  /** Todas as entregas em andamento, em uma consulta (no máximo uma por entregador). */
  deliveriesInProgress(): Promise<readonly DeliveryInProgress[]>;

  /**
   * O entregador tem pedido `delivering`? Chamado depois de travar o
   * entregador, em consulta própria, para enxergar despachos que confirmaram
   * enquanto se esperava o lock.
   */
  hasDeliveryInProgress(id: DeliveryPersonId): Promise<boolean>;
}
