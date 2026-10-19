import type { UseCase } from '../../../../shared-kernel/application';
import { DeliveryPersonId } from '../../../domain';
import type { MyDeliveriesDto } from '../../dtos/my-deliveries.dto';
import { toOrderDto } from '../../dtos/order.dto';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type GetMyDeliveriesInput = {
  /** Usuário logado (do token). */
  readonly userId: string;
};

/**
 * As entregas do entregador logado: só as dele, com os dados de que precisa
 * para entregar (cliente, telefone, endereço, itens). O entregador vem do
 * usuário do token; não há como pedir as de outro.
 */
export class GetMyDeliveriesUseCase implements UseCase<GetMyDeliveriesInput, MyDeliveriesDto> {
  constructor(private readonly unitOfWork: OrderingUnitOfWork) {}

  async execute({ userId }: GetMyDeliveriesInput): Promise<MyDeliveriesDto> {
    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const me = await deliveryPersons.deliveryPersonOfUser(userId);
      if (me === null) throw new DeliveryPersonNotLinkedError();

      const open = await orders.listOpenAssignedTo(DeliveryPersonId.from(me.id));
      const summaries = new Map([[me.id, me]]);
      const inProgress = open.find((order) => order.status.is('delivering'));
      return {
        deliveryPerson: me,
        inProgress: inProgress === undefined ? null : toOrderDto(inProgress, summaries),
        upcoming: open.filter((order) => order !== inProgress).map((order) => toOrderDto(order, summaries)),
      };
    });
  }
}
