import type { DomainEvent, Slice } from '../../../shared-kernel/domain';
import {
  Order,
  OrderId,
  type DeliveryPersonAvailability,
  type DeliveryPersonId,
  type OrderListCriteria,
  type OrderRepository,
  type OrderSnapshot,
  type ProductId,
  type ProductSnapshot,
} from '../../domain';
import type { DeliveryPersonDirectory, DeliveryPersonSummary } from '../ports/delivery-person-directory';
import type { ProductCatalog } from '../ports/product-catalog';
import type { OrderingRepositories, OrderingUnitOfWork } from '../ports/ordering-unit-of-work';

/**
 * Unidade de trabalho em memória com semântica transacional real: as escritas
 * ficam em uma área temporária e só são aplicadas (e os eventos, registrados em
 * `publishedEvents` como entregues ao mediador) se a transação terminar sem
 * erro. Guarda snapshots, não instâncias, para que nada vaze entre transações.
 */
export class InMemoryOrderingUnitOfWork implements OrderingUnitOfWork {
  readonly orders = new Map<string, OrderSnapshot>();
  readonly publishedEvents: DomainEvent[] = [];
  /** IDs dos pedidos lidos com `findByIdForUpdate` (travados), na ordem. */
  readonly lockedOrderIds: string[] = [];
  /** Produtos visíveis no Catalog (existentes e não removidos). */
  readonly catalog = new Map<string, ProductSnapshot>();
  /** IDs pedidos ao Catalog em cada consulta, na ordem das chamadas. */
  readonly catalogLookups: string[][] = [];
  /** Entregadores existentes e não removidos no Delivery, com a disponibilidade atual. */
  readonly deliveryPersons = new Map<string, DeliveryPersonAvailability>();
  /** Nome de exibição de cada entregador conhecido, removidos inclusive. */
  readonly deliveryPersonNames = new Map<string, string>();
  /** IDs consultados (e travados) com `availabilityOf`, na ordem das chamadas. */
  readonly deliveryPersonLookups: string[] = [];
  /** IDs pedidos em cada chamada de `summariesOf`. */
  readonly deliveryPersonSummaryLookups: string[][] = [];
  commits = 0;
  rollbacks = 0;
  #failNextCommit: Error | null = null;

  /** Simula produtos existentes no Catalog. */
  givenCatalogProducts(...products: ProductSnapshot[]): void {
    for (const product of products) this.catalog.set(product.productId.value, product);
  }

  /** Simula entregadores existentes no Delivery (nome padrão se não informado antes). */
  givenDeliveryPersons(...availabilities: DeliveryPersonAvailability[]): void {
    for (const availability of availabilities) {
      const id = availability.deliveryPersonId.value;
      this.deliveryPersons.set(id, availability);
      if (!this.deliveryPersonNames.has(id)) this.deliveryPersonNames.set(id, `Entregador ${id.slice(0, 8)}`);
    }
  }

  /** Define o nome de exibição de um entregador. */
  nameDeliveryPerson(id: string, name: string): void {
    this.deliveryPersonNames.set(id, name);
  }

  /** Simula entregador removido no Delivery: sem disponibilidade, mas ainda exibível. */
  givenRemovedDeliveryPerson(id: string, name: string): void {
    this.deliveryPersons.delete(id);
    this.deliveryPersonNames.set(id, name);
  }

  /** Pré-carrega pedidos já confirmados (estado inicial do teste), descartando os eventos. */
  givenOrders(...orders: Order[]): void {
    for (const order of orders) {
      order.pullDomainEvents();
      this.orders.set(order.id.value, order.snapshot());
    }
  }

  /** Lê o estado confirmado de um pedido, como o próximo caso de uso o veria. */
  committedOrder(id: string): Order | undefined {
    const snapshot = this.orders.get(id);
    return snapshot === undefined ? undefined : Order.reconstitute(OrderId.from(id), snapshot);
  }

  /** Faz o próximo commit falhar, simulando erro do banco após as escritas. */
  failNextCommitWith(error: Error): void {
    this.#failNextCommit = error;
  }

