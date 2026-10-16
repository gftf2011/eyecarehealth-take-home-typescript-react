import type { Stopwatch } from '../stopwatch';

/** Cronômetro de teste: toda medição dura exatamente `elapsedMs`. */
export class FixedStopwatch implements Stopwatch {
  constructor(private readonly elapsedMs: number) {}

  start(): () => number {
    return () => this.elapsedMs;
  }
}
