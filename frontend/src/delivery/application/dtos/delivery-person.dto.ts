import type { DeliveryPerson, VehicleTypeValue } from '../../domain';

/** O que a interface mostra de um entregador. */
export type DeliveryPersonDto = {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly vehicleType: VehicleTypeValue;
  readonly isActive: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly currentOrderId: string | null;
  readonly isOnDelivery: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function toDeliveryPersonDto(person: DeliveryPerson): DeliveryPersonDto {
  return {
    id: person.id,
    name: person.name.value,
    phone: person.phone.value,
    vehicleType: person.vehicleType.value,
    isActive: person.isActive,
    latitude: person.location?.latitude ?? null,
    longitude: person.location?.longitude ?? null,
    currentOrderId: person.currentOrderId,
    isOnDelivery: person.isOnDelivery,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}
