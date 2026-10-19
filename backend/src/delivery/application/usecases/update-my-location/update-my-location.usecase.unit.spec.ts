import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { DeliveryPersonRelocated, UserAccountId } from '../../../domain';
import { buildDeliveryPerson } from '../../../domain/delivery-person/testing/delivery-person.fixture';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import { UpdateMyLocationUseCase } from './update-my-location.usecase';

const NOW = new Date('2025-01-12T10:00:00Z');
const MY_USER = '5d8f9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_USER = '6e9a0b2c-3d4e-4f5a-9b0c-1d2e3f4a5b6c';

describe('UpdateMyLocationUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let updateMyLocation: UpdateMyLocationUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    updateMyLocation = new UpdateMyLocationUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('o entregador do usuário logado muda de lugar (e só ele)', async () => {
    const me = buildDeliveryPerson({ userId: UserAccountId.from(MY_USER) });
    const other = buildDeliveryPerson({ userId: UserAccountId.from(OTHER_USER) });
    unitOfWork.givenDeliveryPersons(me, other);

    const updated = await updateMyLocation.execute({ userId: MY_USER, latitude: -23.5614, longitude: -46.6559 });

    expect(updated).toMatchObject({ id: me.id.value, currentLatitude: -23.5614, currentLongitude: -46.6559 });
    expect(unitOfWork.lockedDeliveryPersonIds).toEqual([me.id.value]);
    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([DeliveryPersonRelocated]);
    expect(unitOfWork.deliveryPersons.get(other.id.value)?.location).toEqual(other.location);
  });

  it('usuário sem entregador vinculado: DeliveryPersonNotLinkedError', async () => {
    unitOfWork.givenDeliveryPersons(buildDeliveryPerson());

    await expect(updateMyLocation.execute({ userId: MY_USER, latitude: 0, longitude: 0 })).rejects.toThrow(
      DeliveryPersonNotLinkedError,
    );
  });

  it('coordenada fora da faixa é recusada antes da transação', async () => {
    await expect(updateMyLocation.execute({ userId: MY_USER, latitude: 91, longitude: 0 })).rejects.toThrow(
      InputValidationError,
    );
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });
});
