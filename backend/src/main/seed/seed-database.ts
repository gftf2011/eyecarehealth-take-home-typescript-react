import { sql } from 'kysely';
import type pg from 'pg';

import { CreateProductUseCase } from '../../catalog/application/usecases/create-product/create-product.usecase';
import { UpdateProductUseCase } from '../../catalog/application/usecases/update-product/update-product.usecase';
import type { CatalogDatabase } from '../../catalog/infra/persistence/schema/catalog-database';
import { KyselyCatalogUnitOfWork } from '../../catalog/infra/persistence/unit-of-work/kysely-catalog-unit-of-work';
import { RegisterDeliveryPersonUseCase } from '../../delivery/application/usecases/register-delivery-person/register-delivery-person.usecase';
import type { DeliveryDatabase } from '../../delivery/infra/persistence/schema/delivery-database';
import { KyselyDeliveryUnitOfWork } from '../../delivery/infra/persistence/unit-of-work/kysely-delivery-unit-of-work';
import { RegisterUserUseCase } from '../../identity/application/usecases/register-user/register-user.usecase';
import type { IdentityDatabase } from '../../identity/infra/persistence/schema/identity-database';
import { KyselyIdentityUnitOfWork } from '../../identity/infra/persistence/unit-of-work/kysely-identity-unit-of-work';
import { BcryptPasswordHasher } from '../../identity/infra/security/bcrypt-password.hasher';
import { ChangeOrderStatusUseCase } from '../../ordering/application/usecases/change-order-status/change-order-status.usecase';
import { DispatchOrderUseCase } from '../../ordering/application/usecases/dispatch-order/dispatch-order.usecase';
import { PlaceOrderUseCase } from '../../ordering/application/usecases/place-order/place-order.usecase';
import type { OrderingDatabase } from '../../ordering/infra/persistence/schema/ordering-database';
import { KyselyOrderingUnitOfWork } from '../../ordering/infra/persistence/unit-of-work/kysely-ordering-unit-of-work';
import { createKysely } from '../../shared-kernel/infra/database/postgres';
import { truncateApplicationTables } from '../../shared-kernel/infra/database/truncate-application-tables';
import { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { migrateToLatest } from '../database/migrations';
import { SeedClock } from './seed-clock';
import type { SeedData } from './seed-data';
import { runSeedScenario, type SeedSummary } from './seed-scenario';

export type SeedOptions = {
  readonly pool: pg.Pool;
  readonly data: SeedData;
  /** Referência dos horários gerados (normalmente o horário real da execução). */
  readonly now: Date;
  /** Apaga os dados da aplicação antes de popular. */
  readonly reset: boolean;
  readonly bcryptCost: number;
};

export type SeedResult =
  | { readonly status: 'seeded'; readonly summary: SeedSummary }
  /** O banco já tinha dados e `reset` não foi pedido: nada foi alterado. */
  | { readonly status: 'skipped' };

/**
 * Aplica as migrations pendentes e popula o banco pelos casos de uso.
 * Idempotente: com dados já presentes, não faz nada (a menos de `reset`).
 */
export async function seedDatabase(options: SeedOptions): Promise<SeedResult> {
  const db = createKysely<unknown>(options.pool);
  await migrateToLatest(db);

  if (options.reset) await truncateApplicationTables(db);
  else if (await hasApplicationData(options.pool)) return { status: 'skipped' };

  const clock = new SeedClock(options.now);
  // Sem handlers: o seed não deve gerar mensagens de tempo real para o painel.
  const events = new InMemoryEventMediator();
  const identity = new KyselyIdentityUnitOfWork(createKysely<IdentityDatabase>(options.pool), events);
  const catalog = new KyselyCatalogUnitOfWork(createKysely<CatalogDatabase>(options.pool), events);
  const delivery = new KyselyDeliveryUnitOfWork(createKysely<DeliveryDatabase>(options.pool), events);
  const ordering = new KyselyOrderingUnitOfWork(createKysely<OrderingDatabase>(options.pool), events);

  const summary = await runSeedScenario(
    options.data,
    {
      registerUser: new RegisterUserUseCase(identity, new BcryptPasswordHasher(options.bcryptCost), clock),
      createProduct: new CreateProductUseCase(catalog, clock),
      updateProduct: new UpdateProductUseCase(catalog, clock),
      registerDeliveryPerson: new RegisterDeliveryPersonUseCase(delivery, clock),
      placeOrder: new PlaceOrderUseCase(ordering, clock),
      changeOrderStatus: new ChangeOrderStatusUseCase(ordering, clock),
      dispatchOrder: new DispatchOrderUseCase(ordering, clock),
    },
    clock,
    options.now,
  );
  return { status: 'seeded', summary };
}

/** Qualquer usuário cadastrado indica um banco já em uso. */
async function hasApplicationData(pool: pg.Pool): Promise<boolean> {
  const db = createKysely<unknown>(pool);
  const { rows } = await sql<{ exists: boolean }>`SELECT EXISTS (SELECT 1 FROM users) AS exists`.execute(db);
  return rows[0]?.exists === true;
}
