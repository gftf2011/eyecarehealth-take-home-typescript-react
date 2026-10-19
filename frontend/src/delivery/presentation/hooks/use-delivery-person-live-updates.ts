import type { LiveEvent } from '../../../shared-kernel/application';
import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import { deliveryPersonQueryKeys } from '../queries/delivery-person-query-keys';

/** Tópico público das mudanças nos entregadores (contrato do backend). */
export const DELIVERY_PERSON_UPDATES_TOPIC = 'delivery.delivery-person-updates';

/** Tópico público das atualizações de pedidos (contrato do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/**
 * Dos pedidos, a lista só depende de quem está em entrega: muda quando um
 * pedido entra em `delivering` (despacho) ou sai dele (entregue, cancelado).
 * Pedido novo e troca (ou perda) de entregador num pedido que não saiu não
 * mexem nela.
 */
export function deliveryPersonListAffectedBy(event: LiveEvent): boolean {
  switch (event.payload['type']) {
    case 'order.placed':
    case 'order.delivery-person-assigned':
    case 'order.delivery-person-unassigned':
    // Problema na entrega: o entregador continua com o pedido até o gestor decidir.
    case 'order.delivery-issue-reported':
    case 'order.delivery-issue-resolved':
      return false;
    case 'order.status-changed':
      return event.payload['status'] === 'delivering' || event.payload['previousStatus'] === 'delivering';
    default:
      // Um tipo novo: na dúvida, recarrega.
      return true;
  }
}

/**
 * Frota em tempo real: um entregador cadastrado, editado, desativado ou
 * removido em outro lugar, ou um despacho/entrega que muda quem está livre,
 * recarrega a lista sem F5, no máximo uma vez por segundo.
 */
export function useDeliveryPersonLiveUpdates(): void {
  useLiveInvalidation([
    { topic: DELIVERY_PERSON_UPDATES_TOPIC, queryKey: deliveryPersonQueryKeys.lists() },
    { topic: ORDER_UPDATES_TOPIC, queryKey: deliveryPersonQueryKeys.lists(), affects: deliveryPersonListAffectedBy },
  ]);
}
