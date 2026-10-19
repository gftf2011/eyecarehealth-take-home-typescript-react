import { describe, expect, it } from 'vitest';

import {
  DeliveryIssueAlreadyOpenError,
  DeliveryIssueDecisionNotAllowedError,
  DeliveryIssueId,
  DeliveryIssueNote,
  DeliveryIssueReason,
  DeliveryIssueReported,
  DeliveryIssueOpenError,
  DeliveryIssueResolved,
  DeliveryNotInProgressError,
  InvalidDeliveryIssueNoteError,
  InvalidStatusTransitionError,
  MAX_DELIVERY_RETRIES,
  NoOpenDeliveryIssueError,
  OrderStatus,
  OrderStatusChanged,
  ReturnReason,
  type Order,
  type OrderStatusValue,
} from '..';
import { buildOrderIn, COURIER_ID } from './testing/order.fixture';

const REPORTED_AT = new Date('2025-01-20T16:00:00Z');
const DECIDED_AT = new Date('2025-01-20T16:10:00Z');

function report(order: Order, reason = 'customer_absent', note: string | null = 'Ninguém atende'): void {
  order.reportDeliveryIssue({
    id: DeliveryIssueId.generate(),
    reason: DeliveryIssueReason.create(reason),
    note: DeliveryIssueNote.createOptional(note),
    now: REPORTED_AT,
  });
}

function deliveringWithIssue(): Order {
  const order = buildOrderIn('delivering');
  report(order);
  order.pullDomainEvents();
  return order;
}

