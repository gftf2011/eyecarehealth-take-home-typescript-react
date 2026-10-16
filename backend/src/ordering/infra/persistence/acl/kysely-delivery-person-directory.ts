import type { Transaction } from 'kysely';

import type {
  DeliveryPersonDirectory,
  DeliveryPersonSummary,
} from '../../../application/ports/delivery-person-directory';
import { DeliveryPersonAvailability, DeliveryPersonId } from '../../../domain';
import type { OrderingDatabase } from '../schema/ordering-database';

/** ACL para o Delivery: disponibilidade (com lock) e resumo de exibição dos entregadores. */
export class KyselyDeliveryPersonDirectory implements DeliveryPersonDirectory {
  constructor(private readonly trx: Transaction<OrderingDatabase>) {}

  /**
   * Duas consultas de propósito: primeiro trava o entregador; só depois,
   * já com o lock, verifica se ele tem pedido `delivering`. Em READ COMMITTED
   * cada comando enxerga o que foi confirmado antes dele começar: se a
   * verificação estivesse na mesma consulta do lock, quem esperou o lock
   * avaliaria o `EXISTS` com a foto de antes do despacho concorrente e
   * despacharia o entregador duas vezes.
   */
  async availabilityOf(id: DeliveryPersonId): Promise<DeliveryPersonAvailability | null> {
    const person = await this.trx
      .selectFrom('delivery_persons')
      .select(['id', 'is_active'])
      .where('id', '=', id.value)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();
    if (person === undefined) return null;

    const inProgress = await this.trx
      .selectFrom('orders')
      .select('id')
      .where('delivery_person_id', '=', id.value)
      .where('status', '=', 'delivering')
      .limit(1)
      .executeTakeFirst();

    return DeliveryPersonAvailability.create({
      deliveryPersonId: DeliveryPersonId.from(person.id),
      isActive: person.is_active,
      hasDeliveryInProgress: inProgress !== undefined,
    });
  }

  /** Uma consulta para todos os IDs, sem lock; inclui removidos. */
  async summariesOf(ids: readonly DeliveryPersonId[]): Promise<readonly DeliveryPersonSummary[]> {
    if (ids.length === 0) return [];
    return this.trx
      .selectFrom('delivery_persons')
      .select(['id', 'name'])
      .where(
        'id',
        'in',
        ids.map((id) => id.value),
      )
      .execute();
  }
}
