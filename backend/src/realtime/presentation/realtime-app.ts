import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

import type { Clock } from '../../shared-kernel/application';
import type { Permission } from '../../shared-kernel/domain';
import type { RealtimeAuthenticator } from '../application/ports/realtime-authenticator';
import { RealtimeHub } from '../application/realtime-hub';
import { CLOSE_CODES } from '../application/realtime-protocol';
import { RealtimeSession } from '../application/realtime-session';
import { rawDataToText } from './raw-data-to-text';
import { WebSocketConnection } from './websocket-connection';

export const REALTIME_PATH = '/realtime';

export type RealtimeAppOptions = {
  readonly hub: RealtimeHub;
  readonly authenticator: RealtimeAuthenticator;
  readonly clock: Clock;
  /** Basta uma destas para assinar os eventos (o painel de pedidos ou o entregador). */
  readonly requiredPermissions: readonly Permission[];
  /**
   * Origens de navegador aceitas no handshake (proteção contra Cross-Site
   * WebSocket Hijacking). Clientes sem `Origin` (não navegadores) passam e
   * ainda precisam autenticar.
   */
  readonly allowedOrigins: readonly string[];
  /** Verificações do health check (ex.: assinatura do Redis). */
  readonly healthChecks: Readonly<Record<string, () => boolean>>;
  readonly authTimeoutMs?: number;
  readonly heartbeatIntervalMs?: number;
  readonly maxBufferedBytes?: number;
  /** O cliente só envia a mensagem de auth: mensagens grandes são abuso. */
  readonly maxPayloadBytes?: number;
  readonly logger?: boolean;
};

/**
 * Gateway de tempo real: HTTP só para `GET /health`; o resto é o WebSocket
 * em `GET /realtime`. Não abre porta: o entrypoint (ou os testes) decide.
 */
export async function buildRealtimeApp(options: RealtimeAppOptions): Promise<FastifyInstance> {
  const {
    hub,
    authenticator,
    clock,
    requiredPermissions,
    authTimeoutMs = 5_000,
    heartbeatIntervalMs = 30_000,
    maxBufferedBytes = 1024 * 1024,
    maxPayloadBytes = 4 * 1024,
  } = options;
  const allowedOrigins = new Set(options.allowedOrigins);
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(websocket, {
    options: { maxPayload: maxPayloadBytes },
    // Substitui o encerramento padrão do plugin (que fecha os sockets sem
    // código): todo cliente recebe 1012 e sabe que deve reconectar.
    preClose: async () => {
      clearInterval(heartbeat);
      hub.shutdownAll();
      for (const client of app.websocketServer.clients) {
        client.close(CLOSE_CODES.serviceRestart, 'Servidor reiniciando');
      }
      await new Promise<void>((resolve) => app.websocketServer.close(() => resolve()));
    },
  });

  /** Conexões vivas: respondeu ao último ping. */
  const alive = new WeakMap<WebSocket, boolean>();

  app.get('/health', async (_request, reply) => {
    const checks = Object.fromEntries(
      Object.entries(options.healthChecks).map(([name, check]) => [name, check() ? 'up' : 'down']),
    );
    const healthy = Object.values(checks).every((state) => state === 'up');
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
      connections: { open: hub.connectionCount, authenticated: hub.authenticatedCount },
    });
  });

  app.get(
    REALTIME_PATH,
    {
      websocket: true,
      // Antes do upgrade: origem de navegador não autorizada nem chega a abrir o socket.
      preValidation: async (request, reply) => {
        const origin = request.headers.origin;
        if (origin !== undefined && !allowedOrigins.has(origin)) {
          await reply.code(403).send({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Origem não autorizada' } });
        }
      },
    },
    (socket) => {
      const session = new RealtimeSession(new WebSocketConnection(socket, maxBufferedBytes), authenticator, {
        authTimeoutMs,
        requiredPermissions,
        clock,
      });
      hub.add(session);
      alive.set(socket, true);
      session.start();

      socket.on('pong', () => alive.set(socket, true));
      socket.on('message', (data, isBinary) => {
        // O protocolo é texto (JSON); binário é mensagem inválida.
        void session.receive(isBinary ? '' : rawDataToText(data)).catch((error: unknown) => {
          app.log.error({ err: error }, 'Erro ao tratar mensagem do cliente');
          socket.close(CLOSE_CODES.internalError, 'Erro interno');
        });
      });
      socket.on('close', () => {
        session.end();
        hub.remove(session);
      });
    },
  );

  // Heartbeat: quem não respondeu ao ping anterior é derrubado (conexão morta,
  // ex.: rede caiu sem FIN). Libera memória e o slot da sessão.
  const heartbeat = setInterval(() => {
    for (const client of app.websocketServer.clients) {
      if (alive.get(client) === false) {
        client.terminate();
        continue;
      }
      alive.set(client, false);
      client.ping();
    }
  }, heartbeatIntervalMs);
  heartbeat.unref();

  return app;
}
