import type { Scheduler } from '../../application';

export class TimeoutScheduler implements Scheduler {
  schedule(task: () => void, delayMs: number): () => void {
    const timer = setTimeout(task, delayMs);
    return () => clearTimeout(timer);
  }
}
