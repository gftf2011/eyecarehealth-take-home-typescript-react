import { useQueryClient } from '@tanstack/react-query';

import { useLiveEvents } from '../../../shared-kernel/presentation';
import { productQueryKeys } from '../queries/product-query-keys';

/** Tópico público das mudanças no cardápio (contrato do backend). */
export const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';

/**
 * Cardápio em tempo real: um produto criado, editado, pausado ou removido em
 * qualquer lugar (outra aba, outro gestor) recarrega a tabela sem F5. Depois
 * de uma queda da conexão, recarrega tudo (eventos podem ter se perdido).
 */
export function useProductLiveUpdates(): void {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
  };
  useLiveEvents(PRODUCT_UPDATES_TOPIC, refresh, refresh);
}
