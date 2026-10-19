/**
 * Tópico público das mudanças nos entregadores, consumido pelo painel em
 * tempo real: um gestor cadastra, edita, desativa ou remove um entregador e
 * as outras telas abertas recarregam.
 */
export const DELIVERY_PERSON_UPDATES_TOPIC = 'delivery.delivery-person-updates';

/** Versão do contrato abaixo; mudanças incompatíveis exigem nova versão. */
export const DELIVERY_PERSON_UPDATES_VERSION = 1;

/**
 * Contrato público, separado dos eventos de domínio: só o que o painel
 * precisa para saber o que recarregar. Sem nome, telefone nem coordenadas: o
 * canal do tempo real é o mesmo para todos os perfis, e os dados completos
 * vêm pela API, que confere a permissão.
 */
export type DeliveryPersonUpdateMessage =
  | {
      readonly type:
        | 'delivery-person.registered'
        | 'delivery-person.updated'
        | 'delivery-person.relocated'
        | 'delivery-person.removed';
      readonly deliveryPersonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'delivery-person.activation-changed';
      readonly deliveryPersonId: string;
      readonly isActive: boolean;
      readonly occurredAt: string;
    };
