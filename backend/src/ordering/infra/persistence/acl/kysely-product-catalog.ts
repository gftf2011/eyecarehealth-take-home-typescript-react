import type { Transaction } from 'kysely';

import { Money } from '../../../../shared-kernel/domain';
import { decimalToCents } from '../../../../shared-kernel/infra/database/numeric';
import type { ProductCatalog } from '../../../application/ports/product-catalog';
import { ProductId, ProductSnapshot } from '../../../domain';
import type { OrderingDatabase } from '../schema/ordering-database';

/**
 * ACL para o Catalog: lê nome, preço e disponibilidade dos produtos não
 * removidos e os trava em modo compartilhado (`FOR SHARE`) até o fim da
 * transação. Pedidos simultâneos com o mesmo produto não se bloqueiam, mas a
 * remoção (que usa `FOR UPDATE`) espera o pedido terminar — e, se vier antes,
 * o pedido deixa de enxergar o produto removido.
 */
export class KyselyProductCatalog implements ProductCatalog {
  constructor(private readonly trx: Transaction<OrderingDatabase>) {}

  async snapshotsOf(ids: readonly ProductId[]): Promise<readonly ProductSnapshot[]> {
    if (ids.length === 0) return [];

    const rows = await this.trx
      .selectFrom('products')
      .select(['id', 'name', 'price', 'is_available'])
      .where(
        'id',
        'in',
        ids.map((id) => id.value),
      )
      .where('deleted_at', 'is', null)
      .forShare()
      .execute();

    return rows.map((row) =>
      ProductSnapshot.create({
        productId: ProductId.from(row.id),
        name: row.name,
        unitPrice: Money.fromCents(decimalToCents(row.price)),
        isAvailable: row.is_available,
      }),
    );
  }
}
