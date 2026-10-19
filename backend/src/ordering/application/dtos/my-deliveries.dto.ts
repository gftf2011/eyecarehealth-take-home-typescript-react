import type { DeliveryPersonSummary } from '../ports/delivery-person-directory';
import type { OrderDto } from './order.dto';

/** A tela do entregador: a entrega em andamento e as próximas, já atribuídas a ele. */
export type MyDeliveriesDto = {
  readonly deliveryPerson: DeliveryPersonSummary;
  /** O pedido `delivering` dele (no máximo um, garantido pelo banco). */
  readonly inProgress: OrderDto | null;
  /** Atribuídos a ele e ainda não despachados, mais antigos primeiro. */
  readonly upcoming: readonly OrderDto[];
};
