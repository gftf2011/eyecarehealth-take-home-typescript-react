import { mapPage, type Page } from '../../../shared-kernel/application';
import type { FetchHttpClient } from '../../../shared-kernel/infra';
import type { ProductGateway, RequestOptions } from '../../application';
import type { Product, ProductDetails, ProductListCriteria } from '../../domain';
import { productPageSchema, productSchema, toProduct, toProductRequestBody } from '../mappers/product.mapper';

/** `/api/products` com o cliente autenticado. */
export class HttpProductGateway implements ProductGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async list(criteria: ProductListCriteria, options: RequestOptions = {}): Promise<Page<Product>> {
    const page = await this.http.request(
      {
        path: '/products',
        query: {
          page: criteria.page,
          limit: criteria.limit,
          search: criteria.search,
          category: criteria.category,
          isAvailable: criteria.isAvailable,
          sortBy: criteria.sort.field,
          sortOrder: criteria.sort.direction,
        },
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      productPageSchema,
    );
    return mapPage(page, toProduct);
  }

  async create(details: ProductDetails): Promise<Product> {
    const body = await this.http.request(
      { method: 'POST', path: '/products', body: toProductRequestBody(details) },
      productSchema,
    );
    return toProduct(body);
  }

  async update(id: string, changes: Partial<ProductDetails>): Promise<Product> {
    const body = await this.http.request(
      { method: 'PUT', path: `/products/${encodeURIComponent(id)}`, body: toProductRequestBody(changes) },
      productSchema,
    );
    return toProduct(body);
  }

  remove(id: string): Promise<void> {
    return this.http.requestVoid({ method: 'DELETE', path: `/products/${encodeURIComponent(id)}` });
  }
}
