import type { DispatchableOrder, DispatchCandidate } from '../../../domain';
import { seededRandom } from '../../../domain/dispatch/testing/brute-force';
import { courierAt, orderAt, unlocatedCourier } from '../../../domain/dispatch/testing/dispatch.fixture';

/** Problema aleatório (mas reproduzível pela semente) de `orders` pedidos × `couriers` entregadores. */
export function randomProblem(
  orders: number,
  couriers: number,
  seed = 42,
): { orders: DispatchableOrder[]; candidates: DispatchCandidate[] } {
  const random = seededRandom(seed);
  return {
    orders: Array.from({ length: orders }, (_, n) => orderAt(1_000 + n, random() * 2 - 1, random() * 2 - 1)),
    candidates: [
      ...Array.from({ length: couriers }, (_, n) => courierAt(n, random() * 2 - 1, random() * 2 - 1)),
      unlocatedCourier(99_999),
    ],
  };
}
