import { describe, expect, it } from 'vitest';

import {
  DeliveryPersonAssigned,
  DeliveryPersonAssignmentNotAllowedError,
  DeliveryPersonAvailability,
  DeliveryPersonId,
  DeliveryPersonUnavailableError,
  EmptyOrderError,
  Order,
  OrderPlaced,
  OrderStatus,
  Quantity,
  UnavailableProductError,
  type OrderStatusValue,
} from '../index.js';
import {
  availableCourier,
  BURGER_ID,
  buildOrder,
  buildOrderIn,
  buildPlaceOrderParams,
  COURIER_ID,
  JUICE_ID,
  LATER,
  PLACED_AT,
  productSnapshot,
} from './testing/order.fixture.js';

const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('Order', () => {
  describe('place', () => {
    it('nasce pending, sem entregador, com total calculado e histórico inicial', () => {
      const order = Order.place(buildPlaceOrderParams());

      expect(order.status.value).toBe('pending');
      expect(order.deliveryPersonId).toBeNull();
      // 2 × 32,90 + 1 × 12,50
      expect(order.totalAmount.toDecimal()).toBe(78.3);
      expect(order.createdAt).toEqual(PLACED_AT);
      expect(order.statusHistory.map((change) => [change.from, change.to])).toEqual([
        [null, 'pending'],
      ]);
      expect(order.deliveredAt).toBeNull();
    });

    it('emite OrderPlaced com os itens e o total em centavos', () => {
      const order = Order.place(buildPlaceOrderParams());

      const events = order.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderPlaced);
      expect(events[0]?.payload).toEqual({
        totalAmountCents: 7830,
        items: [
          { productId: BURGER_ID, quantity: 2, unitPriceCents: 3290 },
          { productId: JUICE_ID, quantity: 1, unitPriceCents: 1250 },
        ],
      });
    });

    it('congela o preço unitário no momento do pedido (snapshot)', () => {
      const order = buildOrder();

      const [burger] = order.items;

      expect(burger?.productName).toBe('X-Burger Especial');
      expect(burger?.unitPrice.toDecimal()).toBe(32.9);
      expect(burger?.subtotal.toDecimal()).toBe(65.8);
    });

    it('agrupa o mesmo produto repetido em uma única linha', () => {
      const order = Order.place(
        buildPlaceOrderParams({
          items: [
            { product: productSnapshot(), quantity: Quantity.of(1) },
            { product: productSnapshot(), quantity: Quantity.of(2) },
          ],
        }),
      );

      expect(order.items).toHaveLength(1);
      expect(order.items[0]?.quantity.value).toBe(3);
      expect(order.totalAmount.toDecimal()).toBe(98.7);
    });

    it('rejeita pedido sem itens', () => {
      expect(() => Order.place(buildPlaceOrderParams({ items: [] }))).toThrow(EmptyOrderError);
    });

    it('rejeita produtos indisponíveis listando cada um nos detalhes', () => {
      const params = buildPlaceOrderParams({
        items: [
          { product: productSnapshot(), quantity: Quantity.of(1) },
          {
            product: productSnapshot({ id: JUICE_ID, name: 'Pudim de Leite', isAvailable: false }),
            quantity: Quantity.of(1),
          },
        ],
      });

      expect(() => Order.place(params)).toThrow(
        expect.objectContaining({
          code: 'UNAVAILABLE_PRODUCT',
          details: [{ productId: JUICE_ID, productName: 'Pudim de Leite', reason: 'Produto indisponível' }],
        }),
      );
      expect(() => Order.place(params)).toThrow(UnavailableProductError);
    });
  });

  describe('reconstitute', () => {
    it('reidrata o estado sem emitir eventos', () => {
      const original = buildOrderIn('delivered');

      const restored = Order.reconstitute(original.id, original.snapshot());

      expect(restored.equals(original)).toBe(true);
      expect(restored.totalAmount.equals(original.totalAmount)).toBe(true);
      expect(restored.statusHistory).toHaveLength(5);
      expect(restored.domainEvents).toHaveLength(0);
    });
  });

  describe('changeStatus', () => {
    it('registra cada transição no histórico e expõe deliveredAt', () => {
      const order = buildOrderIn('delivered');

      expect(order.statusHistory.map((change) => change.to)).toEqual([
        'pending',
        'preparing',
        'ready',
        'delivering',
        'delivered',
      ]);
      expect(order.deliveredAt).toEqual(LATER);
      expect(order.updatedAt).toEqual(LATER);
    });

    it('inclui o entregador no evento de despacho', () => {
      const order = buildOrderIn('ready');
      order.assignDeliveryPerson(availableCourier(), LATER);
      order.pullDomainEvents();

      order.changeStatus(OrderStatus.of('delivering'), LATER);

      expect(order.pullDomainEvents()[0]?.payload).toEqual({
        from: 'ready',
        to: 'delivering',
        deliveryPersonId: COURIER_ID,
      });
    });
  });

  describe('assignDeliveryPerson', () => {
    it('atribui entregador disponível e emite DeliveryPersonAssigned', () => {
      const order = buildOrderIn('ready');

      order.assignDeliveryPerson(availableCourier(), LATER);

      expect(order.deliveryPersonId?.value).toBe(COURIER_ID);
      const [event] = order.pullDomainEvents();
      expect(event).toBeInstanceOf(DeliveryPersonAssigned);
      expect(event?.payload).toEqual({ deliveryPersonId: COURIER_ID, previousDeliveryPersonId: null });
    });

    it('permite trocar o entregador antes do despacho', () => {
      const order = buildOrderIn('ready');
      order.assignDeliveryPerson(availableCourier(), LATER);
      order.pullDomainEvents();

      order.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER);

      expect(order.deliveryPersonId?.value).toBe(OTHER_COURIER_ID);
      expect(order.pullDomainEvents()[0]?.payload).toEqual({
        deliveryPersonId: OTHER_COURIER_ID,
        previousDeliveryPersonId: COURIER_ID,
      });
    });

    it('é idempotente para o mesmo entregador', () => {
      const order = buildOrderIn('ready');
      order.assignDeliveryPerson(availableCourier(), LATER);
      order.pullDomainEvents();

      order.assignDeliveryPerson(availableCourier(), LATER);

      expect(order.domainEvents).toHaveLength(0);
    });

    it.each([
      ['inativo', false, false, 'Este entregador está inativo'],
      ['em outra entrega', true, true, 'Este entregador já está atribuído a outro pedido em andamento'],
    ])('rejeita entregador %s', (_label, isActive, hasDeliveryInProgress, message) => {
      const order = buildOrderIn('ready');
      const availability = DeliveryPersonAvailability.create({
        deliveryPersonId: DeliveryPersonId.from(COURIER_ID),
        isActive,
        hasDeliveryInProgress,
      });

      expect(() => order.assignDeliveryPerson(availability, LATER)).toThrow(
        expect.objectContaining({ code: 'DELIVERY_PERSON_UNAVAILABLE', message }),
      );
      expect(() => order.assignDeliveryPerson(availability, LATER)).toThrow(
        DeliveryPersonUnavailableError,
      );
      expect(order.deliveryPersonId).toBeNull();
    });

    it.each(['delivering', 'delivered', 'cancelled'] satisfies OrderStatusValue[])(
      'não permite atribuição com pedido %s',
      (status) => {
        const order = buildOrderIn(status);

        expect(() =>
          order.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER),
        ).toThrow(DeliveryPersonAssignmentNotAllowedError);
      },
    );
  });
});
