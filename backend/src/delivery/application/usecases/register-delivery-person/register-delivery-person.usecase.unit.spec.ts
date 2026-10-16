import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { DeliveryPersonRegistered } from '../../../domain';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import {
  RegisterDeliveryPersonUseCase,
  type RegisterDeliveryPersonInput,
} from './register-delivery-person.usecase';

const NOW = new Date('2025-01-10T09:00:00Z');

const validInput: RegisterDeliveryPersonInput = {
  name: 'Carlos Santos',
  phone: '(11) 91234-5678',
  vehicleType: 'motorcycle',
  currentLatitude: -23.5489,
  currentLongitude: -46.6388,
};

describe('RegisterDeliveryPersonUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let register: RegisterDeliveryPersonUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    register = new RegisterDeliveryPersonUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('cadastra o entregador ativo e devolve o DTO de saída', async () => {
    const person = await register.execute(validInput);

    expect(person).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Carlos Santos',
      phone: '(11) 91234-5678',
      vehicleType: 'motorcycle',
      isActive: true,
      currentLatitude: -23.5489,
      currentLongitude: -46.6388,
      currentOrderId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(unitOfWork.committedDeliveryPerson(person.id)?.name.value).toBe('Carlos Santos');
  });

  it('publica DeliveryPersonRegistered ao confirmar a transação', async () => {
    const person = await register.execute(validInput);

    expect(unitOfWork.publishedEvents).toHaveLength(1);
    expect(unitOfWork.publishedEvents[0]).toBeInstanceOf(DeliveryPersonRegistered);
    expect(unitOfWork.publishedEvents[0]?.aggregateId).toBe(person.id);
  });

  it.each([
    ['ausente', {}],
    ['nula', { currentLatitude: null, currentLongitude: null }],
  ])('aceita localização %s (posição desconhecida)', async (_label, location) => {
    const { currentLatitude: _lat, currentLongitude: _lng, ...withoutLocation } = validInput;

    const person = await register.execute({ ...withoutLocation, ...location });

    expect(person).toMatchObject({ currentLatitude: null, currentLongitude: null });
  });

  it('respeita isActive = false', async () => {
    expect((await register.execute({ ...validInput, isActive: false })).isActive).toBe(false);
  });

  it('rejeita entrada inválida listando todos os campos, sem abrir transação', async () => {
    const attempt = register.execute({
      name: 'Jo',
      phone: '11912345678',
      vehicleType: 'truck',
      currentLatitude: -91,
      currentLongitude: -46.6,
    });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'name', message: 'O nome deve ter entre 3 e 100 caracteres' },
        { field: 'phone', message: 'O telefone deve estar no formato (XX) XXXXX-XXXX' },
        { field: 'vehicleType', message: 'O tipo de veículo deve ser um de: bicycle, motorcycle, car' },
        { field: 'currentLatitude', message: 'A latitude deve estar entre -90 e 90' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it.each([
    [{ currentLatitude: -23.5 }, 'currentLongitude'],
    [{ currentLongitude: -46.6 }, 'currentLatitude'],
    [{ currentLatitude: -23.5, currentLongitude: null }, 'currentLongitude'],
  ])('rejeita localização incompleta %j apontando a coordenada que falta', async (location, field) => {
    const { currentLatitude: _lat, currentLongitude: _lng, ...withoutLocation } = validInput;

    await expect(register.execute({ ...withoutLocation, ...location })).rejects.toMatchObject({
      details: [{ field, message: expect.stringMatching(/latitude e longitude juntas/) }],
    });
  });

  it('é atômico: se o commit falhar, nada é gravado nem publicado', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(register.execute(validInput)).rejects.toBe(databaseDown);

    expect(unitOfWork.deliveryPersons.size).toBe(0);
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
