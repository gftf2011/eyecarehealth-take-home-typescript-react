import { NotFoundError } from '../../../shared-kernel/domain';

/** O usuário logado não é o login de nenhum entregador da frota (ou ele foi removido). */
export class DeliveryPersonNotLinkedError extends NotFoundError {
  readonly code = 'DELIVERY_PERSON_NOT_LINKED';

  constructor() {
    super('Nenhum entregador da frota está vinculado a este usuário');
  }
}
