import type { DeliveryPersonAvailability, DeliveryPersonId } from '../../domain';

/**
 * Camada anticorrupção para o contexto Delivery: responde, na linguagem do
 * Ordering, se um entregador pode assumir um pedido agora (ativo e sem pedido
 * `delivering`). O Ordering não conhece o agregado DeliveryPerson, só esse fato.
 *
 * É obtido dentro da unit of work; a implementação deve travar a linha do
 * entregador (ex.: `SELECT … FOR UPDATE`) até o fim da transação, para que dois
 * despachos concorrentes não o coloquem em duas entregas ao mesmo tempo.
 */
export interface DeliveryPersonDirectory {
  /** Disponibilidade atual, ou `null` se o entregador não existe ou foi removido. */
  availabilityOf(id: DeliveryPersonId): Promise<DeliveryPersonAvailability | null>;
}
