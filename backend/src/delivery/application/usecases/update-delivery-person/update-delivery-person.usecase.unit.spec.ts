import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonActivationChanged,
  DeliveryPersonAlreadyRemovedError,
  DeliveryPersonNotFoundError,
  DeliveryPersonRelocated,
  DeliveryPersonUpdated,
  type DeliveryPerson,
} from '../../../domain';
import {
  buildDeliveryPerson,
  LATER,
  REGISTERED_AT,
} from '../../../domain/delivery-person/testing/delivery-person.fixture';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import { UpdateDeliveryPersonUseCase } from './update-delivery-person.usecase';

const NOW = new Date('2025-01-12T10:00:00Z');
const ORDER_ID = 'a1b2c3d4-0000-4000-8000-000000000042';
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

describe('UpdateDeliveryPersonUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let update: UpdateDeliveryPersonUseCase;
  let person: DeliveryPerson;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    update = new UpdateDeliveryPersonUseCase(unitOfWork, new FixedClock(NOW));
    person = buildDeliveryPerson();
    unitOfWork.givenDeliveryPersons(person);
  });

  it('altera só os campos enviados e trava o entregador', async () => {
    const updated = await update.execute({ id: person.id.value, phone: '(11) 98888-7777' });

    expect(updated).toMatchObject({
      name: 'Carlos Santos',
      phone: '(11) 98888-7777',
      vehicleType: 'motorcycle',
      isActive: true,
      updatedAt: NOW,
      createdAt: REGISTERED_AT,
    });
    expect(unitOfWork.lockedDeliveryPersonIds).toEqual([person.id.value]);
    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([DeliveryPersonUpdated]);
  });

  it('desativa e relocaliza, com um evento para cada mudança', async () => {
    const updated = await update.execute({
      id: person.id.value,
      isActive: false,
      currentLatitude: -23.6,
      currentLongitude: -46.7,
    });

    expect(updated).toMatchObject({ isActive: false, currentLatitude: -23.6, currentLongitude: -46.7 });
    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([
      DeliveryPersonActivationChanged,
      DeliveryPersonRelocated,
    ]);
  });

  it('as duas coordenadas nulas apagam a localização', async () => {
    const updated = await update.execute({
      id: person.id.value,
      currentLatitude: null,
      currentLongitude: null,
    });

    expect(updated).toMatchObject({ currentLatitude: null, currentLongitude: null });
  });

  it('sem mudanças reais, não publica evento nem altera updatedAt', async () => {
    const updated = await update.execute({ id: person.id.value, name: 'Carlos Santos', isActive: true });

    expect(updated.updatedAt).toEqual(REGISTERED_AT);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });

  it('devolve o pedido em andamento do entregador', async () => {
    unitOfWork.givenDeliveryInProgress(person, ORDER_ID);

    const updated = await update.execute({ id: person.id.value, isActive: false });

    expect(updated.currentOrderId).toBe(ORDER_ID);
  });

  it('rejeita entrada inválida e localização incompleta, sem abrir transação', async () => {
    const attempt = update.execute({ id: person.id.value, vehicleType: 'truck', currentLatitude: -23.5 });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'vehicleType', message: 'O tipo de veículo deve ser um de: bicycle, motorcycle, car' },
        { field: 'currentLongitude', message: expect.stringMatching(/juntas/) },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('404 para entregador inexistente ou removido', async () => {
    const removed = buildDeliveryPerson();
    removed.remove({ hasDeliveryInProgress: false, now: LATER });
    unitOfWork.givenDeliveryPersons(removed);

    await expect(update.execute({ id: UNKNOWN_ID, isActive: false })).rejects.toBeInstanceOf(
      DeliveryPersonNotFoundError,
    );
    await expect(update.execute({ id: removed.id.value, isActive: false })).rejects.toBeInstanceOf(
      DeliveryPersonNotFoundError,
    );
    // O agregado também protege a si mesmo, caso a leitura não filtrasse removidos.
    expect(() => removed.deactivate(NOW)).toThrow(DeliveryPersonAlreadyRemovedError);
  });

  it('é atômico: se o commit falhar, o entregador fica como estava', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(update.execute({ id: person.id.value, isActive: false })).rejects.toBe(databaseDown);

    expect(unitOfWork.committedDeliveryPerson(person.id.value)?.isActive).toBe(true);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
