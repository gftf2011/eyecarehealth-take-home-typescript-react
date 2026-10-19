import type { Stopwatch } from '../../../shared-kernel/application';
import type { DispatchPlanner, PlannedAssignment } from '../../application/ports/dispatch-planner';
import type { DispatchableOrder, DispatchCandidate, DispatchOptimizer } from '../../domain';

/**
 * Roda o otimizador na própria thread da requisição. Para problemas pequenos
 * (o caso comum: dezenas de pedidos), mandar para um worker custaria mais que
 * o cálculo.
 */
export class InlineDispatchPlanner implements DispatchPlanner {
  constructor(
    private readonly optimizer: DispatchOptimizer,
    private readonly stopwatch: Stopwatch,
  ) {}

  async plan(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): Promise<PlannedAssignment> {
    const elapsed = this.stopwatch.start();
    const plan = this.optimizer.plan(orders, candidates);
    return { plan, executionTimeMs: elapsed() };
  }
}
