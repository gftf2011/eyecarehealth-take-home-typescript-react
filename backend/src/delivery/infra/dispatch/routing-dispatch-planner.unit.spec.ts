import { describe, expect, it } from 'vitest';

import { FixedStopwatch } from '../../../shared-kernel/application/testing/fixed-stopwatch';
import type { DispatchPlanner, PlannedAssignment } from '../../application/ports/dispatch-planner';
import { DispatchOptimizer, type DispatchableOrder, type DispatchCandidate } from '../../domain';
import { InlineDispatchPlanner } from './inline-dispatch-planner';
import { RoutingDispatchPlanner } from './routing-dispatch-planner';
import { randomProblem } from './testing/dispatch-problem';

/** Planner que conta chamadas e só responde quando o teste mandar. */
class ControlledPlanner implements DispatchPlanner {
  calls = 0;
  readonly #inner = new InlineDispatchPlanner(new DispatchOptimizer(), new FixedStopwatch(1));
  readonly #pending: (() => void)[] = [];
  failNext = false;

  async plan(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): Promise<PlannedAssignment> {
    this.calls += 1;
    await new Promise<void>((resolve) => this.#pending.push(resolve));
    if (this.failNext) {
      this.failNext = false;
      throw new Error('worker caiu');
    }
    return this.#inner.plan(orders, candidates);
  }

  release(): void {
    for (const resolve of this.#pending.splice(0)) resolve();
  }
}

describe('RoutingDispatchPlanner', () => {
  const small = randomProblem(3, 3);
  const large = randomProblem(20, 20);

  it('problema pequeno roda na thread da requisição; grande vai para o pool', async () => {
    const inline = new ControlledPlanner();
    const pool = new ControlledPlanner();
    const planner = new RoutingDispatchPlanner(inline, pool, 100);

    const smallPlan = planner.plan(small.orders, small.candidates);
    const largePlan = planner.plan(large.orders, large.candidates);
    inline.release();
    pool.release();
    await Promise.all([smallPlan, largePlan]);

    expect([inline.calls, pool.calls]).toEqual([1, 1]);
  });

  it('pedidos iguais ao mesmo tempo dividem um só cálculo, mesmo em outra ordem', async () => {
    const pool = new ControlledPlanner();
    const planner = new RoutingDispatchPlanner(new ControlledPlanner(), pool, 100);

    const first = planner.plan(large.orders, large.candidates);
    const second = planner.plan([...large.orders].reverse(), [...large.candidates].reverse());
    pool.release();
    const [a, b] = await Promise.all([first, second]);

    expect(pool.calls).toBe(1);
    expect(b).toBe(a);
  });

  it('terminado o cálculo, um pedido novo calcula de novo (nada fica em cache)', async () => {
    const pool = new ControlledPlanner();
    const planner = new RoutingDispatchPlanner(new ControlledPlanner(), pool, 100);

    const first = planner.plan(large.orders, large.candidates);
    pool.release();
    await first;
    const second = planner.plan(large.orders, large.candidates);
    pool.release();
    await second;

    expect(pool.calls).toBe(2);
  });

  it('uma falha chega a todos que esperavam e não fica presa para o próximo', async () => {
    const pool = new ControlledPlanner();
    const planner = new RoutingDispatchPlanner(new ControlledPlanner(), pool, 100);
    pool.failNext = true;

    const first = planner.plan(large.orders, large.candidates);
    const second = planner.plan(large.orders, large.candidates);
    pool.release();

    await expect(first).rejects.toThrow('worker caiu');
    await expect(second).rejects.toThrow('worker caiu');
    const retry = planner.plan(large.orders, large.candidates);
    pool.release();
    await expect(retry).resolves.toMatchObject({ executionTimeMs: 1 });
  });
});
