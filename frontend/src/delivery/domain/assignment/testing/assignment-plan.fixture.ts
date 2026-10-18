import { AssignmentPlan, type AssignmentPlanProps } from '../..';

export function buildPlan(overrides: Partial<AssignmentPlanProps> = {}): AssignmentPlan {
  return AssignmentPlan.suggested({
    assignments: [
      {
        orderId: 'order-1',
        orderAddress: 'Rua das Flores, 123',
        deliveryPersonId: 'dp-1',
        deliveryPersonName: 'Carlos Santos',
        distanceKm: 2.45,
      },
      {
        orderId: 'order-2',
        orderAddress: 'Av. Paulista, 1000',
        deliveryPersonId: 'dp-2',
        deliveryPersonName: 'Ana Lima',
        distanceKm: 1.87,
      },
    ],
    unassigned: [],
    unlocatedDeliveryPersons: [],
    totalDistanceKm: 4.32,
    algorithm: 'hungarian',
    executionTimeMs: 0.42,
    ...overrides,
  });
}
