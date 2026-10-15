import type { PageSlice } from '../../../shared-kernel/application/index.js';
import type { ProductId } from '../../domain/index.js';
import type { ProductDto } from '../dtos/product.dto.js';
import type { ProductListCriteria, ProductQuery } from '../queries/product.query.js';

/**
 * Stub do port de leitura: devolve respostas pré-definidas e registra os
 * critérios recebidos. A filtragem/ordenação real é responsabilidade do SQL e
 * é coberta pelos testes de integração do adapter.
 */
export class StubProductQuery implements ProductQuery {
  readonly products = new Map<string, ProductDto>();
  readonly listCalls: ProductListCriteria[] = [];
  listResult: PageSlice<ProductDto> = { items: [], total: 0 };

  givenProducts(...products: ProductDto[]): void {
    for (const product of products) this.products.set(product.id, product);
  }

  async findById(id: ProductId): Promise<ProductDto | null> {
    return this.products.get(id.value) ?? null;
  }

  async list(criteria: ProductListCriteria): Promise<PageSlice<ProductDto>> {
    this.listCalls.push(criteria);
    return this.listResult;
  }
}
