import { describe, expect, it } from 'vitest';

import {
  InvalidStatusTransitionError,
  ORDER_STATUSES,
  OrderStatus,
  OrderStatusChanged,
  type OrderStatusValue,
} from '../index';
import { availableCourier, buildOrderIn, LATER } from './testing/order.fixture';

/** Tabela do enunciado: qualquer par fora dela deve ser rejeitado. */
const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  'pending→preparing',
  'pending→cancelled',
  'preparing→ready',
  'preparing→cancelled',
  'ready→delivering',
  'ready→cancelled',
  'delivering→delivered',
]);

const ALL_PAIRS = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.map((to): [OrderStatusValue, OrderStatusValue] => [from, to]),
);
const validPairs = ALL_PAIRS.filter(([from, to]) => VALID_TRANSITIONS.has(`${from}→${to}`));
const invalidPairs = ALL_PAIRS.filter(([from, to]) => !VALID_TRANSITIONS.has(`${from}→${to}`));

describe('Order — máquina de estados', () => {
  it('cobre as 36 combinações de status (7 válidas, 29 inválidas)', () => {
    expect(validPairs).toHaveLength(7);
    expect(invalidPairs).toHaveLength(29);
  });

  it.each(validPairs)('permite %s → %s', (from, to) => {
    const order = buildOrderIn(from);
    if (to === 'delivering') {
      order.assignDeliveryPerson(availableCourier(), LATER);
      order.pullDomainEvents();
      order.dispatch(availableCourier(), LATER);
    } else {
      order.changeStatus(OrderStatus.of(to), LATER);
    }

    expect(order.status.value).toBe(to);
    const [event] = order.pullDomainEvents();
    expect(event).toBeInstanceOf(OrderStatusChanged);
    expect(event?.payload).toMatchObject({ from, to });
  });

  it.each(invalidPairs)('rejeita %s → %s com INVALID_STATUS_TRANSITION', (from, to) => {
    const order = buildOrderIn(from);

    expect(() => order.changeStatus(OrderStatus.of(to), LATER)).toThrow(
      expect.objectContaining({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Não é possível alterar o status de '${from}' para '${to}'`,
      }),
    );
    expect(order.status.value).toBe(from);
    expect(order.domainEvents).toHaveLength(0);
  });

  it.each(invalidPairs.filter(([, to]) => to === 'delivering'))(
    'dispatch também rejeita %s → delivering',
    (from) => {
      const order = buildOrderIn(from);

      expect(() => order.dispatch(availableCourier(), LATER)).toThrow(
        expect.objectContaining({
          code: 'INVALID_STATUS_TRANSITION',
          message: `Não é possível alterar o status de '${from}' para 'delivering'`,
        }),
      );
      expect(order.status.value).toBe(from);
    },
  );

  it('rejeita ready → delivering sem entregador atribuído', () => {
    const order = buildOrderIn('ready');

    expect(() => order.dispatch(availableCourier(), LATER)).toThrow(InvalidStatusTransitionError);
    expect(() => order.dispatch(availableCourier(), LATER)).toThrow(
      /é obrigatório ter um entregador atribuído/,
    );
    expect(order.status.value).toBe('ready');
  });

  it('changeStatus não despacha: ready → delivering exige dispatch', () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    order.pullDomainEvents();

    expect(() => order.changeStatus(OrderStatus.of('delivering'), LATER)).toThrow(
      /o despacho exige confirmar a disponibilidade do entregador/,
    );
    expect(order.status.value).toBe('ready');
    expect(order.domainEvents).toHaveLength(0);
  });
});
