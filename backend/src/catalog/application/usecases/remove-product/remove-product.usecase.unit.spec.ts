import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  ProductInUseError,
  ProductNotFoundError,
  ProductRemoved,
  type Product,
} from '../../../domain';
import { buildProduct } from '../../../domain/product/testing/product.fixture';
import { InMemoryCatalogUnitOfWork } from '../../testing/in-memory-catalog-unit-of-work';
import { RemoveProductUseCase } from './remove-product.usecase';

const NOW = new Date('2025-02-01T12:00:00Z');
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('RemoveProductUseCase', () => {
  let unitOfWork: InMemoryCatalogUnitOfWork;
  let removeProduct: RemoveProductUseCase;
  let burger: Product;

  beforeEach(() => {
    unitOfWork = new InMemoryCatalogUnitOfWork();
    removeProduct = new RemoveProductUseCase(unitOfWork, new FixedClock(NOW));
    burger = buildProduct();
    unitOfWork.givenProducts(burger);
  });

  it('faz soft delete e publica ProductRemoved', async () => {
    await removeProduct.execute({ id: burger.id.value });

    const committed = unitOfWork.committedProduct(burger.id.value);
    expect(committed?.isRemoved).toBe(true);
    expect(committed?.removedAt).toEqual(NOW);
    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([ProductRemoved]);
  });

  it('não remove produto presente em pedidos pending/preparing (409 PRODUCT_IN_USE)', async () => {
    unitOfWork.givenActiveOrdersFor(burger);

    const attempt = removeProduct.execute({ id: burger.id.value });

    await expect(attempt).rejects.toBeInstanceOf(ProductInUseError);
    await expect(attempt).rejects.toMatchObject({ code: 'PRODUCT_IN_USE' });
    expect(unitOfWork.committedProduct(burger.id.value)?.isRemoved).toBe(false);
    expect(unitOfWork.rollbacks).toBe(1);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });

  it('só consulta pedidos do produto informado', async () => {
    const juice = buildProduct();
    unitOfWork.givenProducts(juice);
    unitOfWork.givenActiveOrdersFor(juice);

    await removeProduct.execute({ id: burger.id.value });

    expect(unitOfWork.committedProduct(burger.id.value)?.isRemoved).toBe(true);
  });

  it('lança PRODUCT_NOT_FOUND para ID inexistente', async () => {
    await expect(removeProduct.execute({ id: UNKNOWN_ID })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('remover de novo um produto já removido também é PRODUCT_NOT_FOUND', async () => {
    await removeProduct.execute({ id: burger.id.value });

    await expect(removeProduct.execute({ id: burger.id.value })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(unitOfWork.publishedEvents).toHaveLength(1);
  });

  it('rejeita ID malformado sem abrir transação', async () => {
    await expect(removeProduct.execute({ id: 'abc' })).rejects.toBeInstanceOf(
      InputValidationError,
    );
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o produto continua ativo e nada é publicado', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(removeProduct.execute({ id: burger.id.value })).rejects.toBe(databaseDown);

    expect(unitOfWork.committedProduct(burger.id.value)?.isRemoved).toBe(false);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
