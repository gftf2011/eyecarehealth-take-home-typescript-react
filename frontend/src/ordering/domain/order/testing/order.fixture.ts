import { Money } from '../../../../shared-kernel/domain';
import { Order, OrderStatus, type OrderProps, type OrderStatusValue } from '../..';

export const CREATED_AT = new Date('2026-10-17T15:30:00Z');

/** Corpo de um pedido como a API devolve (datas em ISO, valores em reais). */
export type OrderBodyFixture = {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  status: OrderStatusValue;
  totalAmount: number;
  deliveryPerson: { id: string; name: string } | null;
  items: { id: string; product: { id: string; name: string }; quantity: number; unitPrice: number }[];
  statusHistory: { from: OrderStatusValue | null; to: OrderStatusValue; changedAt: string; reason: string | null }[];
  createdAt: string;
  updatedAt: string;
};

export function orderBody(overrides: Partial<OrderBodyFixture> = {}): OrderBodyFixture {
  return {
    id: 'order-1',
    customerName: 'João Silva',
    customerPhone: '(11) 99999-1234',
    deliveryAddress: 'Rua das Flores, 123, São Paulo - SP',
    latitude: -23.5891,
    longitude: -46.6378,
    status: 'pending',
    totalAmount: 78.3,
    deliveryPerson: null,
    items: [
      { id: 'item-1', product: { id: 'p-burger', name: 'X-Burger Especial' }, quantity: 2, unitPrice: 32.9 },
      { id: 'item-2', product: { id: 'p-juice', name: 'Suco de Laranja' }, quantity: 1, unitPrice: 12.5 },
    ],
    statusHistory: [{ from: null, to: 'pending', changedAt: CREATED_AT.toISOString(), reason: null }],
    createdAt: CREATED_AT.toISOString(),
    updatedAt: CREATED_AT.toISOString(),
    ...overrides,
  };
}

export function buildOrder(
  overrides: Partial<Omit<OrderProps, 'status'>> & { status?: OrderStatusValue } = {},
): Order {
  const { status, ...rest } = overrides;
  return Order.restore({
    id: 'order-1',
    customerName: 'João Silva',
    customerPhone: '(11) 99999-1234',
    deliveryAddress: 'Rua das Flores, 123, São Paulo - SP',
    items: [
      { id: 'item-1', productId: 'p-burger', productName: 'X-Burger Especial', quantity: 2, unitPrice: Money.fromDecimal(32.9) },
      { id: 'item-2', productId: 'p-juice', productName: 'Suco de Laranja', quantity: 1, unitPrice: Money.fromDecimal(12.5) },
    ],
    totalAmount: Money.fromDecimal(78.3),
    deliveryPerson: null,
    statusHistory: [{ from: null, to: 'pending', changedAt: CREATED_AT, reason: null }],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...rest,
    status: OrderStatus.of(status ?? 'pending'),
  });
}
