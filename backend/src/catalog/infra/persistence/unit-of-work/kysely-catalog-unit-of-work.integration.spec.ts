import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import { CreateProductUseCase } from '../../../application/usecases/create-product/create-product.usecase';
import { GetProductUseCase } from '../../../application/usecases/get-product/get-product.usecase';
import { ListProductsUseCase } from '../../../application/usecases/list-products/list-products.usecase';
import { RemoveProductUseCase } from '../../../application/usecases/remove-product/remove-product.usecase';
import { UpdateProductUseCase } from '../../../application/usecases/update-product/update-product.usecase';
import { ProductNotFoundError } from '../../../domain';
import { buildProduct } from '../../../domain/product/testing/product.fixture';
import type { CatalogDatabase } from '../schema/catalog-database';
import { KyselyCatalogUnitOfWork } from './kysely-catalog-unit-of-work';

const db = connectToTestDatabase<CatalogDatabase>();
const unitOfWork = new KyselyCatalogUnitOfWork(db);
const START = new Date('2025-02-01T12:00:00Z');
let clock = new FixedClock(START);

async function count(table: 'products' | 'outbox_events'): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<string>().as('total'))
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

describe('KyselyCatalogUnitOfWork', () => {
  beforeEach(async () => {
    clock = new FixedClock(START);
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('confirma agregado e outbox juntos', async () => {
    await unitOfWork.transaction(({ products }) => products.save(buildProduct({})));
    // buildProduct já descartou o evento de criação; um novo save sem eventos não grava outbox.
    expect(await count('products')).toBe(1);

    const product = buildProduct();
    product.makeUnavailable(clock.now());
    await unitOfWork.transaction(({ products }) => products.save(product));

    expect(await count('products')).toBe(2);
    expect(await count('outbox_events')).toBe(1);
  });

  it('desfaz agregado e outbox juntos quando o trabalho falha', async () => {
    const failure = new Error('falha depois de salvar');
    const product = buildProduct();
    product.makeUnavailable(clock.now());

    await expect(
      unitOfWork.transaction(async ({ products }) => {
        await products.save(product);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await count('products')).toBe(0);
    expect(await count('outbox_events')).toBe(0);
  });

  it('as leituras dentro da transação enxergam as próprias escritas', async () => {
    const product = buildProduct();

    const found = await unitOfWork.transaction(async ({ products }) => {
      await products.save(product);
      return products.findById(product.id);
    });

    expect(found?.id.equals(product.id)).toBe(true);
  });

  it('roda os casos de uso do Catalog de ponta a ponta no PostgreSQL', async () => {
    const created = await new CreateProductUseCase(unitOfWork, clock).execute({
      name: 'Suco de Laranja Natural',
      description: 'Suco de laranja natural, feito na hora, 500ml',
      price: 12.5,
      category: 'drink',
      preparationTime: 5,
    });

    clock.advanceBy(60_000);
    const updated = await new UpdateProductUseCase(unitOfWork, clock).execute({
      id: created.id,
      price: 13.9,
      isAvailable: false,
    });
    expect(updated).toMatchObject({ price: 13.9, isAvailable: false });

    const publicPage = await new ListProductsUseCase(unitOfWork).execute({ visibility: 'public' });
    expect(publicPage.pagination.total).toBe(0);

    clock.advanceBy(60_000);
    await new RemoveProductUseCase(unitOfWork, clock).execute({ id: created.id });
    await expect(new GetProductUseCase(unitOfWork).execute({ id: created.id })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );

    const events = await db
      .selectFrom('outbox_events')
      .select('event_name')
      .orderBy('occurred_at')
      .orderBy('event_name')
      .execute();
    expect(events.map((event) => event.event_name)).toEqual([
      'catalog.product.created',
      'catalog.product.availability-changed',
      'catalog.product.price-changed',
      'catalog.product.updated',
      'catalog.product.removed',
    ]);
  });
});
