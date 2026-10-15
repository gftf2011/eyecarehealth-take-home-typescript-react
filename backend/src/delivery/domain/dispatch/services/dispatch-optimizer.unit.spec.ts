import { describe, expect, it } from 'vitest';

import {
  DeliveryPersonId,
  DispatchableOrder,
  DispatchCandidate,
  EARTH_RADIUS_KM,
  GeoPoint,
  OrderId,
  type AssignmentPlan,
} from '../../index.js';
import { bruteForceMinCost, seededRandom } from '../testing/brute-force.js';
import { courierAt, orderAt, unlocatedCourier, uuid } from '../testing/dispatch.fixture.js';
import { DispatchOptimizer } from './dispatch-optimizer.js';

/** Km por grau de longitude no equador. */
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;

function pairs(plan: AssignmentPlan): [string, string][] {
  return plan.assignments.map((a) => [a.orderId.value, a.deliveryPersonId.value]);
}

describe('DispatchOptimizer', () => {
  const optimizer = new DispatchOptimizer();

  it('minimiza a distância total onde a escolha gulosa falharia', () => {
    // Entregadores em 1° e 4°; pedidos em 1,8° e 0°.
    // Guloso: pedido(1,8°)→1° [0,8] e sobra pedido(0°)→4° [4,0] = 4,8°.
    // Ótimo:  pedido(0°)→1° [1,0] + pedido(1,8°)→4° [2,2]      = 3,2°.
    const plan = optimizer.plan(
      [orderAt(11, 1.8), orderAt(12, 0)],
      [courierAt(1, 1), courierAt(2, 4)],
    );

    expect(pairs(plan)).toEqual([
      [uuid(11), uuid(2)],
      [uuid(12), uuid(1)],
    ]);
    expect(plan.totalDistanceKm).toBeCloseTo(3.2 * KM_PER_DEGREE, 6);
    expect(plan.assignments[0]?.distanceKm).toBeCloseTo(2.2 * KM_PER_DEGREE, 6);
    expect(plan.unassigned).toEqual([]);
    expect(plan.algorithm).toBe('hungarian');
  });

  it('com mais pedidos que entregadores, devolve os excedentes como unassigned', () => {
    const plan = optimizer.plan(
      [orderAt(11, 0.1), orderAt(12, 5), orderAt(13, 0.2)],
      [courierAt(1, 0)],
    );

    expect(pairs(plan)).toEqual([[uuid(11), uuid(1)]]);
    expect(plan.unassigned.map((u) => [u.orderId.value, u.reason])).toEqual([
      [uuid(12), 'NO_AVAILABLE_DELIVERY_PERSON'],
      [uuid(13), 'NO_AVAILABLE_DELIVERY_PERSON'],
    ]);
  });

  it('com mais entregadores que pedidos, deixa os excedentes livres', () => {
    const plan = optimizer.plan([orderAt(11, 9)], [courierAt(1, 0), courierAt(2, 10)]);

    expect(pairs(plan)).toEqual([[uuid(11), uuid(2)]]);
    expect(plan.unassigned).toEqual([]);
  });

  it('sem entregadores disponíveis, todos os pedidos ficam unassigned', () => {
    const plan = optimizer.plan([orderAt(11, 0), orderAt(12, 1)], []);

    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned).toHaveLength(2);
    expect(plan.totalDistanceKm).toBe(0);
  });

  it('sem pedidos prontos, devolve plano vazio', () => {
    const plan = optimizer.plan([], [courierAt(1, 0)]);

    expect(plan.isEmpty).toBe(true);
    expect(plan.totalDistanceKm).toBe(0);
  });

  it('ignora entregadores sem localização e os reporta', () => {
    const plan = optimizer.plan([orderAt(11, 0)], [unlocatedCourier(1), courierAt(2, 3)]);

    expect(pairs(plan)).toEqual([[uuid(11), uuid(2)]]);
    expect(plan.unlocatedDeliveryPersonIds.map((id) => id.value)).toEqual([uuid(1)]);
  });

  it('só com entregadores sem localização, nenhum pedido é atribuído', () => {
    const plan = optimizer.plan([orderAt(11, 0)], [unlocatedCourier(1)]);

    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned).toHaveLength(1);
  });

  it('é determinístico: a ordem da entrada não muda o plano (inclusive em empates)', () => {
    // Dois entregadores equidistantes de dois pedidos: qualquer combinação empata.
    const orders = [orderAt(11, 1), orderAt(12, 1), orderAt(13, 7)];
    const couriers = [courierAt(1, 0), courierAt(2, 2), courierAt(3, 6)];

    const plan = optimizer.plan(orders, couriers);
    const reversed = optimizer.plan([...orders].reverse(), [...couriers].reverse());

    expect(pairs(reversed)).toEqual(pairs(plan));
  });

  describe('contra força bruta com coordenadas reais de São Paulo', () => {
    const random = seededRandom(42);
    const aroundSaoPaulo = (): GeoPoint =>
      GeoPoint.create(-23.55 + (random() - 0.5) * 0.2, -46.63 + (random() - 0.5) * 0.2);

    const cases = Array.from({ length: 100 }, (_, caseIndex) => {
      const orderCount = 1 + Math.floor(random() * 6);
      const courierCount = 1 + Math.floor(random() * 6);
      const orders = Array.from({ length: orderCount }, (__, i) =>
        DispatchableOrder.create({
          orderId: OrderId.from(uuid(caseIndex * 100 + i)),
          deliveryAddress: 'Rua Teste, 100, Sao Paulo',
          location: aroundSaoPaulo(),
        }),
      );
      const couriers = Array.from({ length: courierCount }, (__, i) =>
        DispatchCandidate.create({
          deliveryPersonId: DeliveryPersonId.from(uuid(caseIndex * 100 + 50 + i)),
          location: aroundSaoPaulo(),
        }),
      );
      return { orders, couriers };
    });

    it('encontra a soma mínima de distâncias em 100 cenários de até 6×6', () => {
      for (const { orders, couriers } of cases) {
        const plan = optimizer.plan(orders, couriers);

        const distances = orders.map((order) =>
          couriers.map((courier) => courier.location?.distanceTo(order.location) ?? Number.NaN),
        );
        const matrix =
          orders.length <= couriers.length
            ? distances
            : couriers.map((_, c) => orders.map((__, o) => distances[o]?.[c] ?? Number.NaN));

        expect(plan.assignments).toHaveLength(Math.min(orders.length, couriers.length));
        expect(plan.unassigned).toHaveLength(Math.max(0, orders.length - couriers.length));
        expect(new Set(plan.assignments.map((a) => a.deliveryPersonId.value)).size).toBe(
          plan.assignments.length,
        );
        expect(plan.totalDistanceKm).toBeCloseTo(bruteForceMinCost(matrix), 9);
      }
    });
  });

  it('resolve 50 pedidos × 30 entregadores bem abaixo do limite de 2s', () => {
    const random = seededRandom(7);
    const point = (): [number, number] => [
      -23.55 + (random() - 0.5) * 0.3,
      -46.63 + (random() - 0.5) * 0.3,
    ];
    const orders = Array.from({ length: 50 }, (_, i) => {
      const [lat, lng] = point();
      return orderAt(1000 + i, lng, lat);
    });
    const couriers = Array.from({ length: 30 }, (_, i) => {
      const [lat, lng] = point();
      return courierAt(i + 1, lng, lat);
    });

    const startedAt = performance.now();
    const plan = optimizer.plan(orders, couriers);
    const elapsedMs = performance.now() - startedAt;

    expect(plan.assignments).toHaveLength(30);
    expect(plan.unassigned).toHaveLength(20);
    expect(elapsedMs).toBeLessThan(200);
  });
});
