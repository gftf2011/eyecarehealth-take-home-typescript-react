import type { DispatchPlanner, PlannedAssignment } from '../../application/ports/dispatch-planner';
import type { DispatchableOrder, DispatchCandidate } from '../../domain';

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
    if (planner === this.small) return planner.plan(orders, candidates);

    const key = signature(orders, candidates);
    const running = this.#inFlight.get(key);
    if (running !== undefined) return running;
    const started = planner.plan(orders, candidates).finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, started);
    return started;
  }
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
