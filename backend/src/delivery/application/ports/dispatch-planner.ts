import type { AssignmentPlan, DispatchableOrder, DispatchCandidate } from '../../domain';

export type PlannedAssignment = {
  readonly plan: AssignmentPlan;
  /** Tempo do algoritmo em si, sem fila nem transporte entre threads. */
  readonly executionTimeMs: number;
};

/**
 * Port de saída: calcula a atribuição ótima. O algoritmo é o mesmo serviço de
 * domínio (`DispatchOptimizer`); o adaptador decide **onde** ele roda (na
 * thread da requisição ou num pool de workers), para um cálculo grande não
 * travar a API.
 *
 * Lança `DispatchPlannerBusyError` ou `DispatchPlannerTimeoutError` (503)
 * quando não há como calcular agora.
 */
export interface DispatchPlanner {
  plan(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): Promise<PlannedAssignment>;
}
