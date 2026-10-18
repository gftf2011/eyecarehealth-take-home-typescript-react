import { AssignmentNotPendingError } from './errors';

/** Decisão do gestor sobre um par sugerido. */
export type AssignmentDecision =
  | { readonly status: 'pending' }
  | { readonly status: 'accepted' }
  | { readonly status: 'rejected' }
  /** A API recusou ao aceitar (sugestão desatualizada): o par não vale mais. */
  | { readonly status: 'failed'; readonly reason: string };

export type SuggestedAssignment = {
  readonly orderId: string;
  readonly orderAddress: string;
  readonly deliveryPersonId: string;
  readonly deliveryPersonName: string;
  readonly distanceKm: number;
  readonly decision: AssignmentDecision;
};

export type UnassignedReason = 'NO_AVAILABLE_DELIVERY_PERSON' | 'UNKNOWN';

export type UnassignedOrder = {
  readonly orderId: string;
  readonly orderAddress: string;
  readonly reason: UnassignedReason;
};

export type AssignmentPlanProps = {
  readonly assignments: readonly Omit<SuggestedAssignment, 'decision'>[];
  readonly unassigned: readonly UnassignedOrder[];
  /** Entregadores aptos, mas sem localização: ficaram fora do cálculo. */
  readonly unlocatedDeliveryPersons: readonly { readonly id: string; readonly name: string }[];
  readonly totalDistanceKm: number;
  readonly algorithm: string;
  readonly executionTimeMs: number;
};

/**
 * Sugestão do otimizador (Húngaro + Haversine, no backend) e o que o gestor
 * decidiu sobre cada par. Imutável: cada decisão devolve um plano novo.
 * Aceitar despacha o pedido na API; rejeitar só descarta a sugestão.
 */
export class AssignmentPlan {
  private constructor(
    private readonly props: Omit<AssignmentPlanProps, 'assignments'>,
    readonly assignments: readonly SuggestedAssignment[],
  ) {}

  static suggested(props: AssignmentPlanProps): AssignmentPlan {
    return new AssignmentPlan(
      props,
      props.assignments.map((assignment) => ({ ...assignment, decision: { status: 'pending' } })),
    );
  }

  get unassigned(): readonly UnassignedOrder[] {
    return this.props.unassigned;
  }

  get unlocatedDeliveryPersons(): readonly { readonly id: string; readonly name: string }[] {
    return this.props.unlocatedDeliveryPersons;
  }

  /** Distância total sugerida (soma dos valores exibidos, como na API). */
  get totalDistanceKm(): number {
    return this.props.totalDistanceKm;
  }

  get algorithm(): string {
    return this.props.algorithm;
  }

  get executionTimeMs(): number {
    return this.props.executionTimeMs;
  }

  get isEmpty(): boolean {
    return this.assignments.length === 0 && this.props.unassigned.length === 0;
  }

  get pending(): readonly SuggestedAssignment[] {
    return this.assignments.filter((assignment) => assignment.decision.status === 'pending');
  }

  /** Todas as sugestões já foram decididas (ou não havia nenhuma). */
  get isSettled(): boolean {
    return this.pending.length === 0;
  }

  /** Distância dos pares efetivamente despachados. */
  get acceptedDistanceKm(): number {
    const hundredths = this.assignments
      .filter((assignment) => assignment.decision.status === 'accepted')
      .reduce((total, assignment) => total + Math.round(assignment.distanceKm * 100), 0);
    return hundredths / 100;
  }

  accept(orderId: string): AssignmentPlan {
    return this.#decide(orderId, { status: 'accepted' });
  }

  reject(orderId: string): AssignmentPlan {
    return this.#decide(orderId, { status: 'rejected' });
  }

  fail(orderId: string, reason: string): AssignmentPlan {
    return this.#decide(orderId, { status: 'failed', reason });
  }

  #decide(orderId: string, decision: AssignmentDecision): AssignmentPlan {
    const target = this.assignments.find((assignment) => assignment.orderId === orderId);
    if (target === undefined || target.decision.status !== 'pending') throw new AssignmentNotPendingError(orderId);
    return new AssignmentPlan(
      this.props,
      this.assignments.map((assignment) => (assignment.orderId === orderId ? { ...assignment, decision } : assignment)),
    );
  }
}
