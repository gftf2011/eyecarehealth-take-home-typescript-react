import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type DataPoint,
} from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor, type ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Traces em memória para os testes: provedor, propagação W3C e contexto por
 * AsyncLocalStorage, como o SDK faz em produção (sem exportar nada).
 */
export function installInMemoryTracing(): { spans: () => ReadableSpan[]; reset: () => void } {
  const exporter = new InMemorySpanExporter();
  trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }));
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  return { spans: () => exporter.getFinishedSpans(), reset: () => exporter.reset() };
}

export type MetricPoint = { readonly attributes: Readonly<Record<string, unknown>>; readonly value: unknown };

/** Métricas em memória: `collect` lê o valor acumulado de cada série de uma métrica. */
export function installInMemoryMetrics(): { points: (name: string) => Promise<MetricPoint[]> } {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 });
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  return {
    async points(name) {
      await reader.forceFlush();
      const latest = exporter.getMetrics().at(-1);
      const metric = latest?.scopeMetrics.flatMap((scope) => scope.metrics).find((candidate) => candidate.descriptor.name === name);
      return (metric?.dataPoints ?? []).map((point: DataPoint<unknown>) => ({ attributes: point.attributes, value: point.value }));
    },
  };
}
