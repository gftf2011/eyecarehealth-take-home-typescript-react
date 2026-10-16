import type { Repository } from '../../../../shared-kernel/domain';
import type { DeliveryPerson } from '../delivery-person';
import type { DeliveryPersonId } from '../delivery-person-id';
import type { DeliveryPersonListCriteria } from './delivery-person-list-criteria';

/**
 * Repositório do agregado DeliveryPerson. As leituras nunca devolvem
 * entregadores removidos. Escrita e leitura passam por este repositório.
 */
export interface DeliveryPersonRepository extends Repository<DeliveryPerson> {
  /** Leitura sem lock, para consultas. */
  findById(id: DeliveryPersonId): Promise<DeliveryPerson | null>;

  /**
   * Leitura para alteração: trava o entregador (ex.: `SELECT … FOR UPDATE`)
   * até o fim da transação. É o mesmo lock que o Ordering usa ao atribuir e
   * despachar, então alterar/remover e despachar o mesmo entregador ao mesmo
   * tempo ficam serializados. Todo caso de uso que altera um entregador
   * existente deve usar este método.
   */
  findByIdForUpdate(id: DeliveryPersonId): Promise<DeliveryPerson | null>;

  /**
   * Entregadores que atendem aos critérios, ordenados por nome. Sem paginação:
   * a frota é pequena e o painel e a otimização precisam dela inteira.
   */
  list(criteria: DeliveryPersonListCriteria): Promise<readonly DeliveryPerson[]>;
}
