import type { FastifyInstance } from 'fastify';

import { lazily, meter } from '../../shared-kernel/infra/observability/telemetry';

/** Limites pensados para uma API cujas listagens respondem em < 200 ms. */
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 200, 400, 800, 1_500, 3_000, 6_000];

const duration = lazily(() =>
  meter().createHistogram('fastmeals.http.server.request.duration', {
    description: 'Duração das requisições HTTP, por método, rota e status',
    unit: 'ms',
    advice: { explicitBucketBoundaries: DURATION_BUCKETS_MS },
  }),
);

/**
 * Mede cada resposta pela **rota** (`/api/orders/:id`, não o id), para a
 * cardinalidade não explodir. Cobre também 401, 429 e 503: login inválido,
 * rate limit e otimizador ocupado aparecem nos mesmos gráficos.
 */
export function registerHttpMetrics(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    duration().record(reply.elapsedTime, {
      'http.request.method': request.method,
      'http.route': request.routeOptions.url ?? 'unmatched',
      'http.response.status_code': reply.statusCode,
    });
  });
}
