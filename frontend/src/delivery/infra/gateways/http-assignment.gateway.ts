import { z } from 'zod';

import type { FetchHttpClient } from '../../../shared-kernel/infra';
import type { AssignmentGateway } from '../../application';
import type { AssignmentPlan } from '../../domain';
import { suggestionSchema, toAssignmentPlan } from '../mappers/assignment.mapper';

/** Só confirma que veio um pedido; o Delivery não depende do formato completo do Ordering. */
const dispatchedSchema = z.object({ id: z.string() });

export class HttpAssignmentGateway implements AssignmentGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async suggest(): Promise<AssignmentPlan> {
    const body = await this.http.request({ method: 'POST', path: '/orders/optimize-assignment' }, suggestionSchema);
    return toAssignmentPlan(body);
  }

  async dispatch(orderId: string, deliveryPersonId: string): Promise<void> {
    await this.http.request(
      { method: 'POST', path: `/orders/${encodeURIComponent(orderId)}/dispatch`, body: { deliveryPersonId } },
      dispatchedSchema,
    );
  }
}
