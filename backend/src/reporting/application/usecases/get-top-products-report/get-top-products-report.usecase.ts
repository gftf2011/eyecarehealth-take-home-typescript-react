import {
  parseDatePeriodInput,
  validateInput,
  type UseCase,
} from '../../../../shared-kernel/application';
import { TopProductsLimit, TopProductsReport, type TopProductsQuery } from '../../../domain';
import { toTopProductsReportDto, type TopProductsReportDto } from '../../dtos/report.dtos';

export type GetTopProductsReportInput = {
  /** Opcional, `YYYY-MM-DD`: filtra pela data da entrega. */
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
  /** Tamanho do ranking. Padrão: 10. */
  readonly limit?: number | undefined;
};

/** Produtos mais vendidos por quantidade, considerando só pedidos `delivered`. */
export class GetTopProductsReportUseCase
  implements UseCase<GetTopProductsReportInput, TopProductsReportDto>
{
  constructor(private readonly topProducts: TopProductsQuery) {}

  async execute(input: GetTopProductsReportInput): Promise<TopProductsReportDto> {
    const { period, limit } = validateInput({
      period: () => parseDatePeriodInput(input.startDate, input.endDate),
      limit: () => (input.limit === undefined ? TopProductsLimit.default() : TopProductsLimit.of(input.limit)),
    });

    const rows = await this.topProducts.salesByProduct(period.toInstantRange(), limit.value);
    return toTopProductsReportDto(TopProductsReport.build(rows, limit));
  }
}
