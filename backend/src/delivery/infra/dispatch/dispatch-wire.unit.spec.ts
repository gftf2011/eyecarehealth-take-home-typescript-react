import { describe, expect, it } from 'vitest';

import { DispatchOptimizer } from '../../domain';
import { fromWireCandidates, fromWireOrders, fromWirePlan, toWireCandidates, toWireOrders, toWirePlan } from './dispatch-wire';
import { randomProblem } from './testing/dispatch-problem';

describe('dispatch-wire (transporte entre threads)', () => {
  it('ida e volta preserva pedidos, entregadores (inclusive sem localização) e o plano', () => {
    const { orders, candidates } = randomProblem(8, 5);

    const rebuiltOrders = fromWireOrders(structuredClone(toWireOrders(orders)));
    const rebuiltCandidates = fromWireCandidates(structuredClone(toWireCandidates(candidates)));
    const plan = new DispatchOptimizer().plan(rebuiltOrders, rebuiltCandidates);
    const rebuiltPlan = fromWirePlan(structuredClone(toWirePlan(plan)));

    expect(rebuiltOrders.every((order, index) => order.equals(orders[index] ?? order))).toBe(true);
    expect(rebuiltCandidates.every((candidate, index) => candidate.equals(candidates[index] ?? candidate))).toBe(true);
    expect(toWirePlan(rebuiltPlan)).toEqual(toWirePlan(new DispatchOptimizer().plan(orders, candidates)));
    expect(rebuiltPlan.unlocatedDeliveryPersonIds).toHaveLength(1);
  });
});
