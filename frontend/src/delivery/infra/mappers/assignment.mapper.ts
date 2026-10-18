import { z } from 'zod';

import { AssignmentPlan, type UnassignedReason } from '../../domain';

/** Resposta de `POST /orders/optimize-assignment`. */
export const suggestionSchema = z.object({
  assignments: z.array(
    z.object({
      orderId: z.string(),
      deliveryPersonId: z.string(),
      estimatedDistanceKm: z.number().nonnegative(),
      orderAddress: z.string(),
      deliveryPersonName: z.string(),
    }),
  ),
  unassigned: z.array(z.object({ orderId: z.string(), orderAddress: z.string(), reason: z.string() })),
  unlocatedDeliveryPersons: z.array(z.object({ id: z.string(), name: z.string() })),
  totalDistanceKm: z.number().nonnegative(),
  algorithm: z.string(),
  executionTimeMs: z.number().nonnegative(),
});

export type SuggestionBody = z.output<typeof suggestionSchema>;

/** A API descreve o motivo em texto (formato da spec); aqui ele vira um código. */
const REASONS: Readonly<Record<string, UnassignedReason>> = {
  'No available delivery person': 'NO_AVAILABLE_DELIVERY_PERSON',
};

export function toAssignmentPlan(body: SuggestionBody): AssignmentPlan {
  return AssignmentPlan.suggested({
    assignments: body.assignments.map((assignment) => ({
      orderId: assignment.orderId,
      orderAddress: assignment.orderAddress,
      deliveryPersonId: assignment.deliveryPersonId,
      deliveryPersonName: assignment.deliveryPersonName,
      distanceKm: assignment.estimatedDistanceKm,
    })),
    unassigned: body.unassigned.map((order) => ({
      orderId: order.orderId,
      orderAddress: order.orderAddress,
      reason: REASONS[order.reason] ?? 'UNKNOWN',
    })),
    unlocatedDeliveryPersons: body.unlocatedDeliveryPersons,
    totalDistanceKm: body.totalDistanceKm,
    algorithm: body.algorithm,
    executionTimeMs: body.executionTimeMs,
  });
}
