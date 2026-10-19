import { mapPage, type Page } from '../../../shared-kernel/application';
import type { FetchHttpClient, HttpRequestOptions } from '../../../shared-kernel/infra';
import type { DeliveryIssueDecision, OrderGateway, RequestOptions } from '../../application';
import type { Order, OrderListCriteria, OrderStatusValue, ReturnReason } from '../../domain';
import { orderPageSchema, orderSchema, toOrder } from '../mappers/order.mapper';

/** `/api/orders` com o cliente autenticado (token e renovação ficam no cliente HTTP). */
export class HttpOrderGateway implements OrderGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async list(criteria: OrderListCriteria, options: RequestOptions = {}): Promise<Page<Order>> {
    const page = await this.http.request(
      withSignal(
        {
          path: '/orders',
          query: {
            cursor: criteria.cursor,
            limit: criteria.limit,
            status: criteria.status,
            startDate: criteria.createdOn.start?.toString(),
            endDate: criteria.createdOn.end?.toString(),
            sortBy: criteria.sort.field,
            sortOrder: criteria.sort.direction,
          },
        },
        options,
      ),
      orderPageSchema,
    );
    return mapPage(page, toOrder);
  }

  async findById(id: string, options: RequestOptions = {}): Promise<Order> {
    const body = await this.http.request(
      withSignal({ path: `/orders/${encodeURIComponent(id)}` }, options),
      orderSchema,
    );
    return toOrder(body);
  }

  async changeStatus(id: string, status: OrderStatusValue): Promise<Order> {
    const body = await this.http.request(
      { method: 'PATCH', path: `/orders/${encodeURIComponent(id)}/status`, body: { status } },
      orderSchema,
    );
    return toOrder(body);
  }

  async resolveDeliveryIssue(id: string, decision: DeliveryIssueDecision): Promise<Order> {
    const body = await this.http.request(
      { method: 'POST', path: `/orders/${encodeURIComponent(id)}/delivery-issue/${decision}` },
      orderSchema,
    );
    return toOrder(body);
  }

  async returnToAssignment(id: string, reason: ReturnReason): Promise<Order> {
    const body = await this.http.request(
      {
        method: 'POST',
        path: `/orders/${encodeURIComponent(id)}/return-to-assignment`,
        body: { reason: reason.value },
      },
      orderSchema,
    );
    return toOrder(body);
  }
}

function withSignal(request: HttpRequestOptions, options: RequestOptions): HttpRequestOptions {
  return options.signal === undefined ? request : { ...request, signal: options.signal };
}
