import type { Clock } from '../clock';

/** Relógio controlável para testes. */
export class FixedClock implements Clock {
  #now: Date;

  constructor(now: Date) {
    this.#now = new Date(now.getTime());
  }

  now(): Date {
    return new Date(this.#now.getTime());
  }

  advanceBy(milliseconds: number): void {
    this.#now = new Date(this.#now.getTime() + milliseconds);
  }
}
