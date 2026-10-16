import type { UseCase } from '../../../../shared-kernel/application';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

export type ListDeliveryPersonsInput = {
  readonly isActive?: boolean | undefined;
  /** `true`: só quem não tem pedido `delivering`; `false`: só quem tem. */
  readonly available?: boolean | undefined;
};

export type DeliveryPersonList = {
  readonly data: readonly DeliveryPersonDto[];
};

/**
 * Lista os entregadores (sem removidos), ordenados por nome, com o pedido em
 * andamento de cada um. Duas consultas no total, qualquer que seja a frota.
 */
export class ListDeliveryPersonsUseCase
  implements UseCase<ListDeliveryPersonsInput, DeliveryPersonList>
{
  constructor(private readonly unitOfWork: DeliveryUnitOfWork) {}

  async execute(input: ListDeliveryPersonsInput): Promise<DeliveryPersonList> {
    return this.unitOfWork.transaction(async ({ deliveryPersons, dispatchBoard }) => {
      const [people, deliveries] = await Promise.all([
        deliveryPersons.list({ isActive: input.isActive ?? null }),
        dispatchBoard.deliveriesInProgress(),
      ]);
      const currentOrders = new Map(
        deliveries.map((delivery) => [delivery.deliveryPersonId.value, delivery.orderId.value]),
      );

      const data = people
        .filter((person) => {
          if (input.available === undefined) return true;
          const isAvailable = !currentOrders.has(person.id.value);
          return isAvailable === input.available;
        })
        .map((person) => toDeliveryPersonDto(person, currentOrders.get(person.id.value) ?? null));
      return { data };
    });
  }
}
