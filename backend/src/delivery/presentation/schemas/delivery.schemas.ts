import { z } from 'zod';

import { isoDateTime, optionalBooleanQuery, uuid } from '../../../shared-kernel/presentation';
import { VEHICLE_TYPES } from '../../domain';

/*
 * Schemas HTTP do Delivery: validam a forma nos controllers e geram a
 * documentação. Regras (nome, telefone, coordenadas juntas) são do domínio.
 */

const deliveryPersonFields = {
  name: z.string().meta({ minLength: 3, maxLength: 100, examples: ['Carlos Santos'] }),
  phone: z.string().meta({ description: 'Formato `(XX) XXXXX-XXXX`', examples: ['(11) 91234-5678'] }),
  vehicleType: z.string().meta({ enum: [...VEHICLE_TYPES], examples: ['motorcycle'] }),
  isActive: z.boolean().optional().meta({ description: 'Padrão `true` no cadastro' }),
  currentLatitude: z
    .number()
    .nullable()
    .optional()
    .meta({ description: 'Junto com `currentLongitude` (as duas `null` apagam a localização)', minimum: -90, maximum: 90 }),
  currentLongitude: z.number().nullable().optional().meta({ minimum: -180, maximum: 180 }),
};

export const registerDeliveryPersonBodySchema = z.object(deliveryPersonFields);

/** Atualização parcial: dados, ativação ou localização. */
export const updateDeliveryPersonBodySchema = z.object(deliveryPersonFields).partial();

export const listDeliveryPersonsQuerySchema = z.object({
  isActive: optionalBooleanQuery,
  available: optionalBooleanQuery.meta({ description: '`true`: sem pedido em `delivering`' }),
});

export const deliveryPersonSchema = z.strictObject({
  id: uuid,
  name: z.string(),
  phone: z.string(),
  vehicleType: z.enum(VEHICLE_TYPES),
  isActive: z.boolean(),
  currentLatitude: z.number().nullable(),
  currentLongitude: z.number().nullable(),
  currentOrderId: uuid.nullable().meta({ description: 'Pedido `delivering` do entregador, se houver' }),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const deliveryPersonListSchema = z.strictObject({ data: z.array(deliveryPersonSchema) });

export const assignmentSuggestionSchema = z.strictObject({
  assignments: z.array(
    z.strictObject({
      orderId: uuid,
      deliveryPersonId: uuid,
      estimatedDistanceKm: z.number().meta({ description: 'Distância Haversine entregador → pedido, em km, com 2 casas' }),
      orderAddress: z.string(),
      deliveryPersonName: z.string(),
    }),
  ),
  unassigned: z.array(
    z.strictObject({
      orderId: uuid,
      orderAddress: z.string(),
      reason: z.string().meta({ examples: ['No available delivery person'] }),
    }),
  ),
  unlocatedDeliveryPersons: z
    .array(z.strictObject({ id: uuid, name: z.string() }))
    .meta({ description: 'Entregadores aptos, mas sem localização: ficaram fora do cálculo' }),
  totalDistanceKm: z.number(),
  algorithm: z.string().meta({ examples: ['hungarian'] }),
  executionTimeMs: z.number().meta({ description: 'Tempo do algoritmo em si (matriz de distâncias + Húngaro), em ms' }),
});
