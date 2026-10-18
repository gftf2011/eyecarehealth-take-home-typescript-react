import type { QueryKey } from '@tanstack/react-query';

import type { LiveEvent } from '../../../shared-kernel/application';
import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import { orderQueryKeys } from '../queries/order-query-keys';

/** Tópico público das atualizações de pedidos (contrato do backend). */
export const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/** Status por onde o pedido passou no evento (o novo e, numa mudança, o anterior). */
function statusesOf(event: LiveEvent): string[] {
  return [text(event.payload['status']), text(event.payload['previousStatus'])].filter(
    (status): status is string => status !== undefined,
  );
}

/**
 * Uma lista filtrada por status só muda se o pedido entrou nesse status ou
 * saiu dele. Sem filtro, ou com um evento sem status (troca de entregador),
 * não dá para descartar.
 */
export function orderListAffectedBy(event: LiveEvent, queryKey: QueryKey): boolean {
  const input = queryKey[2];
  const filter = typeof input === 'object' && input !== null && 'status' in input ? text(input.status)?.trim() : undefined;
  if (filter === undefined || filter === '') return true;
  const statuses = statusesOf(event);
  return statuses.length === 0 || statuses.includes(filter);
}

/** O detalhe aberto só muda com eventos do próprio pedido. */
export function orderDetailAffectedBy(event: LiveEvent, queryKey: QueryKey): boolean {
  return queryKey[2] === event.payload['orderId'];
}

/**
 * Painel em tempo real: um pedido criado ou alterado em qualquer lugar (outra
 * aba, outro gestor) recarrega as listas que ele afeta e o detalhe dele, no
 * máximo uma vez por segundo. Depois de uma queda da conexão, recarrega tudo.
 */
export function useOrderLiveUpdates(): void {
  useLiveInvalidation([
    { topic: ORDER_UPDATES_TOPIC, queryKey: orderQueryKeys.lists(), affects: orderListAffectedBy },
    { topic: ORDER_UPDATES_TOPIC, queryKey: orderQueryKeys.details(), affects: orderDetailAffectedBy },
  ]);
}
