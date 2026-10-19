import {
  AssignmentPlan,
  DeliveryPersonId,
  DispatchableOrder,
  DispatchCandidate,
  GeoPoint,
  OrderId,
  type UnassignedReason,
} from '../../domain';

/**
 * Formato das mensagens entre a API e os workers do otimizador. Value Objects
 * (classes com campos privados) não atravessam threads: vão como números e
 * strings e são remontados do outro lado, passando de novo pelas validações.
 */
export type WireOrder = {
  readonly orderId: string;
  readonly deliveryAddress: string;
  readonly latitude: number;
  readonly longitude: number;
};

export type WireCandidate = {
  readonly deliveryPersonId: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
};

export type WirePlan = {
  readonly assignments: readonly { orderId: string; deliveryPersonId: string; distanceKm: number }[];
  readonly unassigned: readonly { orderId: string; reason: UnassignedReason }[];
  readonly unlocatedDeliveryPersonIds: readonly string[];
};

export type WireRequest = {
  readonly id: number;
  readonly orders: readonly WireOrder[];
  readonly candidates: readonly WireCandidate[];
};

export type WireResponse =
  | { readonly kind: 'result'; readonly id: number; readonly ok: true; readonly plan: WirePlan; readonly executionTimeMs: number }
  | { readonly kind: 'result'; readonly id: number; readonly ok: false; readonly error: string };

/** O worker carregou e está pronto para receber cálculos. */
export type WireReady = { readonly kind: 'ready' };

export type WorkerMessage = WireResponse | WireReady;

export function toWireOrders(orders: readonly DispatchableOrder[]): WireOrder[] {
  return orders.map((order) => ({
    orderId: order.orderId.value,
    deliveryAddress: order.deliveryAddress,
    latitude: order.location.latitude,
    longitude: order.location.longitude,
  }));
}

export function fromWireOrders(orders: readonly WireOrder[]): DispatchableOrder[] {
  return orders.map((order) =>
    DispatchableOrder.create({
      orderId: OrderId.from(order.orderId),
      deliveryAddress: order.deliveryAddress,
      location: GeoPoint.create(order.latitude, order.longitude),
    }),
  );
}

export function toWireCandidates(candidates: readonly DispatchCandidate[]): WireCandidate[] {
  return candidates.map((candidate) => ({
    deliveryPersonId: candidate.deliveryPersonId.value,
    latitude: candidate.location?.latitude ?? null,
    longitude: candidate.location?.longitude ?? null,
  }));
}

export function fromWireCandidates(candidates: readonly WireCandidate[]): DispatchCandidate[] {
  return candidates.map((candidate) =>
    DispatchCandidate.create({
      deliveryPersonId: DeliveryPersonId.from(candidate.deliveryPersonId),
      location:
        candidate.latitude === null || candidate.longitude === null
          ? null
          : GeoPoint.create(candidate.latitude, candidate.longitude),
    }),
  );
}

export function toWirePlan(plan: AssignmentPlan): WirePlan {
  return {
    assignments: plan.assignments.map((assignment) => ({
      orderId: assignment.orderId.value,
      deliveryPersonId: assignment.deliveryPersonId.value,
      distanceKm: assignment.distanceKm,
    })),
    unassigned: plan.unassigned.map((order) => ({ orderId: order.orderId.value, reason: order.reason })),
    unlocatedDeliveryPersonIds: plan.unlocatedDeliveryPersonIds.map((id) => id.value),
  };
}

export function fromWirePlan(plan: WirePlan): AssignmentPlan {
  return AssignmentPlan.create({
    assignments: plan.assignments.map((assignment) => ({
      orderId: OrderId.from(assignment.orderId),
      deliveryPersonId: DeliveryPersonId.from(assignment.deliveryPersonId),
      distanceKm: assignment.distanceKm,
    })),
    unassigned: plan.unassigned.map((order) => ({ orderId: OrderId.from(order.orderId), reason: order.reason })),
    unlocatedDeliveryPersonIds: plan.unlocatedDeliveryPersonIds.map((id) => DeliveryPersonId.from(id)),
  });
}
