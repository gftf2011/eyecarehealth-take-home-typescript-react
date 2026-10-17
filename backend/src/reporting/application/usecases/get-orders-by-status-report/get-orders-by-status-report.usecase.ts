import {
  parseDatePeriodInput,
  validateInput,
  type UseCase,
} from '../../../../shared-kernel/application';
import { OrdersByStatusReport, type OrdersByStatusQuery } from '../../../domain';
import { toOrdersByStatusReportDto, type OrdersByStatusReportDto } from '../../dtos/report.dtos';

export type GetOrdersByStatusReportInput = {
  /** Opcional, `YYYY-MM-DD`: filtra pela data de criação do pedido. */
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
};

/**
 * Pedidos por status atual, sempre com os 6 status. O período (opcional) é
 * aplicado à criação: pedidos não entregues não têm data de entrega.
 */
export class GetOrdersByStatusReportUseCase
  implements UseCase<GetOrdersByStatusReportInput, OrdersByStatusReportDto>
{
  constructor(private readonly ordersByStatus: OrdersByStatusQuery) {}

  async execute(input: GetOrdersByStatusReportInput): Promise<OrdersByStatusReportDto> {
    const { period } = validateInput({
      period: () => parseDatePeriodInput(input.startDate, input.endDate),
    });

    const rows = await this.ordersByStatus.countByStatus(period.toInstantRange());
    return toOrdersByStatusReportDto(OrdersByStatusReport.build(rows));
  }
}
