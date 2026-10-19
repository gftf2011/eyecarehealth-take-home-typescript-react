import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import {
  DeliveryIssueId,
  DeliveryIssueNote,
  DeliveryIssueReason,
  OrderId,
  OrderNotFoundError,
} from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ReportMyDeliveryIssueInput = {
  /** Usuário logado (do token). */
  readonly userId: string;
  readonly orderId: string;
  readonly reason: string;
  readonly note?: string | null | undefined;
};

/**
 * O entregador relata que não conseguiu entregar. **Só o dono**: pedido de
 * outro entregador responde como inexistente (`404`). O pedido continua com
 * ele, em `delivering`, até o gestor decidir.
 */
export class ReportMyDeliveryIssueUseCase implements UseCase<ReportMyDeliveryIssueInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReportMyDeliveryIssueInput): Promise<OrderDto> {
    const { orderId, reason, note } = validateInput({
      orderId: () => OrderId.from(input.orderId),
      reason: () => DeliveryIssueReason.create(input.reason),
      note: () => DeliveryIssueNote.createOptional(input.note),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const me = await deliveryPersons.deliveryPersonOfUser(input.userId);
      if (me === null) throw new DeliveryPersonNotLinkedError();

      const order = await orders.findByIdForUpdate(orderId);
      if (order?.deliveryPersonId?.value !== me.id) throw new OrderNotFoundError(input.orderId);

      order.reportDeliveryIssue({ id: DeliveryIssueId.generate(), reason, note, now: this.clock.now() });
      await orders.save(order);
      return toOrderDto(order, new Map([[me.id, me]]));
    });
  }
}
