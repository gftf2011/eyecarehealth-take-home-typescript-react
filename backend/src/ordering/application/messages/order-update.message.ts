import type { OrderStatusValue } from '../../domain';

/**
 * Tópico público das atualizações de pedidos, consumido pelo painel em tempo
 * real (outbox → relay → Redis pub/sub → WebSocket). Um único tópico mantém a
 * ordem das mensagens de um mesmo pedido; o campo `type` diz o que mudou.
 */
export const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/** Versão do contrato abaixo; mudanças incompatíveis exigem nova versão. */
export const ORDER_UPDATES_VERSION = 1;

/**
 * Contrato público, separado dos eventos de domínio: só o que o painel
 * precisa para atualizar a lista (valores em reais, datas em ISO 8601). Dados
 * pessoais do cliente ficam de fora; o painel busca o detalhe pela API.
 */
export type OrderUpdateMessage =
  | {
      readonly type: 'order.placed';
      readonly orderId: string;
      readonly status: 'pending';
      readonly totalAmount: number;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'order.status-changed';
      readonly orderId: string;
      readonly previousStatus: OrderStatusValue;
      readonly status: OrderStatusValue;
      readonly deliveryPersonId: string | null;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'order.delivery-person-assigned';
      readonly orderId: string;
      readonly deliveryPersonId: string;
      readonly previousDeliveryPersonId: string | null;
      readonly occurredAt: string;
    };
