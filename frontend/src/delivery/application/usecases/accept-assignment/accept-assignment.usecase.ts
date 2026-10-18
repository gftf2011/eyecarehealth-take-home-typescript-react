import type { UseCase } from '../../../../shared-kernel/application';
import { DomainError } from '../../../../shared-kernel/domain';
import { AssignmentNotPendingError, type AssignmentPlan } from '../../../domain';
import type { AssignmentGateway } from '../../ports/assignment-gateway';

export type AcceptAssignmentInput = {
  readonly plan: AssignmentPlan;
  readonly orderId: string;
};

/**
 * Aceita um par sugerido: despacha o pedido com aquele entregador (o pedido
 * vai para `delivering`). Se a API recusar por a sugestão estar
 * desatualizada, o par fica marcado como falho com a mensagem dela, e os
 * outros pares continuam valendo. Falhas sem resposta (rede) sobem: o par
 * continua pendente para tentar de novo.
 */
export class AcceptAssignmentUseCase implements UseCase<AcceptAssignmentInput, AssignmentPlan> {
  constructor(private readonly assignments: AssignmentGateway) {}

  async execute({ plan, orderId }: AcceptAssignmentInput): Promise<AssignmentPlan> {
    const assignment = plan.pending.find((candidate) => candidate.orderId === orderId);
    if (assignment === undefined) throw new AssignmentNotPendingError(orderId);

    try {
      await this.assignments.dispatch(assignment.orderId, assignment.deliveryPersonId);
      return plan.accept(orderId);
    } catch (error) {
      if (error instanceof DomainError && isStaleSuggestion(error)) return plan.fail(orderId, error.message);
      throw error;
    }
  }
}

/** Recusas da API que significam "o mundo mudou desde a sugestão". */
const STALE_SUGGESTION_CODES: ReadonlySet<string> = new Set([
  'INVALID_STATUS_TRANSITION',
  'DELIVERY_PERSON_UNAVAILABLE',
  'ASSIGNMENT_NOT_ALLOWED',
  'ORDER_NOT_FOUND',
  'DELIVERY_PERSON_NOT_FOUND',
]);

function isStaleSuggestion(error: DomainError): boolean {
  return STALE_SUGGESTION_CODES.has(error.code);
}
