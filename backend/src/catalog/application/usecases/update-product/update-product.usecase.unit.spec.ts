import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application/index';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  ProductAvailabilityChanged,
  ProductNotFoundError,
  ProductPriceChanged,
  ProductUpdated,
  type Product,
} from '../../../domain/index';
import { buildProduct, CREATED_AT } from '../../../domain/product/testing/product.fixture';
import { InMemoryCatalogUnitOfWork } from '../../testing/in-memory-catalog-unit-of-work';
import { UpdateProductUseCase } from './update-product.usecase';

const NOW = new Date('2025-02-01T12:00:00Z');
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('UpdateProductUseCase', () => {
  let unitOfWork: InMemoryCatalogUnitOfWork;
  let updateProduct: UpdateProductUseCase;
  let burger: Product;

  beforeEach(() => {
    unitOfWork = new InMemoryCatalogUnitOfWork();
    updateProduct = new UpdateProductUseCase(unitOfWork, new FixedClock(NOW));
    burger = buildProduct();
    unitOfWork.givenProducts(burger);
  });

  it('altera só os campos enviados e persiste', async () => {
    const product = await updateProduct.execute({ id: burger.id.value, name: 'X-Burger Duplo' });

    expect(product).toMatchObject({
      id: burger.id.value,
      name: 'X-Burger Duplo',
      price: 32.9,
      category: 'meal',
      createdAt: CREATED_AT,
      updatedAt: NOW,
    });
    expect(unitOfWork.committedProduct(burger.id.value)?.name.value).toBe('X-Burger Duplo');
    expect(unitOfWork.outbox.map((event) => event.constructor)).toEqual([ProductUpdated]);
  });

  it('registra ProductPriceChanged quando o preço muda', async () => {
    await updateProduct.execute({ id: burger.id.value, price: 35 });

    expect(unitOfWork.outbox.map((event) => event.constructor)).toEqual([
      ProductUpdated,
      ProductPriceChanged,
    ]);
    expect(unitOfWork.committedProduct(burger.id.value)?.price.toDecimal()).toBe(35);
  });

  it('altera a disponibilidade na mesma transação dos demais campos', async () => {
    const product = await updateProduct.execute({
      id: burger.id.value,
      preparationTime: 30,
      isAvailable: false,
    });

    expect(product.isAvailable).toBe(false);
    expect(product.preparationTime).toBe(30);
    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.outbox.map((event) => event.constructor)).toEqual([
      ProductUpdated,
      ProductAvailabilityChanged,
    ]);
  });

  it.each([null, '', '  '])('remove a imagem com imageUrl %j', async (imageUrl) => {
    const product = await updateProduct.execute({ id: burger.id.value, imageUrl });
    expect(product.imageUrl).toBeNull();
  });

  it('sem alterações efetivas, não gera eventos', async () => {
    const product = await updateProduct.execute({
      id: burger.id.value,
      name: 'X-Burger Especial',
      isAvailable: true,
    });

    expect(product.updatedAt).toEqual(CREATED_AT);
    expect(unitOfWork.outbox).toHaveLength(0);
  });

  it('lança PRODUCT_NOT_FOUND para ID inexistente', async () => {
    await expect(updateProduct.execute({ id: UNKNOWN_ID, name: 'Novo nome' })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(unitOfWork.rollbacks).toBe(1);
  });

  it('trata produto removido como inexistente', async () => {
    const removed = buildProduct();
    removed.remove({ hasActiveOrders: false, now: CREATED_AT });
    unitOfWork.givenProducts(removed);

    await expect(
      updateProduct.execute({ id: removed.id.value, name: 'Novo nome' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('agrupa erros de validação, inclusive de ID malformado, sem abrir transação', async () => {
    const attempt = updateProduct.execute({ id: 'abc', price: -1, preparationTime: 0 });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'productId' },
        { field: 'price', message: 'O preço deve ser maior que zero' },
        { field: 'preparationTime' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o produto e o outbox ficam como estavam', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(
      updateProduct.execute({ id: burger.id.value, price: 99, isAvailable: false }),
    ).rejects.toBe(databaseDown);

    const committed = unitOfWork.committedProduct(burger.id.value);
    expect(committed?.price.toDecimal()).toBe(32.9);
    expect(committed?.isAvailable).toBe(true);
    expect(unitOfWork.outbox).toHaveLength(0);
  });
});
