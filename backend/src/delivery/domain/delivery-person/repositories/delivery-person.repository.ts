import type { Repository } from '../../../../shared-kernel/domain/index';
import type { DeliveryPerson } from '../delivery-person';

/**
 * Repositório do agregado DeliveryPerson. `findById` retorna `null` para IDs
 * inexistentes ou entregadores removidos. Escrita e leitura (incluindo as
 * listagens, quando chegarem) passam por este repositório.
 */
export interface DeliveryPersonRepository extends Repository<DeliveryPerson> {}
