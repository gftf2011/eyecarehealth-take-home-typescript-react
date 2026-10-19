import { afterEach, describe, expect, it } from 'vitest';

import { FixedStopwatch } from '../../../shared-kernel/application/testing/fixed-stopwatch';
import { DispatchPlannerBusyError } from '../../application/errors/dispatch-planner-busy.error';
import { DispatchPlannerTimeoutError } from '../../application/errors/dispatch-planner-timeout.error';
import { DispatchOptimizer } from '../../domain';
import { toWirePlan } from './dispatch-wire';
import { InlineDispatchPlanner } from './inline-dispatch-planner';
import { WorkerPoolDispatchPlanner, type WorkerPoolDispatchPlannerOptions } from './worker-pool-dispatch-planner';
import { randomProblem } from './testing/dispatch-problem';

let pool: WorkerPoolDispatchPlanner | null = null;

async function openPool(options: Partial<WorkerPoolDispatchPlannerOptions> = {}): Promise<WorkerPoolDispatchPlanner> {
  pool = new WorkerPoolDispatchPlanner({ size: 1, maxQueued: 4, timeoutMs: 30_000, ...options });
  await pool.ready();
  return pool;
}

afterEach(async () => {
  await pool?.close();
  pool = null;
});

describe('WorkerPoolDispatchPlanner (worker_threads de verdade)', () => {
  it('calcula no worker o mesmo plano que na thread da requisição', async () => {
    const { orders, candidates } = randomProblem(60, 45);
    const inline = await new InlineDispatchPlanner(new DispatchOptimizer(), new FixedStopwatch(0)).plan(orders, candidates);

    const result = await (await openPool()).plan(orders, candidates);

    expect(toWirePlan(result.plan)).toEqual(toWirePlan(inline.plan));
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  it('a thread chamadora continua livre durante um cálculo grande', async () => {
    const { orders, candidates } = randomProblem(700, 700);
    const planner = await openPool();

    const running = planner.plan(orders, candidates);
    // Se o cálculo rodasse aqui, este timer só dispararia depois dele (~1 s).
    const startedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const timerDelayMs = performance.now() - startedAt;
    const result = await running;

    expect(timerDelayMs).toBeLessThan(100);
    expect(result.executionTimeMs).toBeGreaterThan(timerDelayMs);
  });

  it('com o worker ocupado e a fila cheia, recusa na hora (503 OPTIMIZER_BUSY)', async () => {
    const { orders, candidates } = randomProblem(500, 500);
    const planner = await openPool({ size: 1, maxQueued: 1 });

    const running = planner.plan(orders, candidates);
    const queued = planner.plan(orders, candidates);
    const rejected = planner.plan(orders, candidates);

    await expect(rejected).rejects.toBeInstanceOf(DispatchPlannerBusyError);
    expect(planner.load).toEqual({ running: 1, queued: 1 });
    await expect(Promise.all([running, queued])).resolves.toHaveLength(2);
  });

  it('pedido feito enquanto o worker carrega espera na fila, sem contar o boot no tempo limite', async () => {
    pool = new WorkerPoolDispatchPlanner({ size: 1, maxQueued: 4, timeoutMs: 50 });
    const small = randomProblem(5, 5);

    await expect(pool.plan(small.orders, small.candidates)).resolves.toMatchObject({ plan: expect.anything() });
  });

  it('cálculo que passa do tempo limite é interrompido, e o worker recriado atende o próximo', async () => {
    const planner = await openPool({ timeoutMs: 50 });
    const huge = randomProblem(900, 900);

    await expect(planner.plan(huge.orders, huge.candidates)).rejects.toBeInstanceOf(DispatchPlannerTimeoutError);

    const small = randomProblem(5, 5);
    await expect(planner.plan(small.orders, small.candidates)).resolves.toMatchObject({ plan: expect.anything() });
  });

  it('worker que não consegue nem carregar: para de recriar e falha tudo, em vez de girar em loop', async () => {
    pool = new WorkerPoolDispatchPlanner({ size: 1, maxQueued: 4, timeoutMs: 1_000, script: new URL('file:///nao-existe/worker.js') });
    const small = randomProblem(5, 5);
    const waiting = pool.plan(small.orders, small.candidates);

    await expect(pool.ready()).rejects.toThrow('não consegue iniciar');
    await expect(waiting).rejects.toThrow('não consegue iniciar');
    await expect(pool.plan(small.orders, small.candidates)).rejects.toThrow('não consegue iniciar');
  });

  it('ao encerrar, o que estava na fila falha e nada novo é aceito', async () => {
    const { orders, candidates } = randomProblem(500, 500);
    const planner = await openPool({ size: 1, maxQueued: 2 });
    const running = planner.plan(orders, candidates);
    const queued = planner.plan(orders, candidates);
    // Rejeições observadas antes do close: nenhuma fica sem tratamento.
    const outcomes = Promise.allSettled([queued, running]);

    await planner.close();

    const [queuedOutcome, runningOutcome] = await outcomes;
    expect(queuedOutcome).toMatchObject({ status: 'rejected', reason: expect.any(DispatchPlannerBusyError) });
    expect(runningOutcome).toMatchObject({ status: 'rejected', reason: expect.any(DispatchPlannerBusyError) });
    await expect(planner.plan(orders, candidates)).rejects.toBeInstanceOf(DispatchPlannerBusyError);
  });
});
