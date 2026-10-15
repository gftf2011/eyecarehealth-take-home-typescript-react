import type { Repository } from '../../../../shared-kernel/domain/index';
import type { DeliveryPerson } from '../delivery-person';

/**
 * Repositório do agregado DeliveryPerson. `findById` retorna `null` para IDs
 * inexistentes ou entregadores removidos. Listagens usam query ports próprios
 * na camada de aplicação.
 */
export interface DeliveryPersonRepository extends Repository<DeliveryPerson> {}
