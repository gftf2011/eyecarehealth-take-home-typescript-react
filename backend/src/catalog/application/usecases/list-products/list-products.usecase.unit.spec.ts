import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import {
  ProductCategory,
  ProductName,
  ProductPrice,
  type Product,
} from '../../../domain';
import { buildProduct } from '../../../domain/product/testing/product.fixture';
import { InMemoryCatalogUnitOfWork } from '../../testing/in-memory-catalog-unit-of-work';
import { ListProductsUseCase } from './list-products.usecase';

function product(
  name: string,
  price: number,
  category: string,
  createdAt: string,
  isAvailable = true,
): Product {
  return buildProduct({
    name: ProductName.create(name),
    price: ProductPrice.fromDecimal(price),
    category: ProductCategory.create(category),
    isAvailable,
    now: new Date(createdAt),
  });
}

describe('ListProductsUseCase', () => {
  let unitOfWork: InMemoryCatalogUnitOfWork;
  let listProducts: ListProductsUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryCatalogUnitOfWork();
    listProducts = new ListProductsUseCase(unitOfWork);
    unitOfWork.givenProducts(
      product('X-Burger Especial', 32.9, 'meal', '2025-01-01T10:00:00Z'),
      product('Suco de Laranja', 12.5, 'drink', '2025-01-02T10:00:00Z'),
      product('Burger Vegano', 29.9, 'meal', '2025-01-03T10:00:00Z'),
      product('Pudim de Leite', 14, 'dessert', '2025-01-04T10:00:00Z', false),
    );
  });

  const names = (page: { data: readonly { name: string }[] }): string[] =>
    page.data.map((item) => item.name);

  it('por padrão lista todos no backoffice, mais recentes primeiro', async () => {
    const page = await listProducts.execute({});

    expect(names(page)).toEqual([
      'Pudim de Leite',
      'Burger Vegano',
      'Suco de Laranja',
      'X-Burger Especial',
    ]);
    expect(page.pagination).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
  });

  it('busca por trecho do nome sem diferenciar maiúsculas', async () => {
    const page = await listProducts.execute({ search: '  BURGER ' });
    expect(names(page)).toEqual(['Burger Vegano', 'X-Burger Especial']);
  });

  it('filtra por categoria e disponibilidade', async () => {
    expect(names(await listProducts.execute({ category: 'meal' }))).toHaveLength(2);
    expect(names(await listProducts.execute({ isAvailable: false }))).toEqual(['Pudim de Leite']);
  });

  it('na visão pública esconde os indisponíveis', async () => {
    const page = await listProducts.execute({ visibility: 'public' });

    expect(names(page)).not.toContain('Pudim de Leite');
    expect(page.pagination.total).toBe(3);
  });

  it('ordena pelo campo e direção pedidos', async () => {
    const page = await listProducts.execute({ sortBy: 'price', sortOrder: 'ASC' });
    expect(page.data.map((item) => item.price)).toEqual([12.5, 14, 29.9, 32.9]);
  });

  it('pagina e calcula o total de páginas', async () => {
    const page = await listProducts.execute({ page: 2, limit: 3, sortBy: 'name', sortOrder: 'asc' });

    expect(names(page)).toEqual(['X-Burger Especial']);
    expect(page.pagination).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
  });

  it('nunca lista produtos removidos', async () => {
    const removed = product('Batata Frita', 15, 'side', '2025-01-05T10:00:00Z');
    removed.remove({ hasActiveOrders: false, now: new Date('2025-01-06T10:00:00Z') });
    unitOfWork.givenProducts(removed);

    expect(names(await listProducts.execute({}))).not.toContain('Batata Frita');
  });

  it('agrupa todos os parâmetros inválidos sem abrir transação', async () => {
    const attempt = listProducts.execute({
      page: 0,
      limit: 500,
      search: 'x'.repeat(121),
      category: 'pizza',
      sortBy: 'password',
      sortOrder: 'up',
    });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'page' },
        { field: 'limit' },
        { field: 'search' },
        { field: 'category' },
        { field: 'sortBy', message: 'O valor deve ser um de: name, price, createdAt' },
        { field: 'sortOrder', message: 'O valor deve ser um de: asc, desc' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });
});
