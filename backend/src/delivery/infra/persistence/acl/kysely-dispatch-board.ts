import type { Transaction } from 'kysely';

import { toCoordinate } from '../../../../shared-kernel/infra/database/numeric';
import type { DeliveryInProgress, DispatchBoard } from '../../../application/ports/dispatch-board';
import { DeliveryPersonId, DispatchableOrder, GeoPoint, OrderId } from '../../../domain';
import type { DeliveryDatabase } from '../schema/delivery-database';

/**
 * ACL para o Ordering: traduz a tabela `orders` nos fatos que o Delivery
 * precisa para despachar. Leituras sem lock: a sugestão é só uma proposta e
 * quem altera (aceitar, remover) trava o entregador antes de decidir.
 */
export class KyselyDispatchBoard implements DispatchBoard {
  constructor(private readonly trx: Transaction<DeliveryDatabase>) {}

  /** Pedidos `ready`, dos mais antigos aos mais novos (índice `(status, created_at)`). */
  async readyOrders(): Promise<readonly DispatchableOrder[]> {
    const rows = await this.trx
      .selectFrom('orders')
      .select(['id', 'delivery_address', 'latitude', 'longitude'])
      .where('status', '=', 'ready')
      .orderBy('created_at')
      .orderBy('id')
      .execute();

    return rows.map((row) =>
      DispatchableOrder.create({
        orderId: OrderId.from(row.id),
        deliveryAddress: row.delivery_address,
        location: GeoPoint.create(toCoordinate(row.latitude), toCoordinate(row.longitude)),
      }),
    );
  }

  async deliveriesInProgress(): Promise<readonly DeliveryInProgress[]> {
    const rows = await this.trx
      .selectFrom('orders')
      .select(['id', 'delivery_person_id'])
      .where('status', '=', 'delivering')
      .where('delivery_person_id', 'is not', null)
      .execute();

    return rows.flatMap((row) =>
      row.delivery_person_id === null
        ? []
        : [{ deliveryPersonId: DeliveryPersonId.from(row.delivery_person_id), orderId: OrderId.from(row.id) }],
    );
  }

  async hasDeliveryInProgress(id: DeliveryPersonId): Promise<boolean> {
    const row = await this.trx
      .selectFrom('orders')
      .select('id')
      .where('delivery_person_id', '=', id.value)
      .where('status', '=', 'delivering')
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }
}
