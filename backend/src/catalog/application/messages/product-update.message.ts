/**
 * Tópico público das mudanças no cardápio, consumido pelo painel em tempo
 * real (outbox → relay → Redis pub/sub → WebSocket): uma aba ou um gestor
 * altera um produto e as outras telas abertas recarregam.
 */
export const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';

/** Versão do contrato abaixo; mudanças incompatíveis exigem nova versão. */
export const PRODUCT_UPDATES_VERSION = 1;

/**
 * Contrato público, separado dos eventos de domínio: só o que o painel
 * precisa para saber o que recarregar. Os dados completos vêm pela API.
 */
export type ProductUpdateMessage =
  | {
      readonly type: 'product.created' | 'product.updated' | 'product.price-changed' | 'product.removed';
      readonly productId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'product.availability-changed';
      readonly productId: string;
      readonly isAvailable: boolean;
      readonly occurredAt: string;
    };
