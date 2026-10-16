import type { Stopwatch } from '../../application';

/** Cronômetro real, sobre `performance.now()` (monotônico, com fração de ms). */
export class PerformanceStopwatch implements Stopwatch {
  start(): () => number {
    const startedAt = performance.now();
    return () => performance.now() - startedAt;
  }
}
