import { describe, expect, it, vi } from 'vitest';

import { buildSession } from '../../domain/session/testing/session.fixture';
import { InMemorySessionStore } from './in-memory-session.store';

describe('InMemorySessionStore', () => {
  it('começa restaurando, sem sessão', () => {
    expect(new InMemorySessionStore().state()).toEqual({ status: 'restoring' });
  });

  it('avisa quem observa e mantém a mesma referência até mudar', () => {
    const store = new InMemorySessionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.authenticate(buildSession());
    const state = store.state();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.state()).toBe(state);

    store.end('expired');
    expect(store.state()).toEqual({ status: 'anonymous', endedBy: 'expired' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('para de avisar depois do unsubscribe', () => {
    const store = new InMemorySessionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.end(null);

    expect(listener).not.toHaveBeenCalled();
  });
});
