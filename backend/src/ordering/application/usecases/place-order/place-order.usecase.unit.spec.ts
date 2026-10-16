import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { OrderPlaced, UnavailableProductError } from '../../../domain';
import {
  BURGER_ID,
  JUICE_ID,
  PLACED_AT,
  productSnapshot,
} from '../../../domain/order/testing/order.fixture';
import { UnknownProductsError } from '../../errors/unknown-products.error';
import { MAX_ORDER_ITEMS } from '../../inputs/order-items.input';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { PlaceOrderUseCase, type PlaceOrderInput } from './place-order.usecase';

const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';
const OTHER_UNKNOWN_ID = 'deadbeef-1234-4abc-8def-0123456789ab';

const validInput: PlaceOrderInput = {
  customerName: 'Maria Oliveira',
  customerPhone: '(21) 98765-4321',
  deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
  latitude: -22.9068,
  longitude: -43.1729,
  items: [
    { productId: BURGER_ID, quantity: 2 },
    { productId: JUICE_ID, quantity: 1 },
  ],
};

describe('PlaceOrderUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let placeOrder: PlaceOrderUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.givenCatalogProducts(
      productSnapshot({ id: BURGER_ID, name: 'X-Burger Especial', price: 32.9 }),
      productSnapshot({ id: JUICE_ID, name: 'Suco de Laranja', price: 12.5 }),
    );
    placeOrder = new PlaceOrderUseCase(unitOfWork, new FixedClock(PLACED_AT));
  });

  it('registra o pedido pending com o total calculado a partir dos preços do Catalog', async () => {
    const order = await placeOrder.execute(validInput);

    expect(order).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      customerName: 'Maria Oliveira',
      customerPhone: '(21) 98765-4321',
      deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
      latitude: -22.9068,
      longitude: -43.1729,
      status: 'pending',
      totalAmount: 78.3,
      deliveryPersonId: null,
      items: [
        {
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          product: { id: BURGER_ID, name: 'X-Burger Especial' },
          quantity: 2,
          unitPrice: 32.9,
        },
        {
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          product: { id: JUICE_ID, name: 'Suco de Laranja' },
          quantity: 1,
          unitPrice: 12.5,
        },
      ],
      createdAt: PLACED_AT,
      updatedAt: PLACED_AT,
    });
    expect(unitOfWork.committedOrder(order.id)?.status.value).toBe('pending');
  });

  it('congela o preço vigente: reajuste posterior no Catalog não altera o pedido', async () => {
    const order = await placeOrder.execute(validInput);
    unitOfWork.givenCatalogProducts(productSnapshot({ id: BURGER_ID, price: 35 }));

    const stored = unitOfWork.committedOrder(order.id);
    expect(stored?.items[0]?.unitPrice.toDecimal()).toBe(32.9);
    expect(stored?.totalAmount.toDecimal()).toBe(78.3);
  });

  it('grava o evento OrderPlaced no outbox na mesma transação', async () => {
    const order = await placeOrder.execute(validInput);

    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.outbox).toHaveLength(1);
    expect(unitOfWork.outbox[0]).toBeInstanceOf(OrderPlaced);
    expect(unitOfWork.outbox[0]?.aggregateId).toBe(order.id);
    expect(unitOfWork.outbox[0]?.payload).toMatchObject({ totalAmountCents: 7830 });
  });

  it('une itens repetidos em uma linha e consulta o Catalog uma vez por produto', async () => {
    const order = await placeOrder.execute({
      ...validInput,
      items: [
        { productId: BURGER_ID, quantity: 1 },
        { productId: JUICE_ID, quantity: 1 },
        { productId: BURGER_ID.toUpperCase(), quantity: 2 },
      ],
    });

    expect(unitOfWork.catalogLookups).toEqual([[BURGER_ID, JUICE_ID]]);
    expect(order.items.map((item) => [item.product.id, item.quantity])).toEqual([
      [BURGER_ID, 3],
      [JUICE_ID, 1],
    ]);
    expect(order.totalAmount).toBe(111.2);
  });

  it('rejeita produto indisponível sem gravar nada', async () => {
    unitOfWork.givenCatalogProducts(
      productSnapshot({ id: JUICE_ID, name: 'Suco de Laranja', price: 12.5, isAvailable: false }),
    );

    const attempt = placeOrder.execute(validInput);

    await expect(attempt).rejects.toBeInstanceOf(UnavailableProductError);
    await expect(attempt).rejects.toMatchObject({
      code: 'UNAVAILABLE_PRODUCT',
      details: [{ productId: JUICE_ID, productName: 'Suco de Laranja', reason: 'Produto indisponível' }],
    });
    expect(unitOfWork.rollbacks).toBe(1);
    expect(unitOfWork.orders.size).toBe(0);
    expect(unitOfWork.outbox).toHaveLength(0);
  });

  it('rejeita produtos inexistentes ou removidos listando todos de uma vez', async () => {
    const attempt = placeOrder.execute({
      ...validInput,
      items: [
        { productId: UNKNOWN_ID, quantity: 1 },
        { productId: BURGER_ID, quantity: 1 },
        { productId: OTHER_UNKNOWN_ID, quantity: 1 },
      ],
    });

    await expect(attempt).rejects.toBeInstanceOf(UnknownProductsError);
    await expect(attempt).rejects.toMatchObject({
      code: 'UNAVAILABLE_PRODUCT',
      details: [
        { productId: UNKNOWN_ID, productName: null, reason: 'Produto não encontrado' },
        { productId: OTHER_UNKNOWN_ID, productName: null, reason: 'Produto não encontrado' },
      ],
    });
    expect(unitOfWork.orders.size).toBe(0);
  });

  it('rejeita entrada inválida listando todos os campos (itens com índice), sem abrir transação', async () => {
    const attempt = placeOrder.execute({
      customerName: 'Jo',
      customerPhone: '11999991234',
      deliveryAddress: 'Rua A',
      latitude: -91,
      longitude: -43.1729,
      items: [
        { productId: BURGER_ID, quantity: 1 },
        { productId: 'not-a-uuid', quantity: 0 },
      ],
    });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'customerName', message: 'O nome do cliente deve ter entre 3 e 100 caracteres' },
        { field: 'customerPhone', message: 'O telefone deve estar no formato (XX) XXXXX-XXXX' },
        { field: 'deliveryAddress', message: 'O endereço de entrega deve ter entre 10 e 300 caracteres' },
        { field: 'latitude', message: 'A latitude deve estar entre -90 e 90' },
        { field: 'items.1.productId', message: "O identificador 'not-a-uuid' não é um UUID válido" },
        { field: 'items.1.quantity', message: 'A quantidade deve ser um inteiro maior que zero' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
    expect(unitOfWork.catalogLookups).toHaveLength(0);
  });

  it.each([
    { label: 'sem itens', items: [], message: 'O pedido deve ter pelo menos um item' },
    {
      label: `com mais de ${MAX_ORDER_ITEMS} itens`,
      items: Array.from({ length: MAX_ORDER_ITEMS + 1 }, () => ({ productId: BURGER_ID, quantity: 1 })),
      message: `O pedido deve ter no máximo ${MAX_ORDER_ITEMS} itens`,
    },
  ])('rejeita pedido $label', async ({ items, message }) => {
    await expect(placeOrder.execute({ ...validInput, items })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'items', message }],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, nem o pedido nem o evento são gravados', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(placeOrder.execute(validInput)).rejects.toBe(databaseDown);

    expect(unitOfWork.rollbacks).toBe(1);
    expect(unitOfWork.orders.size).toBe(0);
    expect(unitOfWork.outbox).toHaveLength(0);
  });
});
