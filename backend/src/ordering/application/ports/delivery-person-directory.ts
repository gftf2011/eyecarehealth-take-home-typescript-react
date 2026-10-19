import type { DeliveryPersonAvailability, DeliveryPersonId } from '../../domain';

/** O que o Ordering exibe sobre o entregador de um pedido. */
export type DeliveryPersonSummary = {
  readonly id: string;
  readonly name: string;
};

/**
 * Camada anticorrupção para o contexto Delivery: responde, na linguagem do
 * Ordering, se um entregador pode assumir um pedido agora (ativo e sem pedido
 * `delivering`) e como ele é exibido. O Ordering não conhece o agregado
 * DeliveryPerson, só esses fatos.
 */
export interface DeliveryPersonDirectory {
  /**
   * Disponibilidade atual, ou `null` se o entregador não existe ou foi
   * removido. A implementação deve travar a linha do entregador (ex.:
   * `SELECT … FOR UPDATE`) até o fim da transação, para que dois despachos ou
   * atribuições concorrentes não o coloquem em duas entregas ao mesmo tempo.
   */
  availabilityOf(id: DeliveryPersonId): Promise<DeliveryPersonAvailability | null>;

  /**
   * Resumo de exibição dos entregadores, em **uma** consulta (sem N+1), sem
   * lock. Inclui entregadores removidos: pedidos antigos continuam mostrando
   * quem os entregou.
   */
  summariesOf(ids: readonly DeliveryPersonId[]): Promise<readonly DeliveryPersonSummary[]>;

  /**
   * O entregador (não removido) que entra no sistema com este usuário, ou
   * `null` se o usuário não é o login de nenhum. Sem lock: é só "quem sou eu".
   */
  deliveryPersonOfUser(userId: string): Promise<DeliveryPersonSummary | null>;
}
