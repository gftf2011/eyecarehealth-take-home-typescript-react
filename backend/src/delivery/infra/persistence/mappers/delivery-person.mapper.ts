import type { Insertable, Selectable } from 'kysely';

import { toCoordinate } from '../../../../shared-kernel/infra/database/numeric';
import {
  DeliveryPerson,
  DeliveryPersonId,
  GeoPoint,
  PersonName,
  PhoneNumber,
  VehicleType,
} from '../../../domain';
import type { DeliveryPersonsTable } from '../schema/delivery-database';

/** Casas decimais das colunas de coordenadas (`numeric(10,8)` / `numeric(11,8)`). */
const COORDINATE_SCALE = 8;

/** Linha → agregado. Passa pelos Value Objects: dado inválido no banco falha alto. */
export function toDeliveryPerson(row: Selectable<DeliveryPersonsTable>): DeliveryPerson {
  return DeliveryPerson.reconstitute(DeliveryPersonId.from(row.id), {
    name: PersonName.create(row.name),
    phone: PhoneNumber.create(row.phone),
    vehicleType: VehicleType.create(row.vehicle_type),
    isActive: row.is_active,
    location:
      row.current_latitude === null || row.current_longitude === null
        ? null
        : GeoPoint.create(toCoordinate(row.current_latitude), toCoordinate(row.current_longitude)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removedAt: row.deleted_at,
  });
}

/** Agregado → linha. */
export function toDeliveryPersonRow(person: DeliveryPerson): Insertable<DeliveryPersonsTable> {
  return {
    id: person.id.value,
    name: person.name.value,
    phone: person.phone.value,
    vehicle_type: person.vehicleType.value,
    is_active: person.isActive,
    current_latitude: person.location?.latitude.toFixed(COORDINATE_SCALE) ?? null,
    current_longitude: person.location?.longitude.toFixed(COORDINATE_SCALE) ?? null,
    created_at: person.createdAt,
    updated_at: person.updatedAt,
    deleted_at: person.removedAt,
  };
}
