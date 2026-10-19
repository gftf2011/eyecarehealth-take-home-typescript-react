import { useQueryClient } from '@tanstack/react-query';

import type { LiveEvent } from '../../../shared-kernel/application';
import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import type { MyDeliveries } from '../../domain';
import { DELIVERY_PERSON_UPDATES_TOPIC } from './use-delivery-person-live-updates';
import { MY_DELIVERIES_QUERY_KEY } from './use-my-deliveries';

/** Tópico público das atualizações de pedidos (contrato do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/**
 * A tela do entregador só muda com o que é dele: um pedido atribuído ou
 * despachado para ele, tirado dele, ou um dos pedidos que já estão na tela; ou
 * uma mudança no próprio cadastro. Antes de a tela carregar, qualquer evento
 * conta (ainda não se sabe quem ele é).
 */
export function myDeliveriesAffectedBy(event: LiveEvent, current: MyDeliveries | undefined): boolean {
  if (current === undefined) return true;
  const me = current.courier.id;
  const { payload } = event;
  if (event.topic === DELIVERY_PERSON_UPDATES_TOPIC) return payload['deliveryPersonId'] === me;

  const onScreen = new Set([current.inProgress, ...current.upcoming].flatMap((order) => (order === null ? [] : [order.orderId])));
  return (
    payload['deliveryPersonId'] === me ||
    payload['previousDeliveryPersonId'] === me ||
    (typeof payload['orderId'] === 'string' && onScreen.has(payload['orderId']))
  );
}

/** O gestor despachou, devolveu ou cancelou um pedido dele: a tela recarrega sozinha. */
export function useMyDeliveriesLiveUpdates(): void {
  const queryClient = useQueryClient();
  const affects = (event: LiveEvent): boolean =>
    myDeliveriesAffectedBy(event, queryClient.getQueryData<MyDeliveries>(MY_DELIVERIES_QUERY_KEY));
  useLiveInvalidation([
    { topic: ORDER_UPDATES_TOPIC, queryKey: MY_DELIVERIES_QUERY_KEY, affects },
    { topic: DELIVERY_PERSON_UPDATES_TOPIC, queryKey: MY_DELIVERIES_QUERY_KEY, affects },
  ]);
}
