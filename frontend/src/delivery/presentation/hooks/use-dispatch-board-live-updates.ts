import type { LiveEvent } from '../../../shared-kernel/application';
import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import { DISPATCH_BOARD_QUERY_KEY } from './use-dispatch-board';

/** Tópico público das atualizações de pedidos (contrato do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/**
 * Status que o quadro mostra ou dos quais depende: pedidos `ready` aparecem
 * nele, e um entregador fica livre quando o pedido sai de `delivering`.
 */
const BOARD_STATUSES: ReadonlySet<unknown> = new Set(['ready', 'delivering']);

/**
 * O quadro de pedidos prontos e entregadores livres só muda quando um pedido
 * entra em `ready` ou sai dele, sai de `delivering` (libera o entregador) ou
 * troca de entregador. Pedido novo nasce `pending`: não mexe no quadro.
 */
export function dispatchBoardAffectedBy(event: LiveEvent): boolean {
  switch (event.payload['type']) {
    case 'order.placed':
      return false;
    case 'order.status-changed':
      return BOARD_STATUSES.has(event.payload['status']) || BOARD_STATUSES.has(event.payload['previousStatus']);
    default:
      // Troca de entregador ou um tipo novo: na dúvida, recarrega.
      return true;
  }
}

/** Um pedido ficou pronto ou foi despachado em outro lugar: o quadro recarrega sozinho. */
export function useDispatchBoardLiveUpdates(): void {
  useLiveInvalidation([
    { topic: ORDER_UPDATES_TOPIC, queryKey: DISPATCH_BOARD_QUERY_KEY, affects: dispatchBoardAffectedBy },
  ]);
}
