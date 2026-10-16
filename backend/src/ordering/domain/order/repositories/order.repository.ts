import type { Repository, Slice } from '../../../../shared-kernel/domain';
import type { Order } from '../order';
import type { OrderId } from '../order-id';
import type { OrderListCriteria } from './order-list-criteria';

/**
 * Repositório do agregado Order. Itens e histórico de status são persistidos
 * junto com a raiz; não existe repositório de OrderItem. Escrita e leitura
 * (incluindo as listagens) passam por este repositório.
 */
export interface OrderRepository extends Repository<Order> {
  /** Leitura sem lock: para consultas, que não devem disputar com as escritas. */
  findById(id: OrderId): Promise<Order | null>;

  /**
   * Leitura para alteração: trava o pedido (ex.: `SELECT … FOR UPDATE`) até o
   * fim da transação. Duas alterações simultâneas do mesmo pedido são
   * serializadas e a segunda valida a regra sobre o estado novo, em vez de
   * sobrescrevê-lo (lost update). Todo caso de uso que altera um pedido
   * existente deve usar este método.
   */
  findByIdForUpdate(id: OrderId): Promise<Order | null>;

  /** Página de pedidos que atendem aos critérios, com o total geral. */
  list(criteria: OrderListCriteria): Promise<Slice<Order>>;
}
