import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSession } from '../../domain/session/testing/session.fixture';
import { InMemorySessionStore } from './in-memory-session.store';
import { SessionRenewalScheduler } from './session-renewal.scheduler';

const START = new Date('2026-10-17T12:00:00Z');
const MINUTE = 60_000;

describe('SessionRenewalScheduler', () => {
  let sessions: InMemorySessionStore;
  let renewNow: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
  let scheduler: SessionRenewalScheduler;

  beforeEach(() => {
    vi.useFakeTimers({ now: START });
    sessions = new InMemorySessionStore();
    renewNow = vi.fn(() => Promise.resolve('novo'));
    scheduler = new SessionRenewalScheduler(
      sessions,
      { renewNow },
      { now: () => new Date() },
      { marginMs: MINUTE, minDelayMs: 5_000, retryDelayMs: 30_000 },
    );
    scheduler.start();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('renova um minuto antes de o token vencer', () => {
    sessions.authenticate(buildSession({ expiresAt: new Date(START.getTime() + 15 * MINUTE) }));

    vi.advanceTimersByTime(14 * MINUTE - 1);
    expect(renewNow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(renewNow).toHaveBeenCalledTimes(1);
  });

  it('reagenda a cada token novo', () => {
    sessions.authenticate(buildSession({ expiresAt: new Date(START.getTime() + 15 * MINUTE) }));
    vi.advanceTimersByTime(10 * MINUTE);
    sessions.authenticate(buildSession({ expiresAt: new Date(Date.now() + 15 * MINUTE) }));

    vi.advanceTimersByTime(4 * MINUTE);
    expect(renewNow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * MINUTE);
    expect(renewNow).toHaveBeenCalledTimes(1);
  });

  it('respeita o intervalo mínimo com tokens de vida curta', () => {
    sessions.authenticate(buildSession({ expiresAt: new Date(START.getTime() + 10_000) }));

    vi.advanceTimersByTime(4_999);
    expect(renewNow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(renewNow).toHaveBeenCalledTimes(1);
  });

  it('para de agendar quando a sessão acaba', () => {
    sessions.authenticate(buildSession({ expiresAt: new Date(START.getTime() + 15 * MINUTE) }));
    sessions.end('signed-out');

    vi.advanceTimersByTime(60 * MINUTE);
    expect(renewNow).not.toHaveBeenCalled();
  });

  it('falha transitória: tenta de novo depois do intervalo de retentativa', async () => {
    renewNow.mockRejectedValueOnce(new Error('sem rede'));
    sessions.authenticate(buildSession({ expiresAt: new Date(START.getTime() + 2 * MINUTE) }));

    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(renewNow).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(renewNow).toHaveBeenCalledTimes(2);
  });
});
