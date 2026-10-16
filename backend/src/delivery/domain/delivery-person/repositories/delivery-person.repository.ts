import type { Repository } from '../../../../shared-kernel/domain';
import type { DeliveryPerson } from '../delivery-person';
import type { DeliveryPersonListCriteria } from './delivery-person-list-criteria';

/**
 * Repositório do agregado DeliveryPerson. `findById` e `list` nunca devolvem
 * entregadores removidos. Escrita e leitura passam por este repositório.
 */
export interface DeliveryPersonRepository extends Repository<DeliveryPerson> {
  /**
   * Entregadores que atendem aos critérios, ordenados por nome. Sem paginação:
   * a frota é pequena e o painel e a otimização precisam dela inteira.
   */
  list(criteria: DeliveryPersonListCriteria): Promise<readonly DeliveryPerson[]>;
}
