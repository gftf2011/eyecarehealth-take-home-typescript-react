import { sql } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import {
  ProductCategory,
  ProductName,
  ProductPrice,
  type Product,
  type ProductListCriteria,
} from '../../../domain';
import { buildProduct, LATER } from '../../../domain/product/testing/product.fixture';
import type { CatalogDatabase } from '../schema/catalog-database';
import { KyselyCatalogUnitOfWork } from '../unit-of-work/kysely-catalog-unit-of-work';

const db = connectToTestDatabase<CatalogDatabase>();
const unitOfWork = new KyselyCatalogUnitOfWork(db);

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

async function save(...products: Product[]): Promise<void> {
  await unitOfWork.transaction(async ({ products: repository }) => {
    for (const item of products) await repository.save(item);
  });
}

const baseCriteria: ProductListCriteria = {
  offset: 0,
  limit: 20,
  search: null,
  category: null,
  isAvailable: null,
  sort: { field: 'createdAt', direction: 'desc' },
  visibility: 'backoffice',
};

async function listNames(overrides: Partial<ProductListCriteria> = {}): Promise<string[]> {
  const { items } = await unitOfWork.transaction(({ products }) =>
    products.list({ ...baseCriteria, ...overrides }),
  );
  return items.map((item) => item.name.value);
}

describe('KyselyProductRepository', () => {
  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('save / findById', () => {
    it('persiste e reidrata o agregado sem perda (preço exato, datas, imagem)', async () => {
      const burger = buildProduct();
      await save(burger);

      const found = await unitOfWork.transaction(({ products }) => products.findById(burger.id));

      expect(found?.snapshot()).toEqual(burger.snapshot());
      expect(found?.price.amount.cents).toBe(3290);
    });

    it('guarda o preço como numeric exato', async () => {
      await save(product('Água', 0.1, 'drink', '2025-01-01T00:00:00Z'));

      const { rows } = await sql<{ price: string }>`SELECT price FROM products`.execute(db);
      expect(rows[0]?.price).toBe('0.10');
    });

    it('atualiza com upsert preservando created_at', async () => {
      const burger = buildProduct();
      await save(burger);

      burger.updateDetails({ name: ProductName.create('X-Burger Duplo'), imageUrl: null }, LATER);
      burger.makeUnavailable(LATER);
      await save(burger);

      const found = await unitOfWork.transaction(({ products }) => products.findById(burger.id));
      expect(found?.name.value).toBe('X-Burger Duplo');
      expect(found?.imageUrl).toBeNull();
      expect(found?.isAvailable).toBe(false);
      expect(found?.createdAt).toEqual(burger.createdAt);
      expect(found?.updatedAt).toEqual(LATER);
    });

    it('produto removido não é encontrado, mas a linha continua no banco', async () => {
      const burger = buildProduct();
      burger.remove({ hasActiveOrders: false, now: LATER });
      await save(burger);

      expect(await unitOfWork.transaction(({ products }) => products.findById(burger.id))).toBeNull();
      const { rows } = await sql<{ total: string }>`SELECT count(*) AS total FROM products`.execute(db);
      expect(rows[0]?.total).toBe('1');
    });

    it('grava os eventos do agregado no outbox, em JSON', async () => {
      const burger = buildProduct();
      burger.updateDetails({ price: ProductPrice.fromDecimal(35) }, LATER);
      await save(burger);

      const events = await db
        .selectFrom('outbox_events')
        .select(['event_name', 'aggregate_id', 'payload', 'published_at'])
        .orderBy('event_name')
        .execute();

      expect(events.map((event) => event.event_name)).toEqual([
        'catalog.product.price-changed',
        'catalog.product.updated',
      ]);
      expect(events[0]).toMatchObject({
        aggregate_id: burger.id.value,
        payload: { previousPriceCents: 3290, newPriceCents: 3500 },
        published_at: null,
      });
    });
  });

  describe('restrições do banco', () => {
    it('rejeita preço não positivo mesmo fora da aplicação', async () => {
      await save(buildProduct());

      await expect(sql`UPDATE products SET price = 0`.execute(db)).rejects.toThrow(/check/i);
    });

    it('o trigger atualiza updated_at quando um UPDATE não o informa', async () => {
      const burger = buildProduct();
      await save(burger);

      await sql`UPDATE products SET is_available = false`.execute(db);

      const row = await db.selectFrom('products').select('updated_at').executeTakeFirstOrThrow();
      expect(row.updated_at.getTime()).toBeGreaterThan(burger.updatedAt.getTime());
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const removed = product('Batata Frita', 15, 'side', '2025-01-05T10:00:00Z');
      removed.remove({ hasActiveOrders: false, now: LATER });

      await save(
        product('X-Burger Especial', 32.9, 'meal', '2025-01-01T10:00:00Z'),
        product('Suco de Laranja', 12.5, 'drink', '2025-01-02T10:00:00Z'),
        product('Burger Vegano', 29.9, 'meal', '2025-01-03T10:00:00Z'),
        product('Pudim de Leite', 14, 'dessert', '2025-01-04T10:00:00Z', false),
        product('Combo 100% Burger', 45, 'meal', '2024-12-31T10:00:00Z'),
        removed,
      );
    });

    it('ordena por data de criação desc e nunca traz removidos', async () => {
      expect(await listNames()).toEqual([
        'Pudim de Leite',
        'Burger Vegano',
        'Suco de Laranja',
        'X-Burger Especial',
        'Combo 100% Burger',
      ]);
    });

    it('busca por trecho do nome sem diferenciar maiúsculas', async () => {
      expect(await listNames({ search: 'BURGER', sort: { field: 'name', direction: 'asc' } })).toEqual([
        'Burger Vegano',
        'Combo 100% Burger',
        'X-Burger Especial',
      ]);
    });

    it('trata % e _ da busca como texto literal', async () => {
      expect(await listNames({ search: '100%' })).toEqual(['Combo 100% Burger']);
      expect(await listNames({ search: '%' })).toEqual(['Combo 100% Burger']);
      expect(await listNames({ search: '_' })).toEqual([]);
    });

    it('filtra por categoria e disponibilidade', async () => {
      expect(await listNames({ category: 'drink' })).toEqual(['Suco de Laranja']);
      expect(await listNames({ isAvailable: false })).toEqual(['Pudim de Leite']);
    });

    it('a visão pública esconde os indisponíveis', async () => {
      expect(await listNames({ visibility: 'public' })).not.toContain('Pudim de Leite');
    });

    it('ordena por preço numericamente, não como texto', async () => {
      expect(await listNames({ sort: { field: 'price', direction: 'asc' } })).toEqual([
        'Suco de Laranja',
        'Pudim de Leite',
        'Burger Vegano',
        'X-Burger Especial',
        'Combo 100% Burger',
      ]);
    });

    it('pagina com offset/limit e devolve o total geral', async () => {
      const { items, total } = await unitOfWork.transaction(({ products }) =>
        products.list({ ...baseCriteria, offset: 2, limit: 2, sort: { field: 'name', direction: 'asc' } }),
      );

      expect(items.map((item) => item.name.value)).toEqual(['Pudim de Leite', 'Suco de Laranja']);
      expect(total).toBe(5);
    });
  });
});
