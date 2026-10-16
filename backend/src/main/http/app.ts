import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import { DomainError } from '../../shared-kernel/domain';
import {
  errorToHttp,
  MalformedRequestError,
  RateLimitExceededError,
  RouteNotFoundError,
  type Authenticator,
  type Route,
} from '../../shared-kernel/presentation';
import { registerRoutes } from '../../shared-kernel/presentation/http/fastify/register-routes';

export type AppOptions = {
  readonly routes: readonly Route[];
  readonly authenticator: Authenticator;
  /** Verifica dependências externas (ex.: banco) para o health check. */
  readonly healthCheck: () => Promise<void>;
  /** Padrão do enunciado: 100 requisições por minuto por IP. */
  readonly rateLimit?: { readonly max: number; readonly timeWindowMs: number };
  readonly logger?: boolean;
};

const DEFAULT_RATE_LIMIT = { max: 100, timeWindowMs: 60_000 };

/** Monta a API HTTP. Não abre porta: o servidor (ou os testes) decide. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error, request, reply) => {
    const response = errorToHttp(toDomainError(error));
    if (response.status >= 500) request.log.error({ err: error }, 'Erro não tratado');
    return reply.status(response.status).send(response.body);
  });

  app.setNotFoundHandler((request, reply) => {
    const response = errorToHttp(new RouteNotFoundError(request.method, request.url));
    return reply.status(response.status).send(response.body);
  });

  const limit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  await app.register(rateLimit, {
    max: limit.max,
    timeWindow: limit.timeWindowMs,
    errorResponseBuilder: (_request, context) =>
      new RateLimitExceededError(Math.ceil(context.ttl / 1000)),
  });

  app.get('/api/health', async (_request, reply) => {
    try {
      await options.healthCheck();
      return reply.send({ status: 'ok', database: 'up' });
    } catch {
      return reply.status(503).send({ status: 'degraded', database: 'down' });
    }
  });

  registerRoutes(app, options.routes, options.authenticator);
  return app;
}

/**
 * Erros do próprio Fastify (JSON malformado, corpo grande demais, content-type
 * não suportado) chegam com status 4xx e viram erro de requisição; o resto
 * passa adiante para o mapeamento central.
 */
function toDomainError(error: unknown): unknown {
  if (error instanceof DomainError) return error;
  if (isClientFastifyError(error)) return new MalformedRequestError(error.message);
  return error;
}

function isClientFastifyError(error: unknown): error is FastifyError {
  if (!(error instanceof Error) || !('statusCode' in error)) return false;
  const { statusCode } = error as FastifyError;
  return statusCode !== undefined && statusCode >= 400 && statusCode < 500;
}
