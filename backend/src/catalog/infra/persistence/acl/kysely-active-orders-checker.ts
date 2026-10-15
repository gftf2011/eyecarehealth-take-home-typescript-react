import type { Transaction } from 'kysely';

import type { ActiveOrdersChecker } from '../../../application/ports/active-orders-checker';
import type { ProductId } from '../../../domain';
import type { CatalogDatabase } from '../schema/catalog-database';

/**
 * ACL para o Ordering. Trava a linha do produto (`FOR UPDATE`) até o fim da
 * transação, para que nenhum pedido o inclua entre a checagem e a remoção.
 *
 * PENDENTE: as tabelas de pedidos chegam com a infra do Ordering. Até lá não
 * há pedidos, então a resposta é sempre `false`; a consulta a
 * `order_items`/`orders` (status `pending`/`preparing`) entra nessa etapa.
 */
export class KyselyActiveOrdersChecker implements ActiveOrdersChecker {
  constructor(private readonly trx: Transaction<CatalogDatabase>) {}

  async hasActiveOrdersFor(productId: ProductId): Promise<boolean> {
    await this.trx
      .selectFrom('products')
      .select('id')
      .where('id', '=', productId.value)
      .forUpdate()
      .execute();
    return false;
  }
}
