import {
  DeliveryPerson,
  DeliveryPersonId,
  GeoPoint,
  PersonName,
  PhoneNumber,
  VehicleType,
  type RegisterDeliveryPersonParams,
} from '../..';

export const REGISTERED_AT = new Date('2025-01-10T09:00:00Z');
export const LATER = new Date('2025-01-11T12:00:00Z');

export function buildRegisterParams(
  overrides: Partial<RegisterDeliveryPersonParams> = {},
): RegisterDeliveryPersonParams {
  return {
    id: DeliveryPersonId.generate(),
    name: PersonName.create('Carlos Santos'),
    phone: PhoneNumber.create('(11) 91234-5678'),
    vehicleType: VehicleType.create('motorcycle'),
    location: GeoPoint.create(-23.5489, -46.6388),
    now: REGISTERED_AT,
    ...overrides,
  };
}

/** Entregador recém-cadastrado, já sem o evento de cadastro. */
export function buildDeliveryPerson(
  overrides: Partial<RegisterDeliveryPersonParams> = {},
): DeliveryPerson {
  const deliveryPerson = DeliveryPerson.register(buildRegisterParams(overrides));
  deliveryPerson.pullDomainEvents();
  return deliveryPerson;
}
