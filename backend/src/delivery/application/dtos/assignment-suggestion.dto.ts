import type { AssignmentPlan, DeliveryPerson, DispatchableOrder, UnassignedReason } from '../../domain';

export type SuggestedAssignmentDto = {
  readonly orderId: string;
  readonly deliveryPersonId: string;
  /** Distância Haversine entregador → pedido, em km, com 2 casas. */
  readonly estimatedDistanceKm: number;
  readonly orderAddress: string;
  readonly deliveryPersonName: string;
};

export type UnassignedOrderDto = {
  readonly orderId: string;
  readonly orderAddress: string;
  readonly reason: string;
};

/** Entregador apto, mas sem localização conhecida: ficou fora do cálculo. */
export type UnlocatedDeliveryPersonDto = {
  readonly id: string;
  readonly name: string;
};

/** Resposta de `POST /api/orders/optimize-assignment` (formato da spec + `unlocatedDeliveryPersons`). */
export type AssignmentSuggestionDto = {
  readonly assignments: readonly SuggestedAssignmentDto[];
  readonly unassigned: readonly UnassignedOrderDto[];
  readonly unlocatedDeliveryPersons: readonly UnlocatedDeliveryPersonDto[];
  /** Soma das distâncias já arredondadas: bate com o que o painel exibe. */
  readonly totalDistanceKm: number;
  readonly algorithm: string;
  /** Tempo do algoritmo (matriz de distâncias + Húngaro), em ms com 2 casas. */
  readonly executionTimeMs: number;
};

const REASON_MESSAGES: Readonly<Record<UnassignedReason, string>> = {
  NO_AVAILABLE_DELIVERY_PERSON: 'No available delivery person',
};

export function toAssignmentSuggestionDto(
  plan: AssignmentPlan,
  orders: readonly DispatchableOrder[],
  deliveryPersons: readonly DeliveryPerson[],
  executionTimeMs: number,
): AssignmentSuggestionDto {
  const addresses = new Map(orders.map((order) => [order.orderId.value, order.deliveryAddress]));
  const names = new Map(deliveryPersons.map((person) => [person.id.value, person.name.value]));
  const lookup = (map: ReadonlyMap<string, string>, id: string): string => {
    const value = map.get(id);
    if (value === undefined) throw new Error(`Plano referencia um ID fora da entrada: ${id}`);
    return value;
  };

  const assignments = plan.assignments.map((assignment) => ({
    orderId: assignment.orderId.value,
    deliveryPersonId: assignment.deliveryPersonId.value,
    estimatedDistanceKm: roundTo2(assignment.distanceKm),
    orderAddress: lookup(addresses, assignment.orderId.value),
    deliveryPersonName: lookup(names, assignment.deliveryPersonId.value),
  }));

  return {
    assignments,
    unassigned: plan.unassigned.map((order) => ({
      orderId: order.orderId.value,
      orderAddress: lookup(addresses, order.orderId.value),
      reason: REASON_MESSAGES[order.reason],
    })),
    unlocatedDeliveryPersons: plan.unlocatedDeliveryPersonIds.map((id) => ({
      id: id.value,
      name: lookup(names, id.value),
    })),
    // Soma em centésimos inteiros: sem erro de ponto flutuante (2.45 + 1.87 = 4.32).
    totalDistanceKm:
      assignments.reduce((total, assignment) => total + Math.round(assignment.estimatedDistanceKm * 100), 0) /
      100,
    algorithm: plan.algorithm,
    executionTimeMs: roundTo2(executionTimeMs),
  };
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}
