import { z } from 'zod';

import {
  DeliveryPerson,
  GeoLocation,
  PersonName,
  PhoneNumber,
  VehicleType,
  type DeliveryPersonDetails,
} from '../../domain';

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** Corpo de um entregador na API. */
export const deliveryPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: z.string(),
  vehicleType: z.string(),
  isActive: z.boolean(),
  currentLatitude: z.number().nullable(),
  currentLongitude: z.number().nullable(),
  currentOrderId: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type DeliveryPersonBody = z.output<typeof deliveryPersonSchema>;

export const deliveryPersonListSchema = z.object({ data: z.array(deliveryPersonSchema) });

/** Corpo da API → agregado, passando pelos mesmos Value Objects (dados fora das regras viram erro). */
export function toDeliveryPerson(body: DeliveryPersonBody): DeliveryPerson {
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
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  });
}

/** Detalhes validados → corpo de `POST`/`PUT` (só os campos presentes). */
export function toDeliveryPersonRequestBody(details: Partial<DeliveryPersonDetails>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (details.name !== undefined) body.name = details.name.value;
  if (details.phone !== undefined) body.phone = details.phone.value;
  if (details.vehicleType !== undefined) body.vehicleType = details.vehicleType.value;
  if (details.isActive !== undefined) body.isActive = details.isActive;
  if (details.location !== undefined) {
    body.currentLatitude = details.location?.latitude ?? null;
    body.currentLongitude = details.location?.longitude ?? null;
  }
  return body;
}
