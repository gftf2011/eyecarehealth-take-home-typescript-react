import { availableParallelism } from 'node:os';

import type { DispatchPlanner } from '../application/ports/dispatch-planner';
import { DispatchOptimizer } from '../domain';
import { InlineDispatchPlanner } from '../infra/dispatch/inline-dispatch-planner';
import { RoutingDispatchPlanner } from '../infra/dispatch/routing-dispatch-planner';
import { WorkerPoolDispatchPlanner } from '../infra/dispatch/worker-pool-dispatch-planner';
import { PerformanceStopwatch } from '../../shared-kernel/infra/clock/performance-stopwatch';

export type DispatchPlannerOptions = {
  /** Workers do pool; padrão: núcleos − 1 (a thread da API fica com um), no máximo 2. */
  readonly workers?: number;
  readonly maxQueued: number;
  readonly timeoutMs: number;
  /** Até quantas células (pedidos × entregadores) calcular na thread da requisição. */
  readonly inlineMaxCells: number;
};

export type DispatchPlannerHandle = {
  readonly planner: DispatchPlanner;
  /** Espera os workers carregarem; rejeita se não subirem (build quebrado). */
  readonly ready: () => Promise<void>;
  /** Encerra os workers (shutdown da API). */
  readonly close: () => Promise<void>;
};

const MAX_DEFAULT_WORKERS = 2;

/** Monta o otimizador: problemas pequenos na thread da API, grandes num pool de workers. */
export function makeDispatchPlanner(options: DispatchPlannerOptions): DispatchPlannerHandle {
  const workers = options.workers ?? Math.min(MAX_DEFAULT_WORKERS, Math.max(1, availableParallelism() - 1));
  const pool = new WorkerPoolDispatchPlanner({ size: workers, maxQueued: options.maxQueued, timeoutMs: options.timeoutMs });
  const inline = new InlineDispatchPlanner(new DispatchOptimizer(), new PerformanceStopwatch());
  return {
    planner: new RoutingDispatchPlanner(inline, pool, options.inlineMaxCells),
    ready: () => pool.ready(),
    close: () => pool.close(),
  };
}

/** Só na thread da requisição (testes que não exercitam o pool). */
export function makeInlineDispatchPlanner(): DispatchPlanner {
  return new InlineDispatchPlanner(new DispatchOptimizer(), new PerformanceStopwatch());
}
