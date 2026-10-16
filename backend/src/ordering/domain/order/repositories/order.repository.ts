import type { Repository } from '../../../../shared-kernel/domain';
import type { Order } from '../order';

/**
 * Repositório do agregado Order. Itens e histórico de status são persistidos
 * junto com a raiz; não existe repositório de OrderItem. Escrita e leitura
 * (incluindo as listagens, quando chegarem) passam por este repositório.
 *
 * Concorrência: `findById` trava o pedido (ex.: `SELECT … FOR UPDATE`) até o
 * fim da transação. Duas alterações simultâneas do mesmo pedido são
 * serializadas e a segunda já valida a transição sobre o estado novo, em vez
 * de sobrescrevê-lo (lost update).
 */
export interface OrderRepository extends Repository<Order> {}
