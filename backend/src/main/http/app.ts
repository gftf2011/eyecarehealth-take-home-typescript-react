import cookie from '@fastify/cookie';
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
import type { RateLimitCounter } from '../../shared-kernel/application';
import { toRateLimitStore } from '../../shared-kernel/presentation/http/fastify/rate-limit-counter.store';
import { registerRoutes } from '../../shared-kernel/presentation/http/fastify/register-routes';

/** Verificações do health check por dependência (ex.: `database`, `redis`). */
export type HealthChecks = Readonly<Record<string, () => Promise<void>>>;

export type RateLimitOptions = {
  /** Enunciado: 100 requisições por minuto por IP. */
  readonly max: number;
  readonly timeWindowMs: number;
  /**
   * Contador compartilhado entre réplicas e preservado entre reinícios
   * (Redis em produção). Obrigatório: não há contagem em memória do processo.
   */
  readonly counter: RateLimitCounter;
};

export type AppOptions = {
  readonly routes: readonly Route[];
  readonly authenticator: Authenticator;
  readonly healthChecks: HealthChecks;
  readonly rateLimit: RateLimitOptions;
  /**
   * Proxies confiáveis (IPs/CIDRs ou número de saltos) para usar o IP real do
   * cliente de `X-Forwarded-For` no rate limit. Padrão: não confiar.
   */
  readonly trustProxy?: false | number | readonly string[];
  readonly logger?: boolean;
};

const HEALTH_CHECK_TIMEOUT_MS = 1_000;

/** Monta a API HTTP. Não abre porta: o servidor (ou os testes) decide. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: toFastifyTrustProxy(options.trustProxy ?? false),
  });

  app.setErrorHandler((error, request, reply) => {
    const response = errorToHttp(toDomainError(error));
    if (response.status >= 500) request.log.error({ err: error }, 'Erro não tratado');
    return reply.status(response.status).send(response.body);
  });

  app.setNotFoundHandler((request, reply) => {
    const response = errorToHttp(new RouteNotFoundError(request.method, request.url));
    return reply.status(response.status).send(response.body);
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: options.rateLimit.max,
    timeWindow: options.rateLimit.timeWindowMs,
    // A chave padrão é `request.ip`, que respeita o `trustProxy`.
    store: toRateLimitStore(options.rateLimit.counter),
    // Redis fora do ar não derruba a API: deixa passar (fail-open). A queda é
    // registrada pela própria conexão e aparece no health check.
    skipOnError: true,
    errorResponseBuilder: (_request, context) =>
      new RateLimitExceededError(Math.ceil(context.ttl / 1000)),
  });

  app.get('/api/health', async (_request, reply) => {
    const results = await Promise.all(
      Object.entries(options.healthChecks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), HEALTH_CHECK_TIMEOUT_MS);
          return [name, 'up'] as const;
        } catch {
          return [name, 'down'] as const;
        }
      }),
    );
    const healthy = results.every(([, state]) => state === 'up');
    return reply
      .status(healthy ? 200 : 503)
      .send({ status: healthy ? 'ok' : 'degraded', checks: Object.fromEntries(results) });
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

type FastifyTrustProxy = boolean | string[] | ((address: string, hop: number) => boolean);

/** Número de saltos vira "confiar nos `n` proxies mais próximos". */
function toFastifyTrustProxy(trustProxy: false | number | readonly string[]): FastifyTrustProxy {
  if (trustProxy === false) return false;
  if (typeof trustProxy === 'number') return (_address, hop) => hop < trustProxy;
  return [...trustProxy];
}

async function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isClientFastifyError(error: unknown): error is FastifyError {
  if (!(error instanceof Error) || !('statusCode' in error)) return false;
  const { statusCode } = error as FastifyError;
  return statusCode !== undefined && statusCode >= 400 && statusCode < 500;
}
