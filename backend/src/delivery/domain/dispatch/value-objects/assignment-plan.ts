import type { DeliveryPersonId } from '../../delivery-person/delivery-person-id';
import type { OrderId } from './order-id';

export const ASSIGNMENT_ALGORITHM = 'hungarian';

export type Assignment = {
  readonly orderId: OrderId;
  readonly deliveryPersonId: DeliveryPersonId;
  readonly distanceKm: number;
};

export type UnassignedReason = 'NO_AVAILABLE_DELIVERY_PERSON';

export type UnassignedOrder = {
  readonly orderId: OrderId;
  readonly reason: UnassignedReason;
};

/**
 * Sugestão de atribuição produzida pelo otimizador. É só uma proposta: nada é
 * alterado até o gestor aceitar cada atribuição (use case no Ordering).
 */
export class AssignmentPlan {
  readonly algorithm = ASSIGNMENT_ALGORITHM;
  readonly assignments: readonly Assignment[];
  readonly unassigned: readonly UnassignedOrder[];
  /** Entregadores aptos, mas sem localização conhecida: ficaram fora do cálculo. */
  readonly unlocatedDeliveryPersonIds: readonly DeliveryPersonId[];

  private constructor(
    assignments: readonly Assignment[],
    unassigned: readonly UnassignedOrder[],
    unlocatedDeliveryPersonIds: readonly DeliveryPersonId[],
  ) {
    this.assignments = Object.freeze([...assignments]);
    this.unassigned = Object.freeze([...unassigned]);
    this.unlocatedDeliveryPersonIds = Object.freeze([...unlocatedDeliveryPersonIds]);
  }

  static create(params: {
    assignments: readonly Assignment[];
    unassigned: readonly UnassignedOrder[];
    unlocatedDeliveryPersonIds: readonly DeliveryPersonId[];
  }): AssignmentPlan {
    return new AssignmentPlan(
      params.assignments,
      params.unassigned,
      params.unlocatedDeliveryPersonIds,
    );
  }

  get totalDistanceKm(): number {
    return this.assignments.reduce((total, assignment) => total + assignment.distanceKm, 0);
  }

  get isEmpty(): boolean {
    return this.assignments.length === 0 && this.unassigned.length === 0;
  }
}
