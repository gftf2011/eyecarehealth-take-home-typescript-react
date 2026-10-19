/**
 * OpenTelemetry dos três processos (API, outbox relay e gateway): traces,
 * métricas e logs exportados por OTLP. Pré-carregado antes da aplicação,
 *
 *   node --import ./dist/instrumentation.js dist/server.js
 *
 * para instrumentar `http`, Fastify, `pg`, `ioredis` e pino antes de serem
 * carregados. Configuração pelas variáveis padrão do OTel:
 * `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
 * `OTEL_METRIC_EXPORT_INTERVAL` e `OTEL_SDK_DISABLED=true` para desligar.
 *
 * Sem ruído de fundo: o relay consulta o banco a cada 500 ms e o gateway faz
 * long polling na fila; banco, Redis e chamadas HTTP de saída só geram spans
 * dentro de um trace que já existe, e health checks e o upgrade do WebSocket
 * não abrem traces.
 */
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

/** Rotas que nunca abrem trace: health checks (a cada poucos segundos) e o upgrade do WebSocket. */
const UNTRACED_PATHS = ['/health', '/api/health', '/realtime'];

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 15_000;

function isUntraced(path: string | undefined): boolean {
  return path !== undefined && UNTRACED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}?`));
}

function start(): void {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'deployment.environment.name': process.env['NODE_ENV'] ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: Number(process.env['OTEL_METRIC_EXPORT_INTERVAL'] ?? DEFAULT_METRIC_EXPORT_INTERVAL_MS),
      }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => isUntraced(request.url),
        // Saídas (SNS, SQS) só dentro de um trace: o long polling da fila não vira trace.
        requireParentforOutgoingSpans: true,
      }),
      new FastifyOtelInstrumentation({
        registerOnInitialization: true,
        ignorePaths: (route) => isUntraced(route.url),
      }),
      new PgInstrumentation({ requireParentSpan: true }),
      new IORedisInstrumentation({ requireParentSpan: true }),
      // Logs do pino com trace_id/span_id e enviados também por OTLP (além do stdout).
      new PinoInstrumentation(),
    ],
  });
  sdk.start();

  // Envia o que ficou no buffer antes de o processo sair.
  const shutdown = (): void => {
    void sdk.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (process.env['OTEL_SDK_DISABLED'] !== 'true') start();
