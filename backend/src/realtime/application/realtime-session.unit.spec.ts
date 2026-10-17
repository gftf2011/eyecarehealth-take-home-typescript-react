import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidTokenError, TokenExpiredError, type Clock } from '../../shared-kernel/application';
import { PERMISSIONS } from '../../shared-kernel/domain';
import type { TokenAuthenticator, TokenPrincipal } from '../../shared-kernel/presentation';
import { RealtimeHub } from './realtime-hub';
import type { RealtimeConnection, RealtimeEvent, ServerMessage } from './realtime-protocol';
import { RealtimeSession } from './realtime-session';

const START = new Date('2025-01-20T12:00:00Z').getTime();
const MINUTE = 60_000;
const clock: Clock = { now: () => new Date(Date.now()) };

class FakeConnection implements RealtimeConnection {
  readonly sent: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;

  send(message: ServerMessage): void {
    this.sent.push(message);
  }

  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }
}

/** Tokens de teste: `viewer`, `no-permission`, `boom`; o resto é inválido. */
class FakeAuthenticator implements TokenAuthenticator {
  expiresInMs = 15 * MINUTE;

  async authenticateToken(token: string): Promise<TokenPrincipal> {
    const expiresAt = new Date(Date.now() + this.expiresInMs);
    if (token === 'viewer') return { id: 'u1', role: 'viewer', permissions: ['orders:read'], expiresAt };
    if (token === 'admin') return { id: 'u2', role: 'admin', permissions: PERMISSIONS, expiresAt };
    if (token === 'no-permission') return { id: 'u3', role: 'other', permissions: [], expiresAt };
    if (token === 'expired') throw new TokenExpiredError();
    if (token === 'boom') throw new Error('falha inesperada');
    throw new InvalidTokenError();
  }
}

const event: RealtimeEvent = {
  id: 'e1',
  topic: 'ordering.order-updates',
  occurredAt: '2025-01-20T12:00:00.000Z',
  payload: { type: 'order.placed', orderId: 'o1' },
};

const auth = (accessToken: string): string => JSON.stringify({ type: 'auth', accessToken });

describe('RealtimeSession', () => {
  let connection: FakeConnection;
  let authenticator: FakeAuthenticator;
  let session: RealtimeSession;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    connection = new FakeConnection();
    authenticator = new FakeAuthenticator();
    session = new RealtimeSession(connection, authenticator, {
      authTimeoutMs: 5_000,
      requiredPermission: 'orders:read',
      clock,
    });
    session.start();
  });

  afterEach(() => {
    session.end();
    vi.useRealTimers();
  });

  it('autentica com a primeira mensagem, responde ready e passa a receber eventos', async () => {
    session.deliver(event);
    expect(connection.sent).toEqual([]);

    await session.receive(auth('viewer'));
    session.deliver(event);

    expect(connection.sent).toEqual([
      { type: 'ready', expiresAt: new Date(START + 15 * MINUTE).toISOString() },
      { type: 'event', ...event },
    ]);
    expect(session.principal?.id).toBe('u1');
    expect(connection.closed).toBeNull();
  });

  it('sem autenticação no prazo: fecha com 4401', async () => {
    await vi.advanceTimersByTimeAsync(4_999);
    expect(connection.closed).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(connection.closed).toEqual({ code: 4401, reason: 'Autenticação não recebida no prazo' });
  });

  it.each([
    ['inválido', 'garbage', 4401, new InvalidTokenError().message],
    ['expirado', 'expired', 4401, new TokenExpiredError().message],
    ['sem permissão', 'no-permission', 4403, 'Permissão insuficiente para este canal'],
    ['com erro inesperado', 'boom', 1011, 'Erro ao autenticar'],
  ])('token %s: fecha com %s', async (_label, token, code, reason) => {
    await session.receive(auth(token));

    expect(connection.closed).toEqual({ code, reason });
    session.deliver(event);
    expect(connection.sent).toEqual([]);
  });

  it.each(['não é json', '{"type":"subscribe"}', '{"type":"auth"}', '{"type":"auth","accessToken":""}'])(
    'mensagem fora do protocolo (%s): fecha com 4400',
    async (raw) => {
      await session.receive(raw);

      expect(connection.closed).toEqual({ code: 4400, reason: 'Mensagem fora do protocolo' });
    },
  );

  it('quando o token vence, fecha com 4401 e para de entregar', async () => {
    await session.receive(auth('viewer'));

    await vi.advanceTimersByTimeAsync(15 * MINUTE);
    session.deliver(event);

    expect(connection.closed).toEqual({ code: 4401, reason: 'Token expirado' });
    expect(connection.sent.filter((message) => message.type === 'event')).toHaveLength(0);
  });

  it('um novo auth com token renovado estende a sessão sem reconectar', async () => {
    await session.receive(auth('viewer'));
    await vi.advanceTimersByTimeAsync(14 * MINUTE);

    await session.receive(auth('viewer'));
    await vi.advanceTimersByTimeAsync(5 * MINUTE);

    expect(connection.closed).toBeNull();
    expect(connection.sent.filter((message) => message.type === 'ready')).toHaveLength(2);
  });

  it('depois de fechada, ignora mensagens e não fecha de novo', async () => {
    await session.receive('lixo');
    const firstClose = connection.closed;

    await session.receive(auth('viewer'));

    expect(connection.closed).toBe(firstClose);
    expect(connection.sent).toEqual([]);
  });
});

describe('RealtimeHub', () => {
  it('entrega só às sessões autenticadas e encerra todas com 1012', async () => {
    vi.useFakeTimers();
    const hub = new RealtimeHub();
    const authenticator = new FakeAuthenticator();
    const options = { authTimeoutMs: 5_000, requiredPermission: 'orders:read' as const, clock };
    const [readyConnection, pendingConnection] = [new FakeConnection(), new FakeConnection()];
    const ready = new RealtimeSession(readyConnection, authenticator, options);
    const pending = new RealtimeSession(pendingConnection, authenticator, options);
    hub.add(ready);
    hub.add(pending);
    await ready.receive(auth('admin'));

    hub.broadcast(event);
    hub.shutdownAll();

    expect(readyConnection.sent.map((message) => message.type)).toEqual(['ready', 'event']);
    expect(pendingConnection.sent).toEqual([]);
    expect(readyConnection.closed).toEqual({ code: 1012, reason: 'Servidor reiniciando' });
    expect(pendingConnection.closed?.code).toBe(1012);
    expect(hub.connectionCount).toBe(0);
    vi.useRealTimers();
  });

  it('conta conexões e autenticadas', async () => {
    const hub = new RealtimeHub();
    const session = new RealtimeSession(new FakeConnection(), new FakeAuthenticator(), {
      authTimeoutMs: 5_000,
      requiredPermission: 'orders:read',
      clock,
    });
    hub.add(session);
    expect([hub.connectionCount, hub.authenticatedCount]).toEqual([1, 0]);

    await session.receive(auth('viewer'));
    expect([hub.connectionCount, hub.authenticatedCount]).toEqual([1, 1]);

    hub.remove(session);
    session.end();
    expect(hub.connectionCount).toBe(0);
  });
});
