import { beforeEach, describe, expect, it } from 'vitest';

import { FixedStopwatch } from '../../../../shared-kernel/application/testing/fixed-stopwatch';
import { PerformanceStopwatch } from '../../../../shared-kernel/infra/clock/performance-stopwatch';
import {
  DeliveryPersonId,
  DispatchableOrder,
  DispatchOptimizer,
  EARTH_RADIUS_KM,
  GeoPoint,
  OrderId,
  PersonName,
  type DeliveryPerson,
} from '../../../domain';
import { buildDeliveryPerson, LATER } from '../../../domain/delivery-person/testing/delivery-person.fixture';
import { bruteForceMinCost, seededRandom } from '../../../domain/dispatch/testing/brute-force';
import { orderAt, uuid } from '../../../domain/dispatch/testing/dispatch.fixture';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import { SuggestAssignmentUseCase } from './suggest-assignment.usecase';

/** Km por grau de longitude no equador. */
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Entregador sobre o equador, na longitude informada (`null` = sem localização). */
function courier(n: number, name: string, longitude: number | null): DeliveryPerson {
  return buildDeliveryPerson({
    id: DeliveryPersonId.from(uuid(n)),
    name: PersonName.create(name),
    location: longitude === null ? null : GeoPoint.create(0, longitude),
  });
}

