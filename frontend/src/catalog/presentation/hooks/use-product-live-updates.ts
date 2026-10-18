import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import { productQueryKeys } from '../queries/product-query-keys';

/** Tópico público das mudanças no cardápio (contrato do backend). */
export const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';

/**
 * Cardápio em tempo real: um produto criado, editado, pausado ou removido em
 * qualquer lugar (outra aba, outro gestor) recarrega a tabela sem F5, no
 * máximo uma vez por segundo. Todo evento conta: o produto pode entrar ou
 * sair de qualquer filtro. Depois de uma queda da conexão, recarrega tudo.
 */
export function useProductLiveUpdates(): void {
  useLiveInvalidation([{ topic: PRODUCT_UPDATES_TOPIC, queryKey: productQueryKeys.lists() }]);
}
