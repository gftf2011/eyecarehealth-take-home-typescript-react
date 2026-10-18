import { beforeEach, describe, expect, it } from 'vitest';

import { ManualScheduler } from '../testing/manual-scheduler';
import { RefreshThrottle } from './refresh-throttle';

describe('RefreshThrottle', () => {
  let scheduler: ManualScheduler;
  let flushes: (readonly number[])[];
  let throttle: RefreshThrottle<number>;

  beforeEach(() => {
    scheduler = new ManualScheduler();
    flushes = [];
    throttle = new RefreshThrottle(scheduler, 1_000, (batch) => flushes.push(batch));
  });

  it('o primeiro item sai na hora e abre um intervalo', () => {
    throttle.push(1);

    expect(flushes).toEqual([[1]]);
    expect(scheduler.pending.map((entry) => entry.delayMs)).toEqual([1_000]);
  });

  it('uma rajada no intervalo vira uma única recarga no fim dele', () => {
    throttle.push(1);
    for (let item = 2; item <= 50; item += 1) throttle.push(item);

    expect(flushes).toHaveLength(1);
    expect(throttle.pendingCount).toBe(49);

    scheduler.runNext();

    expect(flushes).toHaveLength(2);
    expect(flushes[1]).toHaveLength(49);
  });

  it('depois de um intervalo sem itens, volta a ficar ocioso e o próximo sai na hora', () => {
    throttle.push(1);
    throttle.push(2);
    scheduler.runNext();
    scheduler.runNext();

    expect(scheduler.pending).toEqual([]);
    throttle.push(3);

    expect(flushes).toEqual([[1], [2], [3]]);
  });

  it('eventos contínuos saem no máximo um lote por intervalo', () => {
    throttle.push(0);
    for (let window = 1; window <= 5; window += 1) {
      throttle.push(window);
      throttle.push(window * 10);
      scheduler.runNext();
    }

    expect(flushes).toEqual([[0], [1, 10], [2, 20], [3, 30], [4, 40], [5, 50]]);
  });

  it('reset descarta o acumulado e encerra o intervalo', () => {
    throttle.push(1);
    throttle.push(2);

    throttle.reset();

    expect(scheduler.pending).toEqual([]);
    throttle.push(3);
    expect(flushes).toEqual([[1], [3]]);
  });
});
