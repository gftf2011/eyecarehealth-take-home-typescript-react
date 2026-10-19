import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createPostgresPool } from '../../../../shared-kernel/infra/database/postgres';
import { resetDatabase } from '../../../../shared-kernel/infra/database/testing/test-database';
import { InMemoryEventMediator } from '../../../../shared-kernel/infra/events/in-memory-event-mediator';
import type { Keyset } from '../../../../shared-kernel/domain';
import type { ProductListCriteria } from '../../../domain';
import type { CatalogDatabase } from '../schema/catalog-database';
import { KyselyCatalogUnitOfWork } from '../unit-of-work/kysely-catalog-unit-of-work';

/** Requisito não funcional do enunciado. */
const MAX_LIST_RESPONSE_MS = 200;

const TOTAL_ROWS = 10_200;
/** n % 50 = 0 → removido (soft delete): 204 linhas. */
const VISIBLE_ROWS = 9_996;
const PAGE = 20;

/** Guarda o SQL de cada consulta executada, para rodar o EXPLAIN do SQL real. */
const executedQueries: CompiledQuery[] = [];
const db = new Kysely<CatalogDatabase>({
  dialect: new PostgresDialect({ pool: createPostgresPool(inject('databaseUrl')) }),
  log: (event) => {
    if (event.level === 'query') executedQueries.push(event.query);
  },
});
const unitOfWork = new KyselyCatalogUnitOfWork(db, new InMemoryEventMediator());

const baseCriteria: ProductListCriteria = {
  limit: 20,
  keyset: null,
  search: null,
  category: null,
  isAvailable: null,
  sort: { field: 'createdAt', direction: 'desc' },
  visibility: 'backoffice',
};

type Measured = {
  elapsedMs: number;
  count: number;
  /** Plano escolhido pelo PostgreSQL para a consulta de página (EXPLAIN JSON). */
  plan: string;
};

/** Executa a listagem pelo repositório, mede o tempo e devolve o plano da consulta de página. */
async function measureList(overrides: Partial<ProductListCriteria>): Promise<Measured> {
  const criteria = { ...baseCriteria, ...overrides };
  executedQueries.length = 0;

  const startedAt = performance.now();
  const { items } = await unitOfWork.transaction(({ products }) => products.list(criteria));
  const elapsedMs = performance.now() - startedAt;

  const pageQuery = executedQueries.find((query) => /\blimit\b/i.test(query.sql));
  if (pageQuery === undefined) throw new Error('Consulta paginada não encontrada no log');

  const { rows } = await db.executeQuery<{ 'QUERY PLAN': unknown }>(
    CompiledQuery.raw(`EXPLAIN (FORMAT JSON) ${pageQuery.sql}`, [...pageQuery.parameters]),
  );
  return { elapsedMs, count: items.length, plan: JSON.stringify(rows[0]?.['QUERY PLAN']) };
}

describe(`KyselyProductRepository.list com ${TOTAL_ROWS} produtos`, () => {
  let deepKeyset: Keyset;

  beforeAll(async () => {
    await resetDatabase(db);
    await sql`
      INSERT INTO products (
        id, name, description, price, category, image_url, is_available,
        preparation_time, created_at, updated_at, deleted_at
      )
      SELECT
        gen_random_uuid(),
        -- 51 "Especial Trufado": alvo da busca seletiva.
        CASE WHEN n % 200 = 7 THEN 'Especial Trufado ' || n ELSE 'Produto ' || n END,
        'Descrição do produto número ' || n,
        ((n % 9000) + 100) / 100.0,
        (ARRAY['meal', 'drink', 'dessert', 'side'])[n % 4 + 1],
        NULL,
        n % 10 <> 0,
        n % 120 + 1,
        timestamptz '2025-01-01' + n * interval '1 minute',
        timestamptz '2025-01-01' + n * interval '1 minute',
        CASE WHEN n % 50 = 0 THEN now() END
      FROM generate_series(1, ${TOTAL_ROWS}) AS n
    `.execute(db);
    // Faz o que o autovacuum faria em produção: consolida a pending list do
    // índice GIN (trigram) e atualiza as estatísticas. Sem isso, logo após uma
    // carga em massa, o planner estima o GIN como caro e não o utiliza.
    await sql`VACUUM ANALYZE products`.execute(db);

    // Aquece conexão e cache de planos: a primeira consulta não representa o regime.
    await unitOfWork.transaction(({ products }) => products.list(baseCriteria));

    // O cursor da última página (a que o OFFSET 9.980 pagaria lendo tudo antes dela).
    const deep = await sql<{ created_at: Date; id: string }>`
      SELECT created_at, id FROM products WHERE deleted_at IS NULL
      ORDER BY created_at DESC, id DESC OFFSET ${VISIBLE_ROWS - PAGE - 1} LIMIT 1
    `.execute(db);
    const row = deep.rows[0];
    if (row === undefined) throw new Error('Linha do cursor profundo não encontrada');
    deepKeyset = { direction: 'after', value: row.created_at.getTime(), id: row.id };
  });

  afterAll(async () => {
    await resetDatabase(db);
    await db.destroy();
  });

  it.each([
    ['mais recentes primeiro (padrão)', {}, 'idx_products_created_at'],
    ['busca parcial por nome', { search: 'trufado' }, 'idx_products_name_trgm'],
    ['ordenado por preço', { sort: { field: 'price', direction: 'asc' } }, 'idx_products_price'],
    ['ordenado por nome', { sort: { field: 'name', direction: 'asc' } }, 'idx_products_name'],
  ] satisfies [string, Partial<ProductListCriteria>, string][])(
    '%s: responde em < 200ms usando o índice esperado',
    async (_scenario, criteria, expectedIndex) => {
      const { elapsedMs, count, plan } = await measureList(criteria);

      expect(count).toBe(PAGE);
      expect(plan).toContain(`"Index Name":"${expectedIndex}"`);
      expect(plan).not.toContain('Seq Scan');
      expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
    },
  );

  it.each([
    ['categoria + disponibilidade', { category: 'meal', isAvailable: true }],
    ['visão pública', { visibility: 'public' }],
    ['busca sem resultados', { search: 'inexistente' }],
  ] satisfies [string, Partial<ProductListCriteria>][])(
    '%s: responde em < 200ms',
    async (_scenario, criteria) => {
      const { elapsedMs } = await measureList(criteria);
      expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
    },
  );

  it('última página por cursor: continua pelo índice, sem ler as linhas anteriores', async () => {
    const { elapsedMs, count, plan } = await measureList({ keyset: deepKeyset });

    expect(count).toBe(PAGE);
    expect(plan).toContain('"Index Name":"idx_products_created_at"');
    expect(plan).not.toContain('Seq Scan');
    expect(plan).not.toContain('"Node Type":"Sort"');
    expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
  });
});
