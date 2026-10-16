import type { DomainEvent } from '../../../shared-kernel/domain';
import {
  DeliveryPerson,
  DeliveryPersonId,
  type DeliveryPersonListCriteria,
  type DeliveryPersonRepository,
  type DeliveryPersonSnapshot,
  type DispatchableOrder,
} from '../../domain';
import type { DispatchBoard } from '../ports/dispatch-board';
import type { DeliveryRepositories, DeliveryUnitOfWork } from '../ports/delivery-unit-of-work';

/**
 * Unidade de trabalho em memória com semântica transacional real (mesma dos
 * fakes dos outros contextos): escritas e eventos só valem se a transação
 * terminar sem erro. Guarda snapshots, não instâncias.
 */
export class InMemoryDeliveryUnitOfWork implements DeliveryUnitOfWork {
  readonly deliveryPersons = new Map<string, DeliveryPersonSnapshot>();
  readonly publishedEvents: DomainEvent[] = [];
  /** Pedidos `ready` vistos pelo Delivery (fato do Ordering). */
  readyOrders: DispatchableOrder[] = [];
  /** Entregadores com pedido `delivering` (fato do Ordering). */
  readonly deliveryPersonsInProgress = new Set<string>();
  commits = 0;
  rollbacks = 0;
  #failNextCommit: Error | null = null;

  /** Pré-carrega entregadores já confirmados, descartando os eventos. */
  givenDeliveryPersons(...people: DeliveryPerson[]): void {
    for (const person of people) {
      person.pullDomainEvents();
      this.deliveryPersons.set(person.id.value, person.snapshot());
    }
  }

  givenReadyOrders(...orders: DispatchableOrder[]): void {
    this.readyOrders.push(...orders);
  }

  givenDeliveryInProgress(...people: DeliveryPerson[]): void {
    for (const person of people) this.deliveryPersonsInProgress.add(person.id.value);
  }

  committedDeliveryPerson(id: string): DeliveryPerson | undefined {
    const snapshot = this.deliveryPersons.get(id);
    return snapshot === undefined
      ? undefined
      : DeliveryPerson.reconstitute(DeliveryPersonId.from(id), snapshot);
  }

  failNextCommitWith(error: Error): void {
    this.#failNextCommit = error;
  }

  async transaction<TResult>(
    work: (repositories: DeliveryRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new Map<string, DeliveryPersonSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        deliveryPersons: new InMemoryDeliveryPersonRepository(this.deliveryPersons, staged, stagedEvents),
        dispatchBoard: new InMemoryDispatchBoard(this),
      });

      if (this.#failNextCommit !== null) {
        const error = this.#failNextCommit;
        this.#failNextCommit = null;
        throw error;
      }

      for (const [id, snapshot] of staged) this.deliveryPersons.set(id, snapshot);
      this.publishedEvents.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryDeliveryPersonRepository implements DeliveryPersonRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, DeliveryPersonSnapshot>,
    private readonly staged: Map<string, DeliveryPersonSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: DeliveryPersonId): Promise<DeliveryPerson | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    if (snapshot === undefined || snapshot.removedAt !== null) return null;
    return DeliveryPerson.reconstitute(id, snapshot);
  }

  async save(person: DeliveryPerson): Promise<void> {
    this.staged.set(person.id.value, person.snapshot());
    this.stagedEvents.push(...person.pullDomainEvents());
  }

  /** Mesma semântica esperada do SQL: sem removidos, filtro por ativo, ordem por nome. */
  async list(criteria: DeliveryPersonListCriteria): Promise<readonly DeliveryPerson[]> {
    return [...new Map([...this.committed, ...this.staged])]
      .map(([id, snapshot]) => DeliveryPerson.reconstitute(DeliveryPersonId.from(id), snapshot))
      .filter((person) => !person.isRemoved)
      .filter((person) => criteria.isActive === null || person.isActive === criteria.isActive)
      .sort(
        (a, b) =>
          a.name.value.localeCompare(b.name.value, 'pt-BR') || a.id.value.localeCompare(b.id.value),
      );
  }
}

class InMemoryDispatchBoard implements DispatchBoard {
  constructor(private readonly state: InMemoryDeliveryUnitOfWork) {}

  async readyOrders(): Promise<readonly DispatchableOrder[]> {
    return [...this.state.readyOrders];
  }

  async deliveryPersonsWithDeliveryInProgress(): Promise<readonly DeliveryPersonId[]> {
    return [...this.state.deliveryPersonsInProgress].map((id) => DeliveryPersonId.from(id));
  }
}
