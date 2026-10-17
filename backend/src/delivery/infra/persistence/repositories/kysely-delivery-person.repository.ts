import type { Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import type {
  DeliveryPerson,
  DeliveryPersonId,
  DeliveryPersonListCriteria,
  DeliveryPersonRepository,
} from '../../../domain';
import { toDeliveryPerson, toDeliveryPersonRow } from '../mappers/delivery-person.mapper';
import type { DeliveryDatabase } from '../schema/delivery-database';

/**
 * Repositório de DeliveryPerson em PostgreSQL. Só existe dentro de uma
 * transação aberta pela unit of work; nenhuma leitura devolve removidos.
 */
export class KyselyDeliveryPersonRepository implements DeliveryPersonRepository {
  constructor(
    private readonly trx: Transaction<DeliveryDatabase>,
    private readonly events: DomainEventBuffer,
  ) {}

  async findById(id: DeliveryPersonId): Promise<DeliveryPerson | null> {
    const row = await this.trx
      .selectFrom('delivery_persons')
      .selectAll()
      .where('id', '=', id.value)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row === undefined ? null : toDeliveryPerson(row);
  }

  /** Mesmo lock (`FOR UPDATE` na linha) que a ACL do Ordering usa ao despachar. */
  async findByIdForUpdate(id: DeliveryPersonId): Promise<DeliveryPerson | null> {
    const row = await this.trx
      .selectFrom('delivery_persons')
      .selectAll()
      .where('id', '=', id.value)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();
    return row === undefined ? null : toDeliveryPerson(row);
  }

  async save(person: DeliveryPerson): Promise<void> {
    const { id, created_at: _createdAt, ...changes } = toDeliveryPersonRow(person);

    await this.trx
      .insertInto('delivery_persons')
      .values({ id, created_at: person.createdAt, ...changes })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(changes))
      .execute();

    this.events.collectFrom(person);
  }

  async list(criteria: DeliveryPersonListCriteria): Promise<readonly DeliveryPerson[]> {
    let query = this.trx.selectFrom('delivery_persons').selectAll().where('deleted_at', 'is', null);
    if (criteria.isActive !== null) query = query.where('is_active', '=', criteria.isActive);

    const rows = await query.orderBy('name').orderBy('id').execute();
    return rows.map(toDeliveryPerson);
  }
}
