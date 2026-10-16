import { beforeEach, describe, expect, it } from 'vitest';

import { PersonName, type DeliveryPerson } from '../../../domain';
import {
  buildDeliveryPerson,
  LATER,
} from '../../../domain/delivery-person/testing/delivery-person.fixture';
import { InMemoryDeliveryUnitOfWork } from '../../testing/in-memory-delivery-unit-of-work';
import { ListDeliveryPersonsUseCase } from './list-delivery-persons.usecase';

const ORDER_ID = 'a1b2c3d4-0000-4000-8000-000000000042';

function named(name: string): DeliveryPerson {
  return buildDeliveryPerson({ name: PersonName.create(name) });
}

describe('ListDeliveryPersonsUseCase', () => {
  let unitOfWork: InMemoryDeliveryUnitOfWork;
  let list: ListDeliveryPersonsUseCase;
  let busy: DeliveryPerson;
  let free: DeliveryPerson;
  let inactive: DeliveryPerson;

  beforeEach(() => {
    unitOfWork = new InMemoryDeliveryUnitOfWork();
    list = new ListDeliveryPersonsUseCase(unitOfWork);

    busy = named('Bruno Ocupado');
    free = named('Ana Livre');
    inactive = named('Carla Inativa');
    inactive.deactivate(LATER);
    const removed = named('Daniel Removido');
    removed.remove({ hasDeliveryInProgress: false, now: LATER });
    unitOfWork.givenDeliveryPersons(busy, free, inactive, removed);
    unitOfWork.givenDeliveryInProgress(busy, ORDER_ID);
  });

  const names = (data: readonly { name: string }[]): string[] => data.map((person) => person.name);

  it('lista todos os não removidos, por nome, com o pedido em andamento de cada um', async () => {
    const { data } = await list.execute({});

    expect(names(data)).toEqual(['Ana Livre', 'Bruno Ocupado', 'Carla Inativa']);
    expect(data.map((person) => person.currentOrderId)).toEqual([null, ORDER_ID, null]);
  });

  it('filtra por isActive', async () => {
    expect(names((await list.execute({ isActive: true })).data)).toEqual(['Ana Livre', 'Bruno Ocupado']);
    expect(names((await list.execute({ isActive: false })).data)).toEqual(['Carla Inativa']);
  });

  it('available=true traz só quem não tem pedido delivering; false, só quem tem', async () => {
    expect(names((await list.execute({ available: true })).data)).toEqual(['Ana Livre', 'Carla Inativa']);
    expect(names((await list.execute({ available: false })).data)).toEqual(['Bruno Ocupado']);
  });

  it('combina os filtros: ativos e disponíveis (os candidatos à atribuição)', async () => {
    expect(names((await list.execute({ isActive: true, available: true })).data)).toEqual(['Ana Livre']);
  });

  it('não trava nada', async () => {
    await list.execute({});

    expect(unitOfWork.lockedDeliveryPersonIds).toHaveLength(0);
  });
});
