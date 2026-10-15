import type { Repository } from '../../../../shared-kernel/domain/index.js';
import type { Product } from '../product.js';

/**
 * Repositório do agregado Product. As listagens paginadas usam um query port
 * próprio na camada de aplicação, sem reidratar agregados.
 *
 * `findById` retorna `null` para IDs inexistentes ou produtos removidos.
 */
export interface ProductRepository extends Repository<Product> {}
