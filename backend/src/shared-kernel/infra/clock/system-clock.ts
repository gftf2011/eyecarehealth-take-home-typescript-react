import type { Clock } from '../../application';

/** Relógio real do sistema. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
