import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonInUseError,
  DeliveryPersonNotFoundError,
  DeliveryPersonRemoved,
  type DeliveryPerson,
} from '../../../domain';
import { buildDeliveryPerson } from '../../../domain/delivery-person/testing/delivery-person.fixture';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import { RemoveDeliveryPersonUseCase } from './remove-delivery-person.usecase';

const NOW = new Date('2025-01-12T10:00:00Z');
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

describe('RemoveDeliveryPersonUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let remove: RemoveDeliveryPersonUseCase;
  let person: DeliveryPerson;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    remove = new RemoveDeliveryPersonUseCase(unitOfWork, new FixedClock(NOW));
    person = buildDeliveryPerson();
    unitOfWork.givenDeliveryPersons(person);
  });

  it('faz soft delete, trava o entregador e publica DeliveryPersonRemoved', async () => {
    await remove.execute({ id: person.id.value });

    expect(unitOfWork.committedDeliveryPerson(person.id.value)?.removedAt).toEqual(NOW);
    expect(unitOfWork.lockedDeliveryPersonIds).toEqual([person.id.value]);
    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([DeliveryPersonRemoved]);
  });

  it('409 DELIVERY_PERSON_IN_USE com pedido delivering, sem remover', async () => {
    unitOfWork.givenDeliveryInProgress(person);

    const attempt = remove.execute({ id: person.id.value });

    await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonInUseError);
    await expect(attempt).rejects.toMatchObject({
      code: 'DELIVERY_PERSON_IN_USE',
      details: [{ deliveryPersonId: person.id.value }],
    });
    expect(unitOfWork.committedDeliveryPerson(person.id.value)?.isRemoved).toBe(false);
  });

  it('404 para entregador inexistente ou já removido', async () => {
    await remove.execute({ id: person.id.value });

    await expect(remove.execute({ id: person.id.value })).rejects.toBeInstanceOf(DeliveryPersonNotFoundError);
    await expect(remove.execute({ id: UNKNOWN_ID })).rejects.toBeInstanceOf(DeliveryPersonNotFoundError);
  });

  it('rejeita ID inválido sem abrir transação', async () => {
    await expect(remove.execute({ id: 'abc' })).rejects.toBeInstanceOf(InputValidationError);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o entregador continua ativo', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(remove.execute({ id: person.id.value })).rejects.toBe(databaseDown);

    expect(unitOfWork.committedDeliveryPerson(person.id.value)?.isRemoved).toBe(false);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
