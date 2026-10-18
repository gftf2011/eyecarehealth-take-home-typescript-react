import { describe, expect, it } from 'vitest';

import { AssignmentNotPendingError } from '..';
import { buildPlan } from './testing/assignment-plan.fixture';

describe('AssignmentPlan', () => {
  it('toda sugestão começa pendente', () => {
    const plan = buildPlan();

    expect(plan.pending.map((assignment) => assignment.orderId)).toEqual(['order-1', 'order-2']);
    expect(plan.isSettled).toBe(false);
    expect(plan.acceptedDistanceKm).toBe(0);
  });

  it('decidir devolve um plano novo e não altera o anterior', () => {
    const plan = buildPlan();
    const decided = plan.accept('order-1');

    expect(decided.assignments[0]?.decision).toEqual({ status: 'accepted' });
    expect(plan.assignments[0]?.decision).toEqual({ status: 'pending' });
  });

  it('soma só a distância despachada, sem erro de ponto flutuante', () => {
    const plan = buildPlan().accept('order-1').accept('order-2');

    expect(plan.acceptedDistanceKm).toBe(4.32);
    expect(plan.isSettled).toBe(true);
  });

  it('rejeitar e falhar também encerram o par', () => {
    const plan = buildPlan().reject('order-1').fail('order-2', 'O entregador ficou ocupado');

    expect(plan.assignments.map((assignment) => assignment.decision)).toEqual([
      { status: 'rejected' },
      { status: 'failed', reason: 'O entregador ficou ocupado' },
    ]);
    expect(plan.isSettled).toBe(true);
    expect(plan.acceptedDistanceKm).toBe(0);
  });

  it.each(['accept', 'reject'] as const)('não deixa %s um par já decidido', (action) => {
    const plan = buildPlan().accept('order-1');

    expect(() => plan[action]('order-1')).toThrow(AssignmentNotPendingError);
  });

  it('sem pedidos e sem sugestões, o plano está vazio', () => {
    expect(buildPlan({ assignments: [], totalDistanceKm: 0 }).isEmpty).toBe(true);
  });
});
