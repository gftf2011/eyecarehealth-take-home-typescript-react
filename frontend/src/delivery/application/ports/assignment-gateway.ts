import type { AssignmentPlan } from '../../domain';

/** Otimização e despacho na API. */
export interface AssignmentGateway {
  /** `POST /orders/optimize-assignment`: só sugere, não altera nada. */
  suggest(): Promise<AssignmentPlan>;

  /**
   * `POST /orders/:id/dispatch`: atribui e passa para `delivering` numa
   * transação. Sugestão desatualizada volta como `422` (ou `404`).
   */
  dispatch(orderId: string, deliveryPersonId: string): Promise<void>;
}
