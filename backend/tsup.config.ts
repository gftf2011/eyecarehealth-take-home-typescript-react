import { defineConfig } from 'tsup';

/**
 * Build de produção: um bundle ESM por entrypoint. As dependências do
 * package.json ficam externas (resolvidas de node_modules em runtime).
 */
export default defineConfig({
  entry: {
    // Pré-carregado com `node --import` antes dos processos (OpenTelemetry).
    instrumentation: 'src/main/telemetry/instrumentation.ts',
    server: 'src/main/server.ts',
    'outbox-relay': 'src/main/outbox-relay.ts',
    'outbox-redrive': 'src/main/outbox-redrive.ts',
    'messaging-setup': 'src/main/messaging-setup.ts',
    'events-dead-letters': 'src/main/events-dead-letters.ts',
    // Worker do otimizador: carregado pelo server.js a partir do mesmo diretório.
    'dispatch-planner.worker': 'src/delivery/infra/dispatch/dispatch-planner.worker.ts',
    'realtime-gateway': 'src/main/realtime-gateway.ts',
    'event-consumers': 'src/main/event-consumers.ts',
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
