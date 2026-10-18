import { MAX_PAGE_LIMIT } from '../../../shared-kernel/application';
import type { FetchHttpClient, HttpRequestOptions } from '../../../shared-kernel/infra';
import type { DispatchBoardGateway, RequestOptions } from '../../application';
import type { AvailableCourier, ReadyOrder } from '../../domain';
import {
  availableCouriersSchema,
  readyOrdersSchema,
  toAvailableCouriers,
  toReadyOrders,
} from '../mappers/dispatch-board.mapper';

/** ACL sobre `/orders` (prontos, mais antigos primeiro) e `/delivery-persons` (ativos e livres). */
export class HttpDispatchBoardGateway implements DispatchBoardGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async readyOrders(options: RequestOptions = {}): Promise<{ orders: ReadyOrder[]; total: number }> {
    const body = await this.http.request(
      withSignal(
        {
          path: '/orders',
          query: { status: 'ready', limit: MAX_PAGE_LIMIT, sortBy: 'createdAt', sortOrder: 'asc' },
        },
        options,
      ),
      readyOrdersSchema,
    );
    return { orders: toReadyOrders(body), total: body.pagination.total };
  }

  async availableCouriers(options: RequestOptions = {}): Promise<AvailableCourier[]> {
    const body = await this.http.request(
      withSignal({ path: '/delivery-persons', query: { isActive: true, available: true } }, options),
      availableCouriersSchema,
    );
    return toAvailableCouriers(body);
  }
}

function withSignal(request: HttpRequestOptions, options: RequestOptions): HttpRequestOptions {
  return options.signal === undefined ? request : { ...request, signal: options.signal };
}
