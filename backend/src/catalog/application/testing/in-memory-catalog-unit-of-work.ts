import type { DomainEvent } from '../../../shared-kernel/domain/index.js';
import {
  Product,
  type ProductId,
  type ProductRepository,
  type ProductSnapshot,
} from '../../domain/index.js';
import type { CatalogRepositories, CatalogUnitOfWork } from '../ports/catalog-unit-of-work.js';

/**
 * Unidade de trabalho em memória com semântica transacional real: as escritas
 * ficam em uma área temporária e só são aplicadas (junto com os eventos no
 * outbox) se a transação terminar sem erro. Guarda snapshots, não instâncias,
 * para que nada vaze entre transações.
 */
export class InMemoryCatalogUnitOfWork implements CatalogUnitOfWork {
  readonly products = new Map<string, ProductSnapshot>();
  readonly outbox: DomainEvent[] = [];
  commits = 0;
  rollbacks = 0;
  #failNextCommit: Error | null = null;

  /** Faz o próximo commit falhar, simulando erro do banco após as escritas. */
  failNextCommitWith(error: Error): void {
    this.#failNextCommit = error;
  }

  async transaction<TResult>(
    work: (repositories: CatalogRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new Map<string, ProductSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        products: new InMemoryProductRepository(this.products, staged, stagedEvents),
      });

      if (this.#failNextCommit !== null) {
        const error = this.#failNextCommit;
        this.#failNextCommit = null;
        throw error;
      }

      for (const [id, snapshot] of staged) this.products.set(id, snapshot);
      this.outbox.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryProductRepository implements ProductRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, ProductSnapshot>,
    private readonly staged: Map<string, ProductSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: ProductId): Promise<Product | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    if (snapshot === undefined || snapshot.removedAt !== null) return null;
    return Product.reconstitute(id, snapshot);
  }

  async save(product: Product): Promise<void> {
    this.staged.set(product.id.value, product.snapshot());
    this.stagedEvents.push(...product.pullDomainEvents());
  }
}
