import {
  parseDatePeriodInput,
  validateInput,
  type UseCase,
} from '../../../../shared-kernel/application';
import { DeliveryTimeReport, type DeliveryTimeQuery } from '../../../domain';
import { toDeliveryTimeReportDto, type DeliveryTimeReportDto } from '../../dtos/report.dtos';

export type GetDeliveryTimeReportInput = {
  /** Opcional, `YYYY-MM-DD`: filtra pela data da entrega. */
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
};

/**
 * Tempo de entrega (criação → transição para `delivered`): média geral,
 * extremos e quebra por tipo de veículo do entregador.
 */
export class GetDeliveryTimeReportUseCase
  implements UseCase<GetDeliveryTimeReportInput, DeliveryTimeReportDto>
{
  constructor(private readonly deliveryTime: DeliveryTimeQuery) {}

  async execute(input: GetDeliveryTimeReportInput): Promise<DeliveryTimeReportDto> {
    const { period } = validateInput({
      period: () => parseDatePeriodInput(input.startDate, input.endDate),
    });

    const rows = await this.deliveryTime.statsByVehicleType(period.toInstantRange());
    return toDeliveryTimeReportDto(DeliveryTimeReport.build(rows));
  }
}