describe('SuggestAssignmentUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let suggest: SuggestAssignmentUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    suggest = new SuggestAssignmentUseCase(unitOfWork, new DispatchOptimizer(), new FixedStopwatch(12.345));
  });

  it('caso com solução: minimiza a distância total (onde o guloso erraria) no formato da spec', async () => {
    // Entregadores em 1° e 4°; pedidos em 1,8° e 0°. Ótimo: 1,0° + 2,2° = 3,2°.
    unitOfWork.givenDeliveryPersons(courier(1, 'Carlos Santos', 1), courier(2, 'Ana Lima', 4));
    unitOfWork.givenReadyOrders(orderAt(11, 1.8), orderAt(12, 0));

    const suggestion = await suggest.execute();

    expect(suggestion).toEqual({
      assignments: [
        {
          orderId: uuid(11),
          deliveryPersonId: uuid(2),
          estimatedDistanceKm: round2(2.2 * KM_PER_DEGREE),
          orderAddress: 'Endereço do pedido 11',
          deliveryPersonName: 'Ana Lima',
        },
        {
          orderId: uuid(12),
          deliveryPersonId: uuid(1),
          estimatedDistanceKm: round2(1 * KM_PER_DEGREE),
          orderAddress: 'Endereço do pedido 12',
          deliveryPersonName: 'Carlos Santos',
        },
      ],
      unassigned: [],
      unlocatedDeliveryPersons: [],
      totalDistanceKm: round2(round2(2.2 * KM_PER_DEGREE) + round2(1 * KM_PER_DEGREE)),
      algorithm: 'hungarian',
      executionTimeMs: 12.35,
    });
  });

  it('o total é a soma das distâncias exibidas, sem erro de ponto flutuante', async () => {
    unitOfWork.givenDeliveryPersons(courier(1, 'Carlos Santos', 0), courier(2, 'Ana Lima', 10));
    unitOfWork.givenReadyOrders(orderAt(11, 0.0123), orderAt(12, 10.0456));

    const { assignments, totalDistanceKm } = await suggest.execute();

    const expectedCents = assignments.reduce((sum, a) => sum + Math.round(a.estimatedDistanceKm * 100), 0);
    expect(totalDistanceKm).toBe(expectedCents / 100);
  });

  it('sem entregadores disponíveis: todos os pedidos voltam em unassigned', async () => {
    unitOfWork.givenReadyOrders(orderAt(11, 1), orderAt(12, 2));

    const suggestion = await suggest.execute();

    expect(suggestion.assignments).toEqual([]);
    expect(suggestion.unassigned).toEqual([
      { orderId: uuid(11), orderAddress: 'Endereço do pedido 11', reason: 'No available delivery person' },
      { orderId: uuid(12), orderAddress: 'Endereço do pedido 12', reason: 'No available delivery person' },
    ]);
    expect(suggestion.totalDistanceKm).toBe(0);
  });

  it('sem pedidos prontos: resposta vazia', async () => {
    unitOfWork.givenDeliveryPersons(courier(1, 'Carlos Santos', 0));

    expect(await suggest.execute()).toEqual({
      assignments: [],
      unassigned: [],
      unlocatedDeliveryPersons: [],
      totalDistanceKm: 0,
      algorithm: 'hungarian',
      executionTimeMs: 12.35,
    });
  });

  it('com mais pedidos que entregadores, os excedentes ficam em unassigned', async () => {
    unitOfWork.givenDeliveryPersons(courier(1, 'Carlos Santos', 0));
    unitOfWork.givenReadyOrders(orderAt(11, 5), orderAt(12, 0.1), orderAt(13, 3));

    const suggestion = await suggest.execute();

    expect(suggestion.assignments.map((a) => [a.orderId, a.deliveryPersonId])).toEqual([[uuid(12), uuid(1)]]);
    expect(suggestion.unassigned.map((u) => u.orderId)).toEqual([uuid(11), uuid(13)]);
  });

  it('deixa de fora entregadores ocupados, inativos e removidos', async () => {
    const busy = courier(1, 'Ocupado', 0);
    const inactive = courier(2, 'Inativo', 0);
    inactive.deactivate(LATER);
    const removed = courier(3, 'Removido', 0);
    removed.remove({ hasDeliveryInProgress: false, now: LATER });
    const far = courier(4, 'Disponível Longe', 50);
    unitOfWork.givenDeliveryPersons(busy, inactive, removed, far);
    unitOfWork.givenDeliveryInProgress(busy);
    unitOfWork.givenReadyOrders(orderAt(11, 0));

    const suggestion = await suggest.execute();

    expect(suggestion.assignments.map((a) => a.deliveryPersonName)).toEqual(['Disponível Longe']);
  });

  it('entregador sem localização fica fora do cálculo e é reportado à parte', async () => {
    unitOfWork.givenDeliveryPersons(courier(1, 'Sem GPS', null), courier(2, 'Com GPS', 3));
    unitOfWork.givenReadyOrders(orderAt(11, 0), orderAt(12, 1));

    const suggestion = await suggest.execute();

    expect(suggestion.unlocatedDeliveryPersons).toEqual([{ id: uuid(1), name: 'Sem GPS' }]);
    expect(suggestion.assignments.map((a) => a.deliveryPersonName)).toEqual(['Com GPS']);
    expect(suggestion.unassigned).toHaveLength(1);
  });

  it('inclui pedidos ready que já têm entregador atribuído (o gestor pode redistribuir)', async () => {
    unitOfWork.givenDeliveryPersons(courier(1, 'Carlos Santos', 0));
    // O Ordering informa todos os `ready`, atribuídos ou não; o Delivery não filtra.
    unitOfWork.givenReadyOrders(orderAt(11, 1));

    expect((await suggest.execute()).assignments).toHaveLength(1);
  });

  it('é só uma proposta: não altera entregadores nem publica eventos', async () => {
    const person = courier(1, 'Carlos Santos', 0);
    unitOfWork.givenDeliveryPersons(person);
    unitOfWork.givenReadyOrders(orderAt(11, 1));
    const before = unitOfWork.committedDeliveryPerson(person.id.value)?.snapshot();

    await suggest.execute();

    expect(unitOfWork.committedDeliveryPerson(person.id.value)?.snapshot()).toEqual(before);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });

  it.each([1, 2, 3, 4, 5])(
    'a distância total é a ótima, conferida por força bruta (instância aleatória #%i)',
    async (seed) => {
      const random = seededRandom(seed);
      const people = Array.from({ length: 6 }, (_, i) => courier(i + 1, `Entregador ${i + 1}`, random() * 2));
      const orders = Array.from({ length: 5 }, (_, i) => orderAt(i + 11, random() * 2, random() * 2));
      unitOfWork.givenDeliveryPersons(...people);
      unitOfWork.givenReadyOrders(...orders);
      suggest = new SuggestAssignmentUseCase(unitOfWork, new DispatchOptimizer(), new FixedStopwatch(0));

      const suggestion = await suggest.execute();

      const cost = orders.map((order) =>
        people.map((person) => person.location?.distanceTo(order.location) ?? Number.NaN),
      );
      expect(suggestion.assignments).toHaveLength(5);
      // Arredondamento a 2 casas por atribuição: tolerância de 5 × 0,005 km.
      expect(Math.abs(suggestion.totalDistanceKm - bruteForceMinCost(cost))).toBeLessThanOrEqual(0.025);
    },
  );

  it('responde em < 2s com 50 pedidos e 30 entregadores (requisito do enunciado)', async () => {
    const random = seededRandom(42);
    // Região de São Paulo: ~±0,2° em torno do centro.
    const around = (center: number): number => center + (random() - 0.5) * 0.4;
    unitOfWork.givenDeliveryPersons(
      ...Array.from({ length: 30 }, (_, i) =>
        buildDeliveryPerson({
          id: DeliveryPersonId.from(uuid(i + 1)),
          name: PersonName.create(`Entregador ${i + 1}`),
          location: GeoPoint.create(around(-23.55), around(-46.63)),
        }),
      ),
    );
    unitOfWork.givenReadyOrders(
      ...Array.from({ length: 50 }, (_, i) =>
        DispatchableOrder.create({
          orderId: OrderId.from(uuid(i + 100)),
          deliveryAddress: `Rua ${i + 1}, São Paulo - SP`,
          location: GeoPoint.create(around(-23.55), around(-46.63)),
        }),
      ),
    );
    suggest = new SuggestAssignmentUseCase(unitOfWork, new DispatchOptimizer(), new PerformanceStopwatch());

    const startedAt = performance.now();
    const suggestion = await suggest.execute();
    const elapsedMs = performance.now() - startedAt;

    expect(suggestion.assignments).toHaveLength(30);
    expect(suggestion.unassigned).toHaveLength(20);
    expect(new Set(suggestion.assignments.map((a) => a.deliveryPersonId)).size).toBe(30);
    expect(suggestion.executionTimeMs).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
