import {
  CustomerName,
  DeliveryAddress,
  DeliveryPersonAvailability,
  DeliveryPersonId,
  GeoLocation,
  Order,
  OrderId,
  OrderStatus,
  PhoneNumber,
  ProductId,
  ProductSnapshot,
  Quantity,
  type OrderStatusValue,
  type PlaceOrderParams,
} from '../..';
import { Money } from '../../../../shared-kernel/domain';

export const PLACED_AT = new Date('2025-01-20T14:30:00Z');
export const LATER = new Date('2025-01-20T15:10:00Z');

export const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
export const JUICE_ID = '7a1c9e2b-4d3f-4a6b-8c9d-1e2f3a4b5c6d';
export const COURIER_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

export function productSnapshot(
  overrides: Partial<{ id: string; name: string; price: number; isAvailable: boolean }> = {},
): ProductSnapshot {
  return ProductSnapshot.create({
    productId: ProductId.from(overrides.id ?? BURGER_ID),
    name: overrides.name ?? 'X-Burger Especial',
    unitPrice: Money.fromDecimal(overrides.price ?? 32.9),
    isAvailable: overrides.isAvailable ?? true,
  });
}

export function availableCourier(id = COURIER_ID): DeliveryPersonAvailability {
  return DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(id),
    isActive: true,
    hasDeliveryInProgress: false,
  });
}

export function buildPlaceOrderParams(overrides: Partial<PlaceOrderParams> = {}): PlaceOrderParams {
  return {
    id: OrderId.generate(),
    customerName: CustomerName.create('Joao Silva'),
    customerPhone: PhoneNumber.create('(11) 99999-1234'),
    deliveryAddress: DeliveryAddress.create('Rua das Flores, 123, Sao Paulo - SP'),
    location: GeoLocation.create(-23.5891, -46.6378),
    items: [
      { product: productSnapshot(), quantity: Quantity.of(2) },
      {
        product: productSnapshot({ id: JUICE_ID, name: 'Suco de Laranja', price: 12.5 }),
        quantity: Quantity.of(1),
      },
    ],
    now: PLACED_AT,
    ...overrides,
  };
}

/** Pedido recém-criado, sem os eventos de criação. */
export function buildOrder(overrides: Partial<PlaceOrderParams> = {}): Order {
  const order = Order.place(buildPlaceOrderParams(overrides));
  order.pullDomainEvents();
  return order;
}

/** Caminho feliz até `target`, atribuindo entregador antes do despacho. */
const HAPPY_PATH: readonly OrderStatusValue[] = ['preparing', 'ready', 'delivering', 'delivered'];

export function buildOrderIn(target: OrderStatusValue): Order {
  const order = buildOrder();
  if (target === 'pending') return order;
  if (target === 'cancelled') {
    order.changeStatus(OrderStatus.of('cancelled'), LATER);
    order.pullDomainEvents();
    return order;
  }
  for (const status of HAPPY_PATH) {
    if (status === 'delivering') {
      order.assignDeliveryPerson(availableCourier(), LATER);
      order.dispatch(availableCourier(), LATER);
    } else {
      order.changeStatus(OrderStatus.of(status), LATER);
    }
    if (status === target) break;
  }
  order.pullDomainEvents();
  return order;
}
