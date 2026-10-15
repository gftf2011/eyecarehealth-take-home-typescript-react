import type { Repository } from '../../../../shared-kernel/domain/index';
import type { Order } from '../order';

/**
 * Repositório do agregado Order. Itens e histórico de status são persistidos
 * junto com a raiz; não existe repositório de OrderItem. Escrita e leitura
 * (incluindo as listagens, quando chegarem) passam por este repositório.
 */
export interface OrderRepository extends Repository<Order> {}
