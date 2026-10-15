import type { Repository } from '../../../../shared-kernel/domain/index.js';
import type { Order } from '../order.js';

/**
 * Repositório do agregado Order. Itens e histórico de status são persistidos
 * junto com a raiz; não existe repositório de OrderItem. Listagens e relatórios
 * usam query ports próprios na camada de aplicação.
 */
export interface OrderRepository extends Repository<Order> {}
