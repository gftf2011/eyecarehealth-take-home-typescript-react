import {
  context,
  metrics,
  propagation,
  ROOT_CONTEXT,
  trace,
  type Context,
  type Meter,
  type Tracer,
} from '@opentelemetry/api';

/**
 * Pontos de acesso ao OpenTelemetry para os adapters. Sem o SDK carregado
 * (testes, `OTEL_SDK_DISABLED`), a API devolve implementações vazias: medir e
 * rastrear viram no-ops, sem custo nem configuração.
 */
const SCOPE = 'fastmeals';

export function meter(): Meter {
  return metrics.getMeter(SCOPE);
}

export function tracer(): Tracer {
  return trace.getTracer(SCOPE);
}

/** Cabeçalhos W3C (`traceparent`, `tracestate`) que propagam um contexto de trace. */
export type TraceCarrier = Record<string, string>;

/** Contexto do trace ativo como cabeçalhos W3C; `null` fora de um trace. */
export function currentTraceCarrier(active: Context = context.active()): TraceCarrier | null {
  const carrier: TraceCarrier = {};
  propagation.inject(active, carrier);
  return Object.keys(carrier).length > 0 ? carrier : null;
}

/** Contexto de trace a partir de cabeçalhos W3C (sem cabeçalhos, um contexto vazio: trace novo). */
export function contextFromCarrier(carrier: Readonly<TraceCarrier> | null | undefined): Context {
  return carrier === null || carrier === undefined ? ROOT_CONTEXT : propagation.extract(ROOT_CONTEXT, carrier);
}

/**
 * Instrumentos criados no primeiro uso, não ao carregar o módulo: assim pegam
 * o provedor registrado pelo SDK (ou por um teste) antes da primeira medição.
 */
export function lazily<T>(create: () => T): () => T {
  let instance: T | undefined;
  return () => (instance ??= create());
}
