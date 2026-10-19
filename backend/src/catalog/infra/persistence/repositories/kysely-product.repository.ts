import type { Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import {
  keysetScanDirection,
  toKeysetSlice,
  type KeysetSlice,
  type SortKeyValue,
} from '../../../../shared-kernel/domain';
import { centsToDecimal } from '../../../../shared-kernel/infra/database/numeric';
import type {
  Product,
  ProductId,
  ProductListCriteria,
  ProductRepository,
  ProductSortField,
} from '../../../domain';
import type { CatalogDatabase } from '../schema/catalog-database';
import { toProduct, toProductRow } from '../mappers/product.mapper';

const SORT_COLUMNS = {
  name: 'name',
  price: 'price',
  createdAt: 'created_at',
} as const satisfies Record<ProductSortField, string>;

/** O valor do cursor (nome, centavos, epoch em ms) no tipo da coluna. */
const TO_COLUMN_VALUE = {
  name: (value: SortKeyValue) => String(value),
  price: (value: SortKeyValue) => centsToDecimal(Number(value)),
  createdAt: (value: SortKeyValue) => new Date(value),
} as const satisfies Record<ProductSortField, (value: SortKeyValue) => unknown>;

/**
 * Repositório de Product em PostgreSQL. Só existe dentro de uma transação
 * aberta pela unit of work; `save` grava o agregado e entrega os eventos
 * dele ao buffer da transação, que a unit of work publica no mediador.
 */
export class KyselyProductRepository implements ProductRepository {
  constructor(
    private readonly trx: Transaction<CatalogDatabase>,
    private readonly events: DomainEventBuffer,
  ) {}

  async findById(id: ProductId): Promise<Product | null> {
    const row = await this.trx
      .selectFrom('products')
      .selectAll()
      .where('id', '=', id.value)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row === undefined ? null : toProduct(row);
  }

  async save(product: Product): Promise<void> {
    const { id, created_at: _createdAt, ...changes } = toProductRow(product);

    await this.trx
      .insertInto('products')
      .values({ id, created_at: product.createdAt, ...changes })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(changes))
      .execute();

    this.events.collectFrom(product);
  }

  async list(criteria: ProductListCriteria): Promise<KeysetSlice<Product>> {
    let query = this.trx.selectFrom('products').where('deleted_at', 'is', null);

    if (criteria.visibility === 'public') query = query.where('is_available', '=', true);
    if (criteria.isAvailable !== null) query = query.where('is_available', '=', criteria.isAvailable);
    if (criteria.category !== null) query = query.where('category', '=', criteria.category);
    if (criteria.search !== null) {
      query = query.where('name', 'ilike', `%${escapeLikePattern(criteria.search)}%`);
    }

    const { field } = criteria.sort;
    const column = SORT_COLUMNS[field];
    const { keyset } = criteria;
    const scan = keysetScanDirection(criteria.sort.direction, keyset);
    if (keyset !== null) {
      const value = TO_COLUMN_VALUE[field](keyset.value);
      query = query.where((eb) =>
        eb(eb.refTuple(column, 'id'), scan === 'asc' ? '>' : '<', eb.tuple(value, keyset.id)),
      );
    }

    // Um item a mais só para saber se há outra página; desempate na mesma direção (mesmo índice).
    const rows = await query.selectAll().orderBy(column, scan).orderBy('id', scan).limit(criteria.limit + 1).execute();
    const slice = toKeysetSlice(rows, criteria.limit, keyset);
    return { items: slice.items.map(toProduct), hasMore: slice.hasMore };
  }
}

/** O termo de busca é texto literal: `%`, `_` e `\` não viram curingas. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
