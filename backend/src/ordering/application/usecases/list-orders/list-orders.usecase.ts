import {
  CursorPageRequest,
  parseDatePeriodInput,
  parsePageLimit,
  parseSortDirection,
  parseSortField,
  readCursorPage,
  validateInput,
  type Page,
  type UseCase,
} from '../../../../shared-kernel/application';
import { ORDER_SORT_FIELDS, ORDER_SORT_KEYS, OrderStatus } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ListOrdersInput = {
  /** `nextCursor` ou `previousCursor` de uma resposta anterior; sem ele, a primeira página. */
  readonly cursor?: string | undefined;
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
 * Lista pedidos com paginação por cursor, filtro por status e por dia de
 * criação, e ordenação. Os entregadores da página são buscados em uma única
 * consulta.
 */
export class ListOrdersUseCase implements UseCase<ListOrdersInput, Page<OrderDto>> {
  constructor(private readonly unitOfWork: OrderingUnitOfWork) {}

  async execute(input: ListOrdersInput): Promise<Page<OrderDto>> {
    const validated = validateInput({
      limit: () => parsePageLimit(input.limit),
      status: () => (input.status === undefined ? null : OrderStatus.create(input.status).value),
      period: () => parseDatePeriodInput(input.startDate, input.endDate),
      sortField: () => parseSortField(input.sortBy, ORDER_SORT_FIELDS, 'createdAt'),
      sortDirection: () => parseSortDirection(input.sortOrder, 'desc'),
    });
    const sortKey = ORDER_SORT_KEYS[validated.sortField];
    const { page } = validateInput({
      page: () =>
        CursorPageRequest.create(
          { field: validated.sortField, direction: validated.sortDirection },
          validated.limit,
          input.cursor,
          sortKey,
        ),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) =>
      readCursorPage(
        page,
        sortKey,
        (keyset) =>
          orders.list({
            limit: page.limit,
            keyset,
            status: validated.status,
            createdAt: validated.period.toInstantRange(),
            sort: page.sort,
          }),
        async (items) => {
          const summaries = await loadDeliveryPersonSummaries(items, deliveryPersons);
          return items.map((order) => toOrderDto(order, summaries));
        },
      ),
    );
  }
}
