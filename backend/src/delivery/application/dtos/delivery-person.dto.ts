import type { DeliveryPerson, VehicleTypeValue } from '../../domain';

/** Representação de saída de um entregador: só tipos primitivos, sem VOs. */
export type DeliveryPersonDto = {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly vehicleType: VehicleTypeValue;
  readonly isActive: boolean;
  readonly currentLatitude: number | null;
  readonly currentLongitude: number | null;
  /** Pedido `delivering` do entregador, se houver. */
  readonly currentOrderId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function toDeliveryPersonDto(
  person: DeliveryPerson,
  currentOrderId: string | null,
): DeliveryPersonDto {
  return {
    id: person.id.value,
    name: person.name.value,
    phone: person.phone.value,
    vehicleType: person.vehicleType.value,
    isActive: person.isActive,
    currentLatitude: person.location?.latitude ?? null,
    currentLongitude: person.location?.longitude ?? null,
    currentOrderId,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}
