import type { DeliveryPersonId } from '../../delivery-person/delivery-person-id';
import type { GeoPoint } from '../../location/geo-point';
import { solveMinCostAssignment } from '../algorithms/hungarian';
import {
  AssignmentPlan,
  type Assignment,
  type UnassignedOrder,
} from '../value-objects/assignment-plan';
import type { DispatchCandidate } from '../value-objects/dispatch-candidate';
import type { DispatchableOrder } from '../value-objects/dispatchable-order';

type LocatedCandidate = {
  readonly deliveryPersonId: DeliveryPersonId;
  readonly location: GeoPoint;
};

/**
 * Serviço de domínio: sugere a atribuição pedido → entregador que minimiza a
 * soma das distâncias (Haversine) entre cada entregador e o seu pedido.
 *
 * - Cada entregador recebe no máximo um pedido.
 * - Pedidos excedentes saem em `unassigned`; entregadores excedentes ficam livres.
 * - Entregadores sem localização ficam fora do cálculo e são reportados.
 * - Entradas são ordenadas por ID, então a mesma entrada gera sempre o mesmo plano.
 *
 * Complexidade: O(n·m) para a matriz de distâncias + O(k²·K) do Húngaro, com
 * k = min(n, m) e K = max(n, m).
 */
export class DispatchOptimizer {
  plan(
    orders: readonly DispatchableOrder[],
    candidates: readonly DispatchCandidate[],
  ): AssignmentPlan {
    const sortedOrders = [...orders].sort((a, b) => compareIds(a.orderId, b.orderId));
    const sortedCandidates = [...candidates].sort((a, b) =>
      compareIds(a.deliveryPersonId, b.deliveryPersonId),
    );

    const located: LocatedCandidate[] = [];
    const unlocatedDeliveryPersonIds: DeliveryPersonId[] = [];
    for (const candidate of sortedCandidates) {
      if (candidate.location === null) unlocatedDeliveryPersonIds.push(candidate.deliveryPersonId);
      else located.push({ deliveryPersonId: candidate.deliveryPersonId, location: candidate.location });
    }

    const assignedOrderIndexes = this.solve(sortedOrders, located);

    const assignments: Assignment[] = [];
    const unassigned: UnassignedOrder[] = [];
    sortedOrders.forEach((order, orderIndex) => {
      const courierIndex = assignedOrderIndexes.get(orderIndex);
      const courier = courierIndex === undefined ? undefined : located[courierIndex];
      if (courier === undefined) {
        unassigned.push({ orderId: order.orderId, reason: 'NO_AVAILABLE_DELIVERY_PERSON' });
        return;
      }
      assignments.push({
        orderId: order.orderId,
        deliveryPersonId: courier.deliveryPersonId,
        distanceKm: courier.location.distanceTo(order.location),
      });
    });

    return AssignmentPlan.create({ assignments, unassigned, unlocatedDeliveryPersonIds });
  }

  /**
   * O Húngaro exige linhas ≤ colunas: com mais pedidos que entregadores, a
   * matriz é montada com entregadores nas linhas (transposta).
   *
   * @returns índice do pedido → índice do entregador atribuído.
   */
  private solve(
    orders: readonly DispatchableOrder[],
    couriers: readonly LocatedCandidate[],
  ): Map<number, number> {
    const result = new Map<number, number>();
    if (orders.length === 0 || couriers.length === 0) return result;

    if (orders.length <= couriers.length) {
      const cost = orders.map((order) =>
        couriers.map((courier) => courier.location.distanceTo(order.location)),
      );
      solveMinCostAssignment(cost).forEach((courierIndex, orderIndex) =>
        result.set(orderIndex, courierIndex),
      );
    } else {
      const cost = couriers.map((courier) =>
        orders.map((order) => courier.location.distanceTo(order.location)),
      );
      solveMinCostAssignment(cost).forEach((orderIndex, courierIndex) =>
        result.set(orderIndex, courierIndex),
      );
    }
    return result;
  }
}

function compareIds(a: { value: string }, b: { value: string }): number {
  if (a.value === b.value) return 0;
  return a.value < b.value ? -1 : 1;
}
