import type { FetchHttpClient } from '../../../shared-kernel/infra';
import type { MyDeliveriesGateway, RequestOptions } from '../../application';
import type { GeoLocation, MyDeliveries } from '../../domain';
import { myDeliveriesSchema, toMyDeliveries } from '../mappers/my-deliveries.mapper';

/** `/api/me/...` com o cliente autenticado: o entregador vem do token. */
export class HttpMyDeliveriesGateway implements MyDeliveriesGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async load(options: RequestOptions = {}): Promise<MyDeliveries> {
    const body = await this.http.request(
      { path: '/me/deliveries', ...(options.signal === undefined ? {} : { signal: options.signal }) },
      myDeliveriesSchema,
    );
    return toMyDeliveries(body);
  }

  confirmDelivered(orderId: string): Promise<void> {
    return this.http.requestVoid({ method: 'POST', path: `/me/deliveries/${encodeURIComponent(orderId)}/delivered` });
  }

  updateLocation(location: GeoLocation): Promise<void> {
    return this.http.requestVoid({
      method: 'PUT',
      path: '/me/location',
      body: { latitude: location.latitude, longitude: location.longitude },
    });
  }
}
