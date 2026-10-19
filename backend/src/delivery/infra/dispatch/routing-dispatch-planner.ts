import type { DispatchPlanner, PlannedAssignment } from '../../application/ports/dispatch-planner';
import type { DispatchableOrder, DispatchCandidate } from '../../domain';
import { lazily, meter } from '../../../shared-kernel/infra/observability/telemetry';

const duration = lazily(() =>
  meter().createHistogram('fastmeals.optimizer.duration', {
    description: 'Duração do algoritmo de atribuição, por modo (thread da API ou worker)',
    unit: 'ms',
    advice: { explicitBucketBoundaries: [0.5, 1, 5, 10, 50, 100, 250, 500, 1_000, 2_500, 5_000] },
  }),
);

/**
 * Decide onde calcular pelo tamanho do problema (pedidos × entregadores):
 * pequeno na própria thread (resposta em milissegundos, sem custo de enviar
 * para um worker), grande no pool. Pedidos iguais ao mesmo tempo (vários
 * gestores clicando em "Sugerir" com o mesmo quadro) dividem um só cálculo.
 */
export class RoutingDispatchPlanner implements DispatchPlanner {
  readonly #inFlight = new Map<string, Promise<PlannedAssignment>>();

  constructor(
    private readonly small: DispatchPlanner,
    private readonly large: DispatchPlanner,
    /** Até quantas células (pedidos × entregadores) calcular na thread da requisição. */
    private readonly inlineMaxCells: number,
  ) {}

  plan(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): Promise<PlannedAssignment> {
    const planner = orders.length * candidates.length <= this.inlineMaxCells ? this.small : this.large;
    if (planner === this.small) return measured(planner.plan(orders, candidates), 'inline');

    const key = signature(orders, candidates);
    const running = this.#inFlight.get(key);
    if (running !== undefined) return running;
    const started = measured(planner.plan(orders, candidates), 'worker').finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, started);
    return started;
  }
}

async function measured(planned: Promise<PlannedAssignment>, mode: 'inline' | 'worker'): Promise<PlannedAssignment> {
  const result = await planned;
  duration().record(result.executionTimeMs, { 'fastmeals.optimizer.mode': mode });
  return result;
}

/** Mesma entrada, mesmo plano (o otimizador é determinístico): a chave é a entrada. */
function signature(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): string {
  const orderPart = orders
    .map((order) => `${order.orderId.value}@${order.location.latitude},${order.location.longitude}`)
    .sort()
    .join(';');
  const candidatePart = candidates
    .map((candidate) => `${candidate.deliveryPersonId.value}@${candidate.location?.latitude ?? ''},${candidate.location?.longitude ?? ''}`)
    .sort()
    .join(';');
  return `${orderPart}|${candidatePart}`;
}
