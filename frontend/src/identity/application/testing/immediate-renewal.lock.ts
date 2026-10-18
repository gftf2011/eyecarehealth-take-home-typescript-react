import type { SessionRenewalLock } from '..';

/** Trava que só executa a tarefa (os casos de uso não dependem da implementação real). */
export class ImmediateRenewalLock implements SessionRenewalLock {
  acquisitions = 0;

  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    this.acquisitions += 1;
    return task();
  }
}
