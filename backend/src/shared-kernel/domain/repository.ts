import type { AggregateRoot } from './aggregate-root';
import type { UniqueId } from './unique-id';

/**
 * Contrato base de repositório. Só aceita raízes de agregado: entidades
 * internas (ex.: OrderItem) são carregadas e persistidas junto com a sua raiz,
 * nunca isoladamente, e o compilador rejeita `Repository<OrderItem>`.
 */
export interface Repository<TAggregate extends AggregateRoot<UniqueId>> {
  findById(id: TAggregate['id']): Promise<TAggregate | null>;

  /**
   * Insere ou atualiza o agregado inteiro e grava os eventos retirados com
   * `pullDomainEvents()` no outbox, na mesma transação.
   */
  save(aggregate: TAggregate): Promise<void>;
}
