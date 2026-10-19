import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonAvailability,
  DeliveryPersonId,
  DeliveryPersonUnassigned,
  type Order,
  type OrderStatusValue,
} from '../../../domain';
import { availableCourier, buildOrderIn, COURIER_ID, LATER } from '../../../domain/order/testing/order.fixture';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ReleaseDeliveryPersonOrdersUseCase } from './release-delivery-person-orders.usecase';

const NOW = new Date('2025-01-20T15:45:00Z');
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

function courier(isActive: boolean, busy = false): DeliveryPersonAvailability {
  return DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(COURIER_ID),
    isActive,
    hasDeliveryInProgress: busy,
  });
}

function assignedOrderIn(status: OrderStatusValue, courierId = COURIER_ID): Order {
  const order = buildOrderIn(status);
  order.assignDeliveryPerson(availableCourier(courierId), LATER);
  return order;
}

describe('ReleaseDeliveryPersonOrdersUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let release: ReleaseDeliveryPersonOrdersUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    release = new ReleaseDeliveryPersonOrdersUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('entregador desativado: os pedidos que ainda não saíram voltam para a atribuição', async () => {
    const ready = assignedOrderIn('ready');
    const preparing = assignedOrderIn('preparing');
    const delivering = buildOrderIn('delivering');
    const otherCourier = assignedOrderIn('ready', OTHER_COURIER_ID);
    unitOfWork.givenOrders(ready, preparing, delivering, otherCourier);
    unitOfWork.givenDeliveryPersons(courier(false));

    const result = await release.execute({ deliveryPersonId: COURIER_ID });

    expect([...result.releasedOrderIds].sort()).toEqual([ready.id.value, preparing.id.value].sort());
    expect(unitOfWork.committedOrder(ready.id.value)?.deliveryPersonId).toBeNull();
    expect(unitOfWork.committedOrder(preparing.id.value)?.deliveryPersonId).toBeNull();
    // A entrega em andamento continua com ele; o pedido de outro entregador não muda.
    expect(unitOfWork.committedOrder(delivering.id.value)?.deliveryPersonId?.value).toBe(COURIER_ID);
    expect(unitOfWork.committedOrder(otherCourier.id.value)?.deliveryPersonId?.value).toBe(OTHER_COURIER_ID);
    expect(unitOfWork.publishedEvents).toHaveLength(2);
    expect(unitOfWork.publishedEvents.every((event) => event instanceof DeliveryPersonUnassigned)).toBe(true);
  });

  it('entregador removido (sem disponibilidade no Delivery) também libera os pedidos', async () => {
    const ready = assignedOrderIn('ready');
    unitOfWork.givenOrders(ready);
    unitOfWork.givenRemovedDeliveryPerson(COURIER_ID, 'Carlos Santos');

    const result = await release.execute({ deliveryPersonId: COURIER_ID });

    expect(result.releasedOrderIds).toEqual([ready.id.value]);
  });

  it.each([
    ['reativado depois da mensagem', courier(true)],
    ['ativo, mesmo ocupado com outra entrega', courier(true, true)],
  ])('%s: nada muda (quem decide é o estado atual)', async (_, availability) => {
    const ready = assignedOrderIn('ready');
    unitOfWork.givenOrders(ready);
    unitOfWork.givenDeliveryPersons(availability);

    const result = await release.execute({ deliveryPersonId: COURIER_ID });

    expect(result.releasedOrderIds).toEqual([]);
    expect(unitOfWork.committedOrder(ready.id.value)?.deliveryPersonId?.value).toBe(COURIER_ID);
    expect(unitOfWork.publishedEvents).toEqual([]);
  });

  it('trava os pedidos antes do entregador (mesma ordem do despacho)', async () => {
    const ready = assignedOrderIn('ready');
    unitOfWork.givenOrders(ready);
    unitOfWork.givenDeliveryPersons(courier(false));

    await release.execute({ deliveryPersonId: COURIER_ID });

    expect(unitOfWork.lockedOrderIds).toEqual([ready.id.value]);
    expect(unitOfWork.deliveryPersonLookups).toEqual([COURIER_ID]);
  });

  it('sem pedidos atribuídos, nem consulta o entregador', async () => {
    unitOfWork.givenDeliveryPersons(courier(false));

    expect(await release.execute({ deliveryPersonId: COURIER_ID })).toEqual({ releasedOrderIds: [] });
    expect(unitOfWork.deliveryPersonLookups).toEqual([]);
  });

  it('mensagem repetida não tem efeito', async () => {
    unitOfWork.givenOrders(assignedOrderIn('ready'));
    unitOfWork.givenDeliveryPersons(courier(false));

    await release.execute({ deliveryPersonId: COURIER_ID });
    const again = await release.execute({ deliveryPersonId: COURIER_ID });

    expect(again.releasedOrderIds).toEqual([]);
    expect(unitOfWork.publishedEvents).toHaveLength(1);
  });

  it('id inválido é recusado antes da transação', async () => {
    await expect(release.execute({ deliveryPersonId: 'x' })).rejects.toThrow(InputValidationError);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });
});
