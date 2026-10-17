import { defineConfig } from 'tsup';

/**
 * Build de produção: um bundle ESM por entrypoint. As dependências do
 * package.json ficam externas (resolvidas de node_modules em runtime).
 */
export default defineConfig({
  entry: {
    server: 'src/main/server.ts',
    'outbox-relay': 'src/main/outbox-relay.ts',
    migrate: 'src/main/database/migrate.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
});
