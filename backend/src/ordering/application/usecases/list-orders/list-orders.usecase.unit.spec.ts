import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { OrderStatus, Quantity, type Order } from '../../../domain';
import {
  availableCourier,
  buildOrder,
  COURIER_ID,
  productSnapshot,
} from '../../../domain/order/testing/order.fixture';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ListOrdersUseCase } from './list-orders.usecase';

const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

/** Pedido criado em `createdAt` com um único item de `total` reais. */
function orderAt(createdAt: string, total = 30): Order {
  return buildOrder({
    now: new Date(createdAt),
    items: [{ product: productSnapshot({ price: total }), quantity: Quantity.of(1) }],
  });
}

function ids(orders: readonly { id: string }[]): string[] {
  return orders.map((order) => order.id);
}

describe('ListOrdersUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let listOrders: ListOrdersUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    listOrders = new ListOrdersUseCase(unitOfWork);
  });

  it('por padrão traz a página 1 com 20 itens, mais recentes primeiro', async () => {
    const orders = Array.from({ length: 25 }, (_, index) =>
      orderAt(`2025-01-20T10:${index.toString().padStart(2, '0')}:00Z`),
    );
    unitOfWork.givenOrders(...orders);

    const page = await listOrders.execute({});

    expect(page.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
    expect(page.data[0]?.id).toBe(orders[24]?.id.value);
    expect(page.data).toHaveLength(20);
  });

  it('pagina com page e limit', async () => {
    const orders = ['10:00', '11:00', '12:00', '13:00', '14:00'].map((time) =>
      orderAt(`2025-01-20T${time}:00Z`),
    );
    unitOfWork.givenOrders(...orders);

    const page = await listOrders.execute({ page: 2, limit: 2, sortOrder: 'asc' });

    expect(ids(page.data)).toEqual([orders[2]?.id.value, orders[3]?.id.value]);
    expect(page.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('filtra por status', async () => {
    const pending = orderAt('2025-01-20T10:00:00Z');
    const cancelled = orderAt('2025-01-20T11:00:00Z');
    cancelled.changeStatus(OrderStatus.of('cancelled'), new Date('2025-01-20T11:30:00Z'));
    unitOfWork.givenOrders(pending, cancelled);

    const page = await listOrders.execute({ status: 'cancelled' });

    expect(ids(page.data)).toEqual([cancelled.id.value]);
  });

  it('filtra pelo dia de criação no fuso de São Paulo, com as duas pontas inclusivas', async () => {
    // 19/01 23:30 em São Paulo (UTC−3): fora.
    const beforeStart = orderAt('2025-01-20T02:30:00Z');
    // 20/01 00:00 local: primeiro instante dentro.
    const firstIn = orderAt('2025-01-20T03:00:00Z');
    // 21/01 23:59 local: último dia, dentro.
    const lastIn = orderAt('2025-01-22T02:59:00Z');
    // 22/01 00:00 local: fora.
    const afterEnd = orderAt('2025-01-22T03:00:00Z');
    unitOfWork.givenOrders(beforeStart, firstIn, lastIn, afterEnd);

    const page = await listOrders.execute({ startDate: '2025-01-20', endDate: '2025-01-21' });

    expect(ids(page.data)).toEqual([lastIn.id.value, firstIn.id.value]);
  });

  it('aceita período aberto em uma das pontas', async () => {
    const old = orderAt('2025-01-10T12:00:00Z');
    const recent = orderAt('2025-01-25T12:00:00Z');
    unitOfWork.givenOrders(old, recent);

    expect(ids((await listOrders.execute({ startDate: '2025-01-20' })).data)).toEqual([recent.id.value]);
    expect(ids((await listOrders.execute({ endDate: '2025-01-20' })).data)).toEqual([old.id.value]);
  });

  it('ordena por totalAmount, com desempate estável pelo ID', async () => {
    const cheap = orderAt('2025-01-20T10:00:00Z', 10);
    const expensive = orderAt('2025-01-20T11:00:00Z', 99.9);
    const tieA = orderAt('2025-01-20T12:00:00Z', 50);
    const tieB = orderAt('2025-01-20T13:00:00Z', 50);
    unitOfWork.givenOrders(cheap, expensive, tieA, tieB);

    const page = await listOrders.execute({ sortBy: 'totalAmount', sortOrder: 'asc' });

    const ties = [tieA.id.value, tieB.id.value].sort();
    expect(ids(page.data)).toEqual([cheap.id.value, ...ties, expensive.id.value]);
  });

  it('busca os entregadores da página em uma única consulta, sem repetir IDs', async () => {
    const first = orderAt('2025-01-20T10:00:00Z');
    const second = orderAt('2025-01-20T11:00:00Z');
    const third = orderAt('2025-01-20T12:00:00Z');
    const unassigned = orderAt('2025-01-20T13:00:00Z');
    first.assignDeliveryPerson(availableCourier(), new Date('2025-01-20T10:05:00Z'));
    second.assignDeliveryPerson(availableCourier(), new Date('2025-01-20T11:05:00Z'));
    third.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), new Date('2025-01-20T12:05:00Z'));
    unitOfWork.givenOrders(first, second, third, unassigned);
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    unitOfWork.givenRemovedDeliveryPerson(OTHER_COURIER_ID, 'Ana Lima');

    const page = await listOrders.execute({ sortOrder: 'asc' });

    expect(page.data.map((order) => order.deliveryPerson?.name ?? null)).toEqual([
      'Carlos Santos',
      'Carlos Santos',
      'Ana Lima',
      null,
    ]);
    expect(unitOfWork.deliveryPersonSummaryLookups).toEqual([[COURIER_ID, OTHER_COURIER_ID]]);
    expect(unitOfWork.lockedOrderIds).toHaveLength(0);
  });

  it('não consulta o Delivery quando nenhum pedido da página tem entregador', async () => {
    unitOfWork.givenOrders(orderAt('2025-01-20T10:00:00Z'));

    await listOrders.execute({});

    expect(unitOfWork.deliveryPersonSummaryLookups).toHaveLength(0);
  });

  it('lista vazia devolve página vazia', async () => {
    const page = await listOrders.execute({});

    expect(page).toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('rejeita parâmetros inválidos listando todos, sem abrir transação', async () => {
    const attempt = listOrders.execute({
      page: 0,
      limit: 101,
      status: 'shipped',
      startDate: '2025-02-30',
      endDate: '20-01-2025',
      sortBy: 'customerName',
      sortOrder: 'up',
    });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'page', message: 'A página deve ser um inteiro maior ou igual a 1' },
        { field: 'limit', message: 'O limite deve ser um inteiro entre 1 e 100' },
        {
          field: 'status',
          message: 'O status deve ser um de: pending, preparing, ready, delivering, delivered, cancelled',
        },
        { field: 'startDate', message: "A data '2025-02-30' deve ser válida e estar no formato YYYY-MM-DD" },
        { field: 'endDate', message: "A data '20-01-2025' deve ser válida e estar no formato YYYY-MM-DD" },
        { field: 'sortBy', message: 'O valor deve ser um de: createdAt, totalAmount' },
        { field: 'sortOrder', message: 'O valor deve ser um de: asc, desc' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('rejeita data fim anterior à data início', async () => {
    await expect(
      listOrders.execute({ startDate: '2025-01-21', endDate: '2025-01-20' }),
    ).rejects.toMatchObject({
      details: [{ field: 'endDate', message: 'A data fim deve ser igual ou posterior à data início' }],
    });
  });
});
