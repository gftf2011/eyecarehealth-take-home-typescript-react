import { beforeEach, describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import { InMemoryLiveEventBus } from '../../../shared-kernel/infra';
import { CLOSE_CODES } from '../../domain';
import { FakeSocketFactory, FakeTokenSource, ManualScheduler } from '../testing/fakes';
import { LiveConnection } from './live-connection';

const TOPIC = 'ordering.order-updates';

function event(id: string) {
  return { type: 'event', id, topic: TOPIC, occurredAt: '2026-10-18T12:00:00.000Z', payload: { type: 'order.placed' } };
}

describe('LiveConnection', () => {
  let sockets: FakeSocketFactory;
  let tokens: FakeTokenSource;
  let scheduler: ManualScheduler;
  let bus: InMemoryLiveEventBus;
  let received: LiveEvent[];
  let resyncs: number;
  let connection: LiveConnection;

  beforeEach(async () => {
    sockets = new FakeSocketFactory();
    tokens = new FakeTokenSource();
    scheduler = new ManualScheduler();
    bus = new InMemoryLiveEventBus();
    received = [];
    resyncs = 0;
    bus.subscribe(TOPIC, (live) => received.push(live));
    bus.onResync(() => {
      resyncs += 1;
    });
    connection = new LiveConnection({ sockets, tokens, events: bus, scheduler, random: () => 0 });
    await connection.start();
  });

  it('conecta e se autentica pela primeira mensagem; "ready" deixa ao vivo', () => {
    expect(connection.status()).toBe('connecting');

    sockets.last.open();
    expect(sockets.last.authTokens).toEqual(['token-1']);

    sockets.last.ready();
    expect(connection.status()).toBe('live');
  });

  it('primeira conexão também pede para recarregar (a tela pode ter lido a API antes da assinatura)', () => {
    sockets.last.open();
    expect(resyncs).toBe(0);

    sockets.last.ready();

    expect(resyncs).toBe(1);
  });

  it('repassa os eventos ao canal e descarta repetidos', () => {
    sockets.last.open();
    sockets.last.ready();

    sockets.last.receive(event('evt-1'));
    sockets.last.receive(event('evt-1'));
    sockets.last.receive(event('evt-2'));

    expect(received.map((live) => live.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('ignora mensagens fora do protocolo sem derrubar a conexão', () => {
    sockets.last.open();
    sockets.last.ready();

    sockets.last.receive('não é json');
    sockets.last.receive({ type: 'desconhecido' });

    expect(connection.status()).toBe('live');
    expect(received).toHaveLength(0);
  });

  it('token renovado pelo Identity: reautentica na mesma conexão', () => {
    sockets.last.open();
    sockets.last.ready();

    tokens.change('token-2');

    expect(sockets.sockets).toHaveLength(1);
    expect(sockets.last.authTokens).toEqual(['token-1', 'token-2']);
  });

  it('queda: reconecta com espera crescente e, ao voltar, pede para recarregar', () => {
    sockets.last.open();
    sockets.last.ready();

    sockets.last.closeByServer(CLOSE_CODES.serviceRestart);
    expect(connection.status()).toBe('reconnecting');
    expect(scheduler.runNext()).toBe(500);

    sockets.last.closeByServer(CLOSE_CODES.abnormal);
    expect(scheduler.runNext()).toBe(1_000);

    sockets.last.open();
    expect(resyncs).toBe(1);
    sockets.last.ready();
    expect(connection.status()).toBe('live');
    expect(resyncs).toBe(2);
    expect(sockets.sockets).toHaveLength(3);
  });

  it('reautenticar não conta como queda (nada a recarregar)', () => {
    sockets.last.open();
    sockets.last.ready();
    expect(resyncs).toBe(1);

    tokens.change('token-2');
    sockets.last.ready();

    expect(resyncs).toBe(1);
  });

  it('4401 (token vencido): renova a sessão e reconecta com o token novo', async () => {
    sockets.last.open();
    sockets.last.ready();

    sockets.last.closeByServer(CLOSE_CODES.unauthorized);
    await Promise.resolve();
    await Promise.resolve();
    scheduler.runNext();
    sockets.last.open();

    expect(tokens.renewals).toBe(1);
    expect(sockets.last.authTokens).toEqual(['token-renovado']);
  });

  it('4401 e a sessão acabou: desconecta e espera um novo login', async () => {
    tokens.renewTo = null;
    sockets.last.open();

    sockets.last.closeByServer(CLOSE_CODES.unauthorized);
    await Promise.resolve();
    await Promise.resolve();

    expect(connection.status()).toBe('idle');
    expect(scheduler.pending).toHaveLength(0);
  });

  it('4403 (sem permissão): desiste, sem ficar tentando', () => {
    sockets.last.open();

    sockets.last.closeByServer(CLOSE_CODES.forbidden);

    expect(connection.status()).toBe('forbidden');
    expect(scheduler.pending).toHaveLength(0);
  });

  it('logout: fecha a conexão e cancela reconexões pendentes', () => {
    sockets.last.open();
    sockets.last.ready();
    sockets.last.closeByServer(CLOSE_CODES.abnormal);

    tokens.change(null);

    expect(connection.status()).toBe('idle');
    expect(scheduler.pending).toHaveLength(0);
  });

  it('sem sessão ao abrir: só conecta depois do login', async () => {
    const idleSockets = new FakeSocketFactory();
    const noSession = new FakeTokenSource();
    noSession.token = null;
    const idle = new LiveConnection({ sockets: idleSockets, tokens: noSession, events: bus, scheduler, random: () => 0 });

    await idle.start();
    expect(idle.status()).toBe('idle');
    expect(idleSockets.sockets).toHaveLength(0);

    noSession.change('token-login');
    expect(idleSockets.sockets).toHaveLength(1);
  });
});
