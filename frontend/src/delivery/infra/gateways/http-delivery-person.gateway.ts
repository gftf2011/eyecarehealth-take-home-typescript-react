import type { FetchHttpClient } from '../../../shared-kernel/infra';
import type { DeliveryPersonGateway, RequestOptions } from '../../application';
import type { DeliveryPerson, DeliveryPersonDetails, DeliveryPersonListCriteria } from '../../domain';
import {
  deliveryPersonListSchema,
  deliveryPersonSchema,
  toDeliveryPerson,
  toDeliveryPersonRequestBody,
} from '../mappers/delivery-person.mapper';

/** `/api/delivery-persons` com o cliente autenticado. */
export class HttpDeliveryPersonGateway implements DeliveryPersonGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async list(criteria: DeliveryPersonListCriteria, options: RequestOptions = {}): Promise<DeliveryPerson[]> {
    const body = await this.http.request(
      {
        path: '/delivery-persons',
        query: { isActive: criteria.isActive, available: criteria.available },
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      deliveryPersonListSchema,
    );
    return body.data.map(toDeliveryPerson);
  }

  async register(details: DeliveryPersonDetails): Promise<DeliveryPerson> {
    const body = await this.http.request(
      { method: 'POST', path: '/delivery-persons', body: toDeliveryPersonRequestBody(details) },
      deliveryPersonSchema,
    );
    return toDeliveryPerson(body);
  }

  async update(id: string, changes: Partial<DeliveryPersonDetails>): Promise<DeliveryPerson> {
    const body = await this.http.request(
      { method: 'PUT', path: `/delivery-persons/${encodeURIComponent(id)}`, body: toDeliveryPersonRequestBody(changes) },
      deliveryPersonSchema,
    );
    return toDeliveryPerson(body);
  }

  remove(id: string): Promise<void> {
    return this.http.requestVoid({ method: 'DELETE', path: `/delivery-persons/${encodeURIComponent(id)}` });
  }
}
