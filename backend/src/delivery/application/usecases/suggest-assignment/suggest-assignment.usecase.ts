import type { Stopwatch, UseCase } from '../../../../shared-kernel/application';
import type { DispatchCandidate, DispatchOptimizer } from '../../../domain';
import {
  toAssignmentSuggestionDto,
  type AssignmentSuggestionDto,
} from '../../dtos/assignment-suggestion.dto';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

/**
 * Sugere a atribuição pedido → entregador que minimiza a distância total.
 *
 * - Pedidos: todos os `ready` (inclusive com entregador já atribuído: o gestor
 *   pode redistribuir).
 * - Candidatos: entregadores ativos, não removidos e sem pedido `delivering`.
 *
 * É só uma proposta: não altera nada nem trava linhas. Aceitar uma atribuição
 * é outro caso de uso, que valida tudo de novo com lock.
 */
export class SuggestAssignmentUseCase implements UseCase<void, AssignmentSuggestionDto> {
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly optimizer: DispatchOptimizer,
    private readonly stopwatch: Stopwatch,
  ) {}

  async execute(): Promise<AssignmentSuggestionDto> {
    const { orders, deliveryPersons } = await this.unitOfWork.transaction(
      async ({ deliveryPersons: repository, dispatchBoard }) => {
        const [ready, busy, active] = await Promise.all([
          dispatchBoard.readyOrders(),
          dispatchBoard.deliveryPersonsWithDeliveryInProgress(),
          repository.list({ isActive: true }),
        ]);
        const busyIds = new Set(busy.map((id) => id.value));
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

    const elapsed = this.stopwatch.start();
    const plan = this.optimizer.plan(orders, candidates);
    const executionTimeMs = elapsed();

    return toAssignmentSuggestionDto(plan, orders, deliveryPersons, executionTimeMs);
  }
}
