import type { Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import type { Slice } from '../../../../shared-kernel/domain';
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

  async list(criteria: ProductListCriteria): Promise<Slice<Product>> {
    let query = this.trx.selectFrom('products').where('deleted_at', 'is', null);

    if (criteria.visibility === 'public') query = query.where('is_available', '=', true);
    if (criteria.isAvailable !== null) query = query.where('is_available', '=', criteria.isAvailable);
    if (criteria.category !== null) query = query.where('category', '=', criteria.category);
    if (criteria.search !== null) {
      query = query.where('name', 'ilike', `%${escapeLikePattern(criteria.search)}%`);
    }

    const [counted, rows] = await Promise.all([
      query.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
      query
        .selectAll()
        .orderBy(SORT_COLUMNS[criteria.sort.field], criteria.sort.direction)
        // Desempate estável para a paginação não repetir nem pular itens.
        .orderBy('id', 'asc')
        .limit(criteria.limit)
        .offset(criteria.offset)
        .execute(),
    ]);

    return { items: rows.map(toProduct), total: Number(counted.total) };
  }
}

/** O termo de busca é texto literal: `%`, `_` e `\` não viram curingas. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
