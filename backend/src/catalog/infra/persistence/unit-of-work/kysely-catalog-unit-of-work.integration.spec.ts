import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { toOutboxMessage } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { RecordingEventMediator } from '../../../../shared-kernel/application/testing/recording-event-mediator';
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
const START = new Date('2025-02-01T12:00:00Z');
let clock = new FixedClock(START);
let mediator = new RecordingEventMediator();
let unitOfWork = new KyselyCatalogUnitOfWork(db, mediator);

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
    mediator = new RecordingEventMediator();
    unitOfWork = new KyselyCatalogUnitOfWork(db, mediator);
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('publica no mediador os eventos dos agregados salvos, sem gravar outbox por conta própria', async () => {
    // buildProduct já descartou o evento de criação: um save sem eventos não publica nada.
    await unitOfWork.transaction(({ products }) => products.save(buildProduct({})));
    expect(mediator.published).toHaveLength(0);

    const product = buildProduct();
    product.makeUnavailable(clock.now());
    await unitOfWork.transaction(({ products }) => products.save(product));

    expect(await count('products')).toBe(2);
    expect(mediator.publishedNames).toEqual(['catalog.product.availability-changed']);
    expect(await count('outbox_events')).toBe(0);
  });

  it('o que o handler grava no outbox é confirmado junto com o agregado', async () => {
    mediator.reactWith((event, { outbox }) => outbox.append([toOutboxMessage(event)]));
    const product = buildProduct();
    product.makeUnavailable(clock.now());

    await unitOfWork.transaction(({ products }) => products.save(product));

    expect(await count('products')).toBe(1);
    expect(await count('outbox_events')).toBe(1);
  });

  it('falha de handler desfaz o caso de uso inteiro', async () => {
    const failure = new Error('handler falhou');
    mediator.reactWith(async (event, { outbox }) => {
      await outbox.append([toOutboxMessage(event)]);
      throw failure;
    });
    const product = buildProduct();
    product.makeUnavailable(clock.now());

    await expect(unitOfWork.transaction(({ products }) => products.save(product))).rejects.toBe(failure);

    expect(await count('products')).toBe(0);
    expect(await count('outbox_events')).toBe(0);
  });

  it('não publica nada quando o trabalho falha', async () => {
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
    expect(mediator.published).toHaveLength(0);
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
    expect(publicPage.data).toEqual([]);

    clock.advanceBy(60_000);
    await new RemoveProductUseCase(unitOfWork, clock).execute({ id: created.id });
    await expect(new GetProductUseCase(unitOfWork).execute({ id: created.id })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );

    expect(mediator.publishedNames).toEqual([
      'catalog.product.created',
      'catalog.product.updated',
      'catalog.product.price-changed',
      'catalog.product.availability-changed',
      'catalog.product.removed',
    ]);
  });
});
