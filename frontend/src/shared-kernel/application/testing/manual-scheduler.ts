import type { Scheduler } from '../scheduler';

/** Agendador manual: o teste decide quando as tarefas rodam. */
export class ManualScheduler implements Scheduler {
  readonly pending: { task: () => void; delayMs: number }[] = [];

  schedule(task: () => void, delayMs: number): () => void {
    const entry = { task, delayMs };
    this.pending.push(entry);
    return () => {
      const index = this.pending.indexOf(entry);
      if (index >= 0) this.pending.splice(index, 1);
    };
  }

  runNext(): number {
    const entry = this.pending.shift();
    if (entry === undefined) throw new Error('nada agendado');
    entry.task();
    return entry.delayMs;
  }
}
