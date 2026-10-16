import type { FastifyInstance } from 'fastify';

import { authorize } from '../../auth/authorize';
import type { Authenticator } from '../../auth/authenticator';
import type { Route } from '../route';

/**
 * Adapter Fastify → Route: único ponto que conhece o framework. Autentica,
 * autoriza, delega ao controller e devolve status e corpo. Erros seguem para
 * o error handler central.
 */
export function registerRoutes(
  app: FastifyInstance,
  routes: readonly Route[],
  authenticator: Authenticator,
): void {
  for (const route of routes) {
    app.route({
      method: route.method,
      url: route.url,
      handler: async (request, reply) => {
        const user = await authorize(authenticator, request.headers.authorization, route.permission);
        const response = await route.controller.handle({
          params: request.params,
          query: request.query,
          body: request.body,
          user,
        });
        return reply.status(response.status).send(response.body);
      },
    });
  }
}
