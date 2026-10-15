import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application/index';
import { BURGER_DTO, productDto } from '../../testing/product-dto.fixture';
import { StubProductQuery } from '../../testing/stub-product.query';
import { ListProductsUseCase } from './list-products.usecase';

describe('ListProductsUseCase', () => {
  let query: StubProductQuery;
  let listProducts: ListProductsUseCase;

  beforeEach(() => {
    query = new StubProductQuery();
    listProducts = new ListProductsUseCase(query);
  });

  it('aplica os padrões: página 1, 20 itens, mais recentes primeiro, visão do backoffice', async () => {
    await listProducts.execute({});

    const [criteria] = query.listCalls;
    expect(criteria?.page.page).toBe(1);
    expect(criteria?.page.limit).toBe(20);
    expect(criteria).toMatchObject({
      search: null,
      category: null,
      isAvailable: null,
      sort: { field: 'createdAt', direction: 'desc' },
      visibility: 'backoffice',
    });
  });

  it('repassa busca, filtros, ordenação e visibilidade já validados', async () => {
    await listProducts.execute({
      page: 2,
      limit: 10,
      search: '  burger ',
      category: 'meal',
      isAvailable: false,
      sortBy: 'price',
      sortOrder: 'ASC',
      visibility: 'public',
    });

    const [criteria] = query.listCalls;
    expect(criteria?.page.offset).toBe(10);
    expect(criteria).toMatchObject({
      search: 'burger',
      category: 'meal',
      isAvailable: false,
      sort: { field: 'price', direction: 'asc' },
      visibility: 'public',
    });
  });

  it('trata busca em branco como ausente', async () => {
    await listProducts.execute({ search: '   ' });
    expect(query.listCalls[0]?.search).toBeNull();
  });

  it('monta a página no formato { data, pagination }', async () => {
    const juice = productDto({ id: '7a1c9e2b-4d3f-4a6b-8c9d-1e2f3a4b5c6d', name: 'Suco' });
    query.listResult = { items: [BURGER_DTO, juice], total: 47 };

    const page = await listProducts.execute({ page: 1, limit: 20 });

    expect(page.data).toEqual([BURGER_DTO, juice]);
    expect(page.pagination).toEqual({ page: 1, limit: 20, total: 47, totalPages: 3 });
  });

  it('agrupa todos os parâmetros inválidos e não consulta a base', async () => {
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
    expect(query.listCalls).toHaveLength(0);
  });
});
