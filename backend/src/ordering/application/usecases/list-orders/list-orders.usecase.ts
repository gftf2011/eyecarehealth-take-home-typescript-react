import {
  PageRequest,
  parseSortDirection,
  parseSortField,
  toPage,
  validateInput,
  type Page,
  type UseCase,
} from '../../../../shared-kernel/application';
import { DatePeriod, LocalDate } from '../../../../shared-kernel/domain';
import { ORDER_SORT_FIELDS, OrderStatus, type OrderListCriteria } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ListOrdersInput = {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  /** Status atual do pedido. */
  readonly status?: string | undefined;
  /** Dia local (`YYYY-MM-DD`, fuso do negócio) a partir do qual o pedido foi criado. */
  readonly startDate?: string | undefined;
  /** Último dia local (inclusive) de criação. */
  readonly endDate?: string | undefined;
  /** `createdAt` (padrão) ou `totalAmount`. */
  readonly sortBy?: string | undefined;
  /** `asc` ou `desc` (padrão). */
  readonly sortOrder?: string | undefined;
};

/**
 * Lista pedidos com paginação, filtro por status e por dia de criação, e
 * ordenação. Os entregadores da página são buscados em uma única consulta.
 */
export class ListOrdersUseCase implements UseCase<ListOrdersInput, Page<OrderDto>> {
  constructor(private readonly unitOfWork: OrderingUnitOfWork) {}

  async execute(input: ListOrdersInput): Promise<Page<OrderDto>> {
    const validated = validateInput({
      page: () => PageRequest.create(input.page, input.limit),
      status: () => (input.status === undefined ? null : OrderStatus.create(input.status).value),
      period: () => parseCreationPeriod(input.startDate, input.endDate),
      sortField: () => parseSortField(input.sortBy, ORDER_SORT_FIELDS, 'createdAt'),
      sortDirection: () => parseSortDirection(input.sortOrder, 'desc'),
    });

    const criteria: OrderListCriteria = {
      offset: validated.page.offset,
      limit: validated.page.limit,
      status: validated.status,
      createdAt: validated.period.toInstantRange(),
      sort: { field: validated.sortField, direction: validated.sortDirection },
    };

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const slice = await orders.list(criteria);
      const summaries = await loadDeliveryPersonSummaries(slice.items, deliveryPersons);
      return toPage(slice, validated.page, (order) => toOrderDto(order, summaries));
    });
  }
}

/** Datas inválidas são reportadas juntas; depois, fim antes do início. */
function parseCreationPeriod(startDate: string | undefined, endDate: string | undefined): DatePeriod {
  const { start, end } = validateInput({
    start: () => (startDate === undefined ? null : LocalDate.parse(startDate, 'startDate')),
    end: () => (endDate === undefined ? null : LocalDate.parse(endDate, 'endDate')),
  });
  return DatePeriod.of({ start, end });
}