  async transaction<TResult>(
    work: (repositories: OrderingRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new Map<string, OrderSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        orders: new InMemoryOrderRepository(this.orders, staged, stagedEvents, this.lockedOrderIds),
        products: new InMemoryProductCatalog(this.catalog, this.catalogLookups),
        deliveryPersons: new InMemoryDeliveryPersonDirectory(this),
      });

      if (this.#failNextCommit !== null) {
        const error = this.#failNextCommit;
        this.#failNextCommit = null;
        throw error;
      }

      for (const [id, snapshot] of staged) this.orders.set(id, snapshot);
      this.publishedEvents.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryOrderRepository implements OrderRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, OrderSnapshot>,
    private readonly staged: Map<string, OrderSnapshot>,
    private readonly stagedEvents: DomainEvent[],
    private readonly lockedOrderIds: string[],
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    return snapshot === undefined ? null : Order.reconstitute(id, snapshot);
  }

  async findByIdForUpdate(id: OrderId): Promise<Order | null> {
    this.lockedOrderIds.push(id.value);
    return this.findById(id);
  }

  async save(order: Order): Promise<void> {
    this.staged.set(order.id.value, order.snapshot());
    this.stagedEvents.push(...order.pullDomainEvents());
  }

  /** Mesma semântica esperada do SQL: filtros, ordenação estável e fatia da página. */
  async list(criteria: OrderListCriteria): Promise<Slice<Order>> {
    const visible = [...new Map([...this.committed, ...this.staged])]
      .map(([id, snapshot]) => Order.reconstitute(OrderId.from(id), snapshot))
      .filter((order) => matches(order, criteria))
      .sort(compareBy(criteria.sort));

    return {
      items: visible.slice(criteria.offset, criteria.offset + criteria.limit),
      total: visible.length,
    };
  }
}

function matches(order: Order, criteria: OrderListCriteria): boolean {
  if (criteria.status !== null && !order.status.is(criteria.status)) return false;
  const createdAt = order.createdAt.getTime();
  const { from, to } = criteria.createdAt;
  if (from !== null && createdAt < from.getTime()) return false;
  if (to !== null && createdAt >= to.getTime()) return false;
  return true;
}

function compareBy(sort: OrderListCriteria['sort']): (a: Order, b: Order) => number {
  const direction = sort.direction === 'asc' ? 1 : -1;
  const byField = (a: Order, b: Order): number => {
    switch (sort.field) {
      case 'createdAt':
        return a.createdAt.getTime() - b.createdAt.getTime();
      case 'totalAmount':
        return a.totalAmount.cents - b.totalAmount.cents;
    }
  };
  // Desempate pelo ID para a paginação ser estável.
  return (a, b) => direction * byField(a, b) || a.id.value.localeCompare(b.id.value);
}

class InMemoryProductCatalog implements ProductCatalog {
  constructor(
    private readonly catalog: ReadonlyMap<string, ProductSnapshot>,
    private readonly lookups: string[][],
  ) {}

  async snapshotsOf(ids: readonly ProductId[]): Promise<readonly ProductSnapshot[]> {
    this.lookups.push(ids.map((id) => id.value));
    return ids.flatMap((id) => {
      const snapshot = this.catalog.get(id.value);
      return snapshot === undefined ? [] : [snapshot];
    });
  }
}

class InMemoryDeliveryPersonDirectory implements DeliveryPersonDirectory {
  constructor(private readonly state: InMemoryOrderingUnitOfWork) {}

  async availabilityOf(id: DeliveryPersonId): Promise<DeliveryPersonAvailability | null> {
    this.state.deliveryPersonLookups.push(id.value);
    return this.state.deliveryPersons.get(id.value) ?? null;
  }

  async summariesOf(ids: readonly DeliveryPersonId[]): Promise<readonly DeliveryPersonSummary[]> {
    this.state.deliveryPersonSummaryLookups.push(ids.map((id) => id.value));
    return ids.flatMap((id) => {
      const name = this.state.deliveryPersonNames.get(id.value);
      return name === undefined ? [] : [{ id: id.value, name }];
    });
  }
}
