import {
  DeliveryPersonId,
  DispatchableOrder,
  DispatchCandidate,
  GeoPoint,
  OrderId,
} from '../../index';

/** UUID v4 válido e legível a partir de um número (ex.: 1 → ...000000000001). */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
}

/**
 * Pedido sobre o equador, na longitude informada. No equador, 1° de longitude
 * ≈ 111,19 km, o que torna as distâncias fáceis de raciocinar nos testes.
 */
export function orderAt(n: number, longitude: number, latitude = 0): DispatchableOrder {
  return DispatchableOrder.create({
    orderId: OrderId.from(uuid(n)),
    deliveryAddress: `Endereço do pedido ${n}`,
    location: GeoPoint.create(latitude, longitude),
  });
}

export function courierAt(n: number, longitude: number, latitude = 0): DispatchCandidate {
  return DispatchCandidate.create({
    deliveryPersonId: DeliveryPersonId.from(uuid(n)),
    location: GeoPoint.create(latitude, longitude),
  });
}

export function unlocatedCourier(n: number): DispatchCandidate {
  return DispatchCandidate.create({ deliveryPersonId: DeliveryPersonId.from(uuid(n)), location: null });
}
