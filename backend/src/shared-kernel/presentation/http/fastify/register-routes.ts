// Carrega os tipos de request.cookies / reply.setCookie.
import type {} from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { authorize } from '../../auth/authorize';
import type { Authenticator } from '../../auth/authenticator';
import type { ResponseCookie } from '../http';
import type { Route } from '../route';

/**
 * Adapter Fastify → Route: único ponto que conhece o framework. Autentica,
 * autoriza, delega ao controller e devolve status, cookies e corpo. Erros
 * seguem para o error handler central. Exige o plugin `@fastify/cookie`.
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
          cookies: request.cookies,
          ip: request.ip,
          user,
        });
        for (const cookie of response.cookies ?? []) applyCookie(reply, cookie);
        return reply.status(response.status).send(response.body);
      },
    });
  }
}

function applyCookie(reply: FastifyReply, cookie: ResponseCookie): void {
  const options = {
    httpOnly: cookie.options.httpOnly,
    secure: cookie.options.secure,
    sameSite: cookie.options.sameSite,
    path: cookie.options.path,
  };
  if (cookie.value === null) reply.clearCookie(cookie.name, options);
  else reply.setCookie(cookie.name, cookie.value, { ...options, expires: cookie.options.expires });
}
