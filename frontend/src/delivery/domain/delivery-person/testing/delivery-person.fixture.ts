import {
  DeliveryPerson,
  GeoLocation,
  PersonName,
  PhoneNumber,
  VehicleType,
  type VehicleTypeValue,
} from '../..';

export const CREATED_AT = '2026-10-17T12:00:00.000Z';

/** Corpo de um entregador como a API devolve. */
export type DeliveryPersonBodyFixture = {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleTypeValue;
  isActive: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function deliveryPersonBody(overrides: Partial<DeliveryPersonBodyFixture> = {}): DeliveryPersonBodyFixture {
  return {
    id: 'courier-1',
    name: 'Carlos Santos',
    phone: '(11) 91234-5678',
    vehicleType: 'motorcycle',
    isActive: true,
    currentLatitude: -23.5489,
    currentLongitude: -46.6388,
    currentOrderId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function buildDeliveryPerson(overrides: Partial<DeliveryPersonBodyFixture> = {}): DeliveryPerson {
  const body = deliveryPersonBody(overrides);
  return DeliveryPerson.restore({
    id: body.id,
    name: PersonName.create(body.name),
    phone: PhoneNumber.create(body.phone),
    vehicleType: VehicleType.create(body.vehicleType),
    isActive: body.isActive,
    location:
      body.currentLatitude === null || body.currentLongitude === null
        ? null
        : GeoLocation.create(body.currentLatitude, body.currentLongitude),
    currentOrderId: body.currentOrderId,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
}
