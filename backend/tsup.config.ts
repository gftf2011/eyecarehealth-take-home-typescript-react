import { defineConfig } from 'tsup';

/**
 * Build de produção: um bundle ESM por entrypoint. As dependências do
 * package.json ficam externas (resolvidas de node_modules em runtime).
 */
export default defineConfig({
  entry: {
    server: 'src/main/server.ts',
    'outbox-relay': 'src/main/outbox-relay.ts',
    'outbox-redrive': 'src/main/outbox-redrive.ts',
    'messaging-setup': 'src/main/messaging-setup.ts',
    'events-dead-letters': 'src/main/events-dead-letters.ts',
    'realtime-gateway': 'src/main/realtime-gateway.ts',
    migrate: 'src/main/database/migrate.ts',
    // Em contêiner, o arquivo vem de SEED_FILE (o caminho padrão é relativo a src/).
    seed: 'src/main/seed/seed.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
});
