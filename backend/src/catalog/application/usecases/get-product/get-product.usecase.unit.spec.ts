import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { ProductName, ProductNotFoundError, type Product } from '../../../domain';
import { buildProduct, CREATED_AT } from '../../../domain/product/testing/product.fixture';
import { InMemoryCatalogUnitOfWork } from '../../testing/in-memory-catalog-unit-of-work';
import { GetProductUseCase } from './get-product.usecase';

describe('GetProductUseCase', () => {
  let unitOfWork: InMemoryCatalogUnitOfWork;
  let getProduct: GetProductUseCase;
  let burger: Product;
  let pudding: Product;

  beforeEach(() => {
    unitOfWork = new InMemoryCatalogUnitOfWork();
    getProduct = new GetProductUseCase(unitOfWork);
    burger = buildProduct();
    pudding = buildProduct({ name: ProductName.create('Pudim de Leite'), isAvailable: false });
    unitOfWork.givenProducts(burger, pudding);
  });

  it('devolve o produto pelo ID como DTO', async () => {
    await expect(getProduct.execute({ id: burger.id.value })).resolves.toEqual({
      id: burger.id.value,
      name: 'X-Burger Especial',
      description: 'Hamburguer artesanal com queijo cheddar e bacon',
      price: 32.9,
      category: 'meal',
      imageUrl: 'https://example.com/burger.jpg',
      isAvailable: true,
      preparationTime: 25,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
  });

  it('aceita o ID em maiúsculas', async () => {
    const product = await getProduct.execute({ id: burger.id.value.toUpperCase() });
    expect(product.id).toBe(burger.id.value);
  });

  it('no backoffice, mostra produto indisponível', async () => {
    const product = await getProduct.execute({ id: pudding.id.value });
    expect(product.isAvailable).toBe(false);
  });

  it('na visão pública, produto indisponível é PRODUCT_NOT_FOUND', async () => {
    await expect(
      getProduct.execute({ id: pudding.id.value, visibility: 'public' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('produto removido é PRODUCT_NOT_FOUND', async () => {
    const removed = buildProduct();
    removed.remove({ hasActiveOrders: false, now: CREATED_AT });
    unitOfWork.givenProducts(removed);

    await expect(getProduct.execute({ id: removed.id.value })).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    });
  });

  it('lança PRODUCT_NOT_FOUND para ID inexistente', async () => {
    await expect(
      getProduct.execute({ id: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('rejeita ID malformado sem abrir transação', async () => {
    await expect(getProduct.execute({ id: '123' })).rejects.toBeInstanceOf(InputValidationError);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('não grava nada', async () => {
    await getProduct.execute({ id: burger.id.value });
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
