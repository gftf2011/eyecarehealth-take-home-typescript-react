import { z } from 'zod';

import type { UseCase } from '../../../shared-kernel/application';
import type {
  ReleaseDeliveryPersonOrdersInput,
  ReleaseDeliveryPersonOrdersResult,
} from '../../application/usecases/release-delivery-person-orders/release-delivery-person-orders.usecase';

/** Tópico público do Delivery que o Ordering acompanha (contrato de lá, versão 1). */
export const DELIVERY_PERSON_UPDATES_TOPIC = 'delivery.delivery-person-updates';
const SUPPORTED_VERSION = 1;

/**
 * Camada anticorrupção: só o que o Ordering precisa da mensagem do Delivery,
 * no esquema dele (o Ordering não importa o código do outro contexto). Um
 * campo novo lá não muda nada aqui; um formato incompatível falha e a
 * mensagem vai para a fila morta, em vez de sumir.
 */
const envelopeSchema = z.object({
  id: z.string().min(1),
  topic: z.literal(DELIVERY_PERSON_UPDATES_TOPIC),
  version: z.literal(SUPPORTED_VERSION),
  payload: z.object({ type: z.string().min(1), deliveryPersonId: z.uuid(), isActive: z.boolean().optional() }),
});

export type DeliveryPersonUpdatesConsumerResult =
  | { readonly outcome: 'ignored' }
  | { readonly outcome: 'checked'; readonly releasedOrderIds: readonly string[] };

/**
 * Reage às mudanças da frota: quando um entregador é desativado ou removido,
 * os pedidos que ainda não saíram perdem o entregador e voltam para a
 * atribuição. A mensagem só dispara a conferência: o caso de uso decide pelo
 * estado atual (um entregador reativado depois continua com os pedidos).
 */
export class DeliveryPersonUpdatesConsumer {
  constructor(
    private readonly releaseOrders: UseCase<ReleaseDeliveryPersonOrdersInput, ReleaseDeliveryPersonOrdersResult>,
  ) {}

  /** Corpo cru da fila (o envelope do outbox). Lança se ele não segue o contrato. */
  async handle(body: string): Promise<DeliveryPersonUpdatesConsumerResult> {
    const message = envelopeSchema.parse(JSON.parse(body));
    const { type, deliveryPersonId, isActive } = message.payload;

    const leftTheFleet =
      type === 'delivery-person.removed' || (type === 'delivery-person.activation-changed' && isActive === false);
    if (!leftTheFleet) return { outcome: 'ignored' };

    const { releasedOrderIds } = await this.releaseOrders.execute({ deliveryPersonId });
    return { outcome: 'checked', releasedOrderIds };
  }
}
