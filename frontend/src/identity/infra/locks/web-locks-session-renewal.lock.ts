import type { SessionRenewalLock } from '../../application';

export const SESSION_RENEWAL_LOCK_NAME = 'fastmeals:session-renewal';

/**
 * Trava entre abas com a [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API):
 * o navegador garante que só uma aba da mesma origem segura a trava por vez.
 * Sem suporte (navegadores antigos, jsdom), cai numa fila dentro da aba, que
 * ainda evita renovações paralelas na mesma aba.
 */
export class WebLocksSessionRenewalLock implements SessionRenewalLock {
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly locks: LockManager | undefined = globalThis.navigator?.locks,
    private readonly name: string = SESSION_RENEWAL_LOCK_NAME,
  ) {}

  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    if (this.locks !== undefined) {
      return this.locks.request(this.name, { mode: 'exclusive' }, () => task());
    }
    const run = this.#queue.then(task, task);
    this.#queue = run.catch(() => undefined);
    return run;
  }
}
