import { describe, expect, it } from 'vitest';

import { suggestionSchema, toAssignmentPlan } from './assignment.mapper';

const RESPONSE = {
  assignments: [
    {
      orderId: 'order-1',
      deliveryPersonId: 'dp-3',
      estimatedDistanceKm: 2.45,
      orderAddress: 'Rua das Flores, 123',
      deliveryPersonName: 'Carlos Santos',
    },
  ],
  unassigned: [
    { orderId: 'order-3', orderAddress: 'Av. Paulista, 1000', reason: 'No available delivery person' },
    { orderId: 'order-4', orderAddress: 'Rua Augusta, 50', reason: 'Algo novo' },
  ],
  unlocatedDeliveryPersons: [{ id: 'dp-9', name: 'Sem GPS' }],
  totalDistanceKm: 2.45,
  algorithm: 'hungarian',
  executionTimeMs: 0.42,
};

describe('assignment.mapper', () => {
  it('converte a resposta da otimização no plano, com os motivos como códigos', () => {
    const plan = toAssignmentPlan(suggestionSchema.parse(RESPONSE));

    expect(plan.assignments[0]).toMatchObject({ orderId: 'order-1', distanceKm: 2.45, decision: { status: 'pending' } });
    expect(plan.unassigned.map((order) => order.reason)).toEqual(['NO_AVAILABLE_DELIVERY_PERSON', 'UNKNOWN']);
    expect(plan.unlocatedDeliveryPersons).toEqual([{ id: 'dp-9', name: 'Sem GPS' }]);
    expect(plan.executionTimeMs).toBe(0.42);
  });

  it('recusa uma resposta fora do contrato (ex.: distância negativa)', () => {
    const invalid = { ...RESPONSE, assignments: [{ ...RESPONSE.assignments[0], estimatedDistanceKm: -1 }] };
    expect(suggestionSchema.safeParse(invalid).success).toBe(false);
  });
});
