import type { DeliveryPersonId, DispatchableOrder } from '../../domain';

/**
 * Camada anticorrupção para o contexto Ordering: o "quadro de despacho" visto
 * pelo Delivery — quais pedidos aguardam entregador e quais entregadores já
 * estão em uma entrega. O Delivery não conhece o agregado Order, só esses fatos.
 */
export interface DispatchBoard {
  /** Pedidos com status `ready`, com endereço e coordenadas de entrega. */
  readyOrders(): Promise<readonly DispatchableOrder[]>;

  /** Entregadores com algum pedido `delivering` (em andamento). */
  deliveryPersonsWithDeliveryInProgress(): Promise<readonly DeliveryPersonId[]>;
}
