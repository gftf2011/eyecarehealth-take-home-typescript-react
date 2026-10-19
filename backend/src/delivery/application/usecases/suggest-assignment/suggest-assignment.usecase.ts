import type { UseCase } from '../../../../shared-kernel/application';
import type { DispatchCandidate } from '../../../domain';
import {
  toAssignmentSuggestionDto,
  type AssignmentSuggestionDto,
} from '../../dtos/assignment-suggestion.dto';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';
import type { DispatchPlanner } from '../../ports/dispatch-planner';

/**
 * Sugere a atribuição pedido → entregador que minimiza a distância total.
 *
 * - Pedidos: todos os `ready` (inclusive com entregador já atribuído: o gestor
 *   pode redistribuir).
 * - Candidatos: entregadores ativos, não removidos e sem pedido `delivering`.
 *
 * É só uma proposta: não altera nada nem trava linhas. Aceitar uma atribuição
 * é outro caso de uso, que valida tudo de novo com lock. O cálculo roda fora
 * da transação (que só lê) e, se for grande, fora da thread da API.
 */
export class SuggestAssignmentUseCase implements UseCase<void, AssignmentSuggestionDto> {
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly planner: DispatchPlanner,
  ) {}

  async execute(): Promise<AssignmentSuggestionDto> {
    const { orders, deliveryPersons } = await this.unitOfWork.transaction(
      async ({ deliveryPersons: repository, dispatchBoard }) => {
        const [ready, busy, active] = await Promise.all([
          dispatchBoard.readyOrders(),
          dispatchBoard.deliveriesInProgress(),
          repository.list({ isActive: true }),
        ]);
        const busyIds = new Set(busy.map((delivery) => delivery.deliveryPersonId.value));
        return {
          orders: ready,
          deliveryPersons: active.filter((person) => !busyIds.has(person.id.value)),
        };
      },
    );

    const candidates = deliveryPersons.flatMap((person): DispatchCandidate[] => {
      const candidate = person.toDispatchCandidate();
      return candidate === null ? [] : [candidate];
    });

    const { plan, executionTimeMs } = await this.planner.plan(orders, candidates);

    return toAssignmentSuggestionDto(plan, orders, deliveryPersons, executionTimeMs);
  }
}
