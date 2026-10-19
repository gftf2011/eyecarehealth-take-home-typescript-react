import { describe, expect, it } from 'vitest';

import { availableCourier, buildOrderIn, COURIER_ID, LATER } from '../../../domain/order/testing/order.fixture';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { GetMyDeliveriesUseCase } from './get-my-deliveries.usecase';

const MY_USER = '5d8f9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('GetMyDeliveriesUseCase', () => {
  it('separa a entrega em andamento das próximas, só com os pedidos do entregador logado', async () => {
    const unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    unitOfWork.linkDeliveryPersonToUser(COURIER_ID, MY_USER);
    const delivering = buildOrderIn('delivering');
    const next = buildOrderIn('ready');
    next.assignDeliveryPerson(availableCourier(), LATER);
    const others = buildOrderIn('ready');
    others.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER);
    const finished = buildOrderIn('delivered');
    unitOfWork.givenOrders(delivering, next, others, finished);

    const mine = await new GetMyDeliveriesUseCase(unitOfWork).execute({ userId: MY_USER });

    expect(mine.deliveryPerson).toEqual({ id: COURIER_ID, name: 'Carlos Santos' });
    expect(mine.inProgress?.id).toBe(delivering.id.value);
    expect(mine.upcoming.map((order) => order.id)).toEqual([next.id.value]);
  });

  it('usuário sem entregador vinculado: DeliveryPersonNotLinkedError', async () => {
    await expect(new GetMyDeliveriesUseCase(new InMemoryOrderingUnitOfWork()).execute({ userId: MY_USER })).rejects.toThrow(
      DeliveryPersonNotLinkedError,
    );
  });
});
