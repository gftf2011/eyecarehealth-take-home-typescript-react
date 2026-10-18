import { describe, expect, it, vi } from 'vitest';

import { SESSION_RENEWAL_LOCK_NAME, WebLocksSessionRenewalLock } from './web-locks-session-renewal.lock';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('WebLocksSessionRenewalLock', () => {
  it('usa a Web Locks API quando o navegador oferece', async () => {
    const request = vi.fn((_name: string, _options: LockOptions, task: () => Promise<unknown>) => task());
    const lock = new WebLocksSessionRenewalLock({ request } as unknown as LockManager);

    await expect(lock.runExclusive(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(request).toHaveBeenCalledWith(
      SESSION_RENEWAL_LOCK_NAME,
      { mode: 'exclusive' },
      expect.any(Function),
    );
  });

  describe('sem Web Locks (fila na própria aba)', () => {
    it('executa uma tarefa por vez, na ordem', async () => {
      const lock = new WebLocksSessionRenewalLock(undefined);
      const first = deferred();
      const order: string[] = [];

      const a = lock.runExclusive(async () => {
        order.push('a:início');
        await first.promise;
        order.push('a:fim');
      });
      const b = lock.runExclusive(() => {
        order.push('b');
        return Promise.resolve();
      });

      await Promise.resolve();
      expect(order).toEqual(['a:início']);

      first.resolve();
      await Promise.all([a, b]);
      expect(order).toEqual(['a:início', 'a:fim', 'b']);
    });

    it('uma tarefa que falha não trava as próximas', async () => {
      const lock = new WebLocksSessionRenewalLock(undefined);

      await expect(lock.runExclusive(() => Promise.reject(new Error('falhou')))).rejects.toThrow('falhou');
      await expect(lock.runExclusive(() => Promise.resolve('depois'))).resolves.toBe('depois');
    });
  });
});
