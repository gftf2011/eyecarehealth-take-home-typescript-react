import type { UseCase } from '../../../../shared-kernel/application';
import type { AssignmentPlan } from '../../../domain';
import type { AssignmentGateway } from '../../ports/assignment-gateway';

/** Pede ao backend a atribuição de menor distância total; todos os pares começam pendentes. */
export class SuggestAssignmentUseCase implements UseCase<void, AssignmentPlan> {
  constructor(private readonly assignments: AssignmentGateway) {}

  execute(): Promise<AssignmentPlan> {
    return this.assignments.suggest();
  }
}