describe('Order: problema na entrega', () => {
  it('o entregador relata: o pedido segue em entrega, com ele, e o problema fica aberto', () => {
    const order = buildOrderIn('delivering');

    report(order);

    expect(order.status.value).toBe('delivering');
    expect(order.deliveryPersonId?.value).toBe(COURIER_ID);
    expect(order.openDeliveryIssue).toMatchObject({ isOpen: true, reportedAt: REPORTED_AT });
    expect(order.openDeliveryIssue?.reportedBy.value).toBe(COURIER_ID);
    const [event] = order.pullDomainEvents();
    expect(event).toBeInstanceOf(DeliveryIssueReported);
    expect(event?.payload).toMatchObject({ reason: 'customer_absent', deliveryPersonId: COURIER_ID });
  });

  it.each(['pending', 'ready', 'delivered', 'cancelled'] satisfies OrderStatusValue[])(
    'pedido %s não está em entrega: recusa',
    (status) => {
      expect(() => report(buildOrderIn(status))).toThrow(DeliveryNotInProgressError);
    },
  );

  it('um problema aberto por vez', () => {
    expect(() => report(deliveringWithIssue())).toThrow(DeliveryIssueAlreadyOpenError);
  });

  it('"outro motivo" exige observação', () => {
    expect(() => report(buildOrderIn('delivering'), 'other', '  ')).toThrow(InvalidDeliveryIssueNoteError);
  });

  it('tentar de novo: o problema termina e a entrega continua', () => {
    const order = deliveringWithIssue();

    order.retryDelivery(DECIDED_AT);

    expect(order.openDeliveryIssue).toBeNull();
    expect(order.deliveryIssues[0]).toMatchObject({ resolution: 'retried', resolvedAt: DECIDED_AT });
    expect(order.status.value).toBe('delivering');
    const [event] = order.pullDomainEvents();
    expect(event).toBeInstanceOf(DeliveryIssueResolved);
    expect(event?.payload).toMatchObject({ resolution: 'retried', deliveryPersonId: COURIER_ID });
    // E pode falhar de novo: as tentativas ficam registradas.
    report(order, 'refused', null);
    expect(order.deliveryIssues).toHaveLength(2);
  });

  it('cancelar: delivering → cancelled, com o motivo relatado no histórico', () => {
    const order = deliveringWithIssue();

    order.cancelFailedDelivery(DECIDED_AT);

    expect(order.status.value).toBe('cancelled');
    expect(order.statusHistory.at(-1)).toMatchObject({
      from: 'delivering',
      to: 'cancelled',
      reason: 'Entrega não realizada (cliente ausente): Ninguém atende',
    });
    expect(order.deliveryIssues[0]?.resolution).toBe('cancelled');
    expect(order.pullDomainEvents().map((event) => event.constructor)).toEqual([DeliveryIssueResolved, OrderStatusChanged]);
  });

  it('sem problema relatado, o gestor não cancela nem manda tentar de novo', () => {
    const order = buildOrderIn('delivering');

    expect(() => order.cancelFailedDelivery(DECIDED_AT)).toThrow(NoOpenDeliveryIssueError);
    expect(() => order.retryDelivery(DECIDED_AT)).toThrow(NoOpenDeliveryIssueError);
    // A máquina de estados genérica continua sem delivering → cancelled.
    expect(() => order.changeStatus(OrderStatus.of('cancelled'), DECIDED_AT)).toThrow(InvalidStatusTransitionError);
  });

  it('com problema aberto, a entrega fica parada: ninguém a conclui até o gestor decidir', () => {
    const order = deliveringWithIssue();

    expect(() => order.changeStatus(OrderStatus.of('delivered'), DECIDED_AT)).toThrow(DeliveryIssueOpenError);
    expect(order.status.value).toBe('delivering');
    // Depois de "tentar de novo", a entrega pode ser concluída.
    order.retryDelivery(DECIDED_AT);
    order.changeStatus(OrderStatus.of('delivered'), DECIDED_AT);
    expect(order.status.value).toBe('delivered');
  });

  it.each([
    ['customer_absent', ['retry', 'return', 'cancel']],
    ['address_not_found', ['retry', 'return', 'cancel']],
    ['refused', ['cancel']],
    ['other', ['retry', 'return', 'cancel']],
  ])('motivo %s permite %j', (reason, decisions) => {
    const order = buildOrderIn('delivering');
    report(order, reason, 'Detalhe');

    expect(order.deliveryIssueDecisions).toEqual(decisions);
  });

  it('cliente recusou: não dá para tentar de novo nem devolver; só cancelar', () => {
    const order = buildOrderIn('delivering');
    report(order, 'refused', null);

    expect(() => order.retryDelivery(DECIDED_AT)).toThrow(DeliveryIssueDecisionNotAllowedError);
    expect(() => order.returnToAssignment(ReturnReason.create('Redespachar'), DECIDED_AT)).toThrow(
      DeliveryIssueDecisionNotAllowedError,
    );
    expect(order.status.value).toBe('delivering');
    order.cancelFailedDelivery(DECIDED_AT);
    expect(order.status.value).toBe('cancelled');
  });

  it(`no máximo ${MAX_DELIVERY_RETRIES} novas tentativas por pedido; depois, só devolver ou cancelar`, () => {
    const order = buildOrderIn('delivering');
    for (let attempt = 0; attempt < MAX_DELIVERY_RETRIES; attempt += 1) {
      report(order);
      order.retryDelivery(DECIDED_AT);
    }
    report(order);

    expect(order.deliveryIssueDecisions).toEqual(['return', 'cancel']);
    expect(() => order.retryDelivery(DECIDED_AT)).toThrow(/mais de 2 vezes/);
  });

  it('sem problema aberto, não há decisões', () => {
    expect(buildOrderIn('delivering').deliveryIssueDecisions).toEqual([]);
  });

  it('devolver para a atribuição resolve o problema como devolvido', () => {
    const order = deliveringWithIssue();

    order.returnToAssignment(ReturnReason.create('Comida voltou ao restaurante'), DECIDED_AT);

    expect(order.status.value).toBe('ready');
    expect(order.deliveryIssues[0]?.resolution).toBe('returned');
  });
});
