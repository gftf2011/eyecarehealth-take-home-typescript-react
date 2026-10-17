/**
 * CLI do seed (`npm run seed`, dentro de `backend/`).
 *   npm run seed              aplica as migrations e popula, se o banco estiver vazio
 *   npm run seed -- --reset   apaga os dados da aplicação e popula de novo (fora de produção)
 *
 * Variáveis: DATABASE_URL (obrigatória), BCRYPT_COST (padrão 10) e SEED_FILE
 * (padrão: `seed/data.json` na raiz do repositório).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { createPostgresPool } from '../../shared-kernel/infra/database/postgres';
import { parseSeedData } from './seed-data';
import { seedDatabase } from './seed-database';

const DEFAULT_SEED_FILE = fileURLToPath(new URL('../../../../seed/data.json', import.meta.url));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL não definida'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(10),
  SEED_FILE: z.string().min(1).default(DEFAULT_SEED_FILE),
});

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const reset = process.argv.slice(2).includes('--reset');
  if (reset && env.NODE_ENV === 'production') {
    throw new Error('--reset apaga todos os dados e não é permitido com NODE_ENV=production');
  }

  const data = parseSeedData(JSON.parse(await readFile(env.SEED_FILE, 'utf8')));
  const pool = createPostgresPool(env.DATABASE_URL);
  try {
    const result = await seedDatabase({ pool, data, now: new Date(), reset, bcryptCost: env.BCRYPT_COST });
    if (result.status === 'skipped') {
      console.info('O banco já tem dados: nada foi alterado. Use `npm run seed -- --reset` para recriar.');
      return;
    }
    const { users, products, deliveryPersons, orders } = result.summary;
    console.info(
      `Seed concluído: ${users} usuários, ${products} produtos, ${deliveryPersons} entregadores, ${orders} pedidos.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
