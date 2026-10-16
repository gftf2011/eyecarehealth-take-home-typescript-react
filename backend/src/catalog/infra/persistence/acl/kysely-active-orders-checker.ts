import type { Transaction } from 'kysely';

import type { ActiveOrdersChecker } from '../../../application/ports/active-orders-checker';
import type { ProductId } from '../../../domain';
import type { CatalogDatabase } from '../schema/catalog-database';

/** Status de pedido em que o produto ainda não pode sair do cardápio. */
const ACTIVE_ORDER_STATUSES = ['pending', 'preparing'] as const;

/**
 * ACL para o Ordering. Trava a linha do produto (`FOR UPDATE`) até o fim da
 * transação e só **depois** procura pedidos em aberto com ele, em outra
 * consulta: quem cria pedido trava o produto com `FOR SHARE`, então a remoção
 * espera os pedidos em andamento confirmarem e, já com o lock, os enxerga.
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

    const activeOrder = await this.trx
      .selectFrom('order_items')
      .innerJoin('orders', 'orders.id', 'order_items.order_id')
      .select('orders.id')
      .where('order_items.product_id', '=', productId.value)
      .where('orders.status', 'in', [...ACTIVE_ORDER_STATUSES])
      .limit(1)
      .executeTakeFirst();
    return activeOrder !== undefined;
  }
}
