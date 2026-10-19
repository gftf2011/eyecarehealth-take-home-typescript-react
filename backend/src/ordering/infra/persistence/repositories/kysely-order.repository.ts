import type { Selectable, Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import {
  keysetScanDirection,
  toKeysetSlice,
  type KeysetSlice,
  type SortKeyValue,
} from '../../../../shared-kernel/domain';
import { centsToDecimal } from '../../../../shared-kernel/infra/database/numeric';
import type {
  DeliveryPersonId,
  Order,
  OrderId,
  OrderListCriteria,
  OrderRepository,
  OrderSortField,
} from '../../../domain';
import { toOrder, toOrderRows } from '../mappers/order.mapper';
import type {
  OrderingDatabase,
  OrdersTable,
} from '../schema/ordering-database';

const SORT_COLUMNS = {
  createdAt: 'created_at',
  totalAmount: 'total_amount',
} as const satisfies Record<OrderSortField, string>;

/** O valor do cursor (epoch em ms, centavos) no tipo da coluna. */
const TO_COLUMN_VALUE = {
  createdAt: (value: SortKeyValue) => new Date(value),
  totalAmount: (value: SortKeyValue) => centsToDecimal(Number(value)),
} as const satisfies Record<OrderSortField, (value: SortKeyValue) => unknown>;

/** Status em que o pedido ainda pode trocar (ou perder) o entregador. */
const UNDISPATCHED_STATUSES = ['pending', 'preparing', 'ready'] as const;

/**
 * Repositório de Order em PostgreSQL. Só existe dentro de uma transação aberta
 * pela unit of work. O agregado ocupa três tabelas, sempre lidas em lote
 * (uma consulta por tabela, nunca uma por pedido).
 */
export class KyselyOrderRepository implements OrderRepository {
  constructor(
    private readonly trx: Transaction<OrderingDatabase>,
    private readonly events: DomainEventBuffer,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.trx.selectFrom('orders').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row === undefined ? null : ((await this.hydrate([row]))[0] ?? null);
  }

  async findByIdForUpdate(id: OrderId): Promise<Order | null> {
    const row = await this.trx
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', id.value)
      .forUpdate()
      .executeTakeFirst();
    return row === undefined ? null : ((await this.hydrate([row]))[0] ?? null);
  }

  async findUndispatchedAssignedToForUpdate(deliveryPersonId: DeliveryPersonId): Promise<Order[]> {
    const rows = await this.trx
      .selectFrom('orders')
      .selectAll()
      .where('delivery_person_id', '=', deliveryPersonId.value)
      .where('status', 'in', UNDISPATCHED_STATUSES)
      .orderBy('id')
      .forUpdate()
      .execute();
    return this.hydrate(rows);
  }

  async listOpenAssignedTo(deliveryPersonId: DeliveryPersonId): Promise<Order[]> {
    const rows = await this.trx
      .selectFrom('orders')
      .selectAll()
      .where('delivery_person_id', '=', deliveryPersonId.value)
      .where('status', 'in', [...UNDISPATCHED_STATUSES, 'delivering'])
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return this.hydrate(rows);
  }

  /**
   * Upsert da raiz; itens e transições são imutáveis depois de gravados, então
   * só os novos entram (`ON CONFLICT DO NOTHING`). Salvar de novo o mesmo
   * agregado é idempotente.
   */
  async save(order: Order): Promise<void> {
    const rows = toOrderRows(order);
    const { id: _id, created_at: _createdAt, ...changes } = rows.order;

    await this.trx
      .insertInto('orders')
      .values(rows.order)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(changes))
      .execute();

    if (rows.items.length > 0) {
      await this.trx
        .insertInto('order_items')
        .values([...rows.items])
        .onConflict((conflict) => conflict.column('id').doNothing())
        .execute();
    }
    if (rows.history.length > 0) {
      await this.trx
        .insertInto('order_status_history')
        .values([...rows.history])
        .onConflict((conflict) => conflict.columns(['order_id', 'position']).doNothing())
        .execute();
    }
    // Um problema muda uma vez (ao ser resolvido): esses dois campos são atualizados.
    if (rows.issues.length > 0) {
      await this.trx
        .insertInto('order_delivery_issues')
        .values([...rows.issues])
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet((excluded) => ({
            resolved_at: excluded.ref('excluded.resolved_at'),
            resolution: excluded.ref('excluded.resolution'),
          })),
        )
        .execute();
    }

    this.events.collectFrom(order);
  }

  /**
   * Keyset: `(coluna, id)` depois (ou antes) do cursor, no mesmo índice da
   * ordenação. Lê um item a mais só para saber se há outra página.
   */
  async list(criteria: OrderListCriteria): Promise<KeysetSlice<Order>> {
    let query = this.trx.selectFrom('orders');
    if (criteria.status !== null) query = query.where('status', '=', criteria.status);
    if (criteria.createdAt.from !== null) query = query.where('created_at', '>=', criteria.createdAt.from);
    if (criteria.createdAt.to !== null) query = query.where('created_at', '<', criteria.createdAt.to);

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

    const rows = await query
      .selectAll()
      .orderBy(column, scan)
      // Desempate na mesma direção: o mesmo índice atende asc, desc e o keyset.
      .orderBy('id', scan)
      .limit(criteria.limit + 1)
      .execute();

    const slice = toKeysetSlice(rows, criteria.limit, keyset);
    return { items: await this.hydrate(slice.items), hasMore: slice.hasMore };
  }

  /** Carrega itens e histórico de todos os pedidos de uma vez e monta os agregados. */
  private async hydrate(rows: readonly Selectable<OrdersTable>[]): Promise<Order[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);

    const [items, history, issues] = await Promise.all([
      this.trx.selectFrom('order_items').selectAll().where('order_id', 'in', ids).execute(),
      this.trx.selectFrom('order_status_history').selectAll().where('order_id', 'in', ids).execute(),
      this.trx.selectFrom('order_delivery_issues').selectAll().where('order_id', 'in', ids).execute(),
    ]);

    const itemsByOrder = groupByOrder(items);
    const historyByOrder = groupByOrder(history);
    const issuesByOrder = groupByOrder(issues);
    return rows.map((row) =>
      toOrder(row, itemsByOrder.get(row.id) ?? [], historyByOrder.get(row.id) ?? [], issuesByOrder.get(row.id) ?? []),
    );
  }
}

function groupByOrder<TRow extends { readonly order_id: string }>(
  rows: readonly TRow[],
): Map<string, TRow[]> {
  const grouped = new Map<string, TRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.order_id);
    if (group === undefined) grouped.set(row.order_id, [row]);
    else group.push(row);
  }
  return grouped;
}
