import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { DeliveryPersonId, DeliveryPersonNotFoundError } from '../../../domain';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

export type RemoveDeliveryPersonInput = {
  readonly id: string;
};

/**
 * Remove (soft delete) um entregador. Com pedido `delivering`, não pode ser
 * removido; pedidos antigos continuam referenciando (e exibindo) o entregador.
 */
export class RemoveDeliveryPersonUseCase implements UseCase<RemoveDeliveryPersonInput, void> {
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveDeliveryPersonInput): Promise<void> {
    const { id } = validateInput({ id: () => DeliveryPersonId.from(input.id) });

    await this.unitOfWork.transaction(async ({ deliveryPersons, dispatchBoard }) => {
      // Trava antes de verificar: um despacho concorrente termina antes (e é visto)
      // ou espera e encontra o entregador já removido.
      const person = await deliveryPersons.findByIdForUpdate(id);
      if (person === null) throw new DeliveryPersonNotFoundError(input.id);

      const hasDeliveryInProgress = await dispatchBoard.hasDeliveryInProgress(id);
      person.remove({ hasDeliveryInProgress, now: this.clock.now() });

      await deliveryPersons.save(person);
    });
  }
}
