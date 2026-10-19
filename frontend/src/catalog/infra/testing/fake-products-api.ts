import { http, HttpResponse, type HttpHandler } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';
import type { ProductBodyFixture } from '../../domain/product/testing/product.fixture';

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

/**
 * Imitação de `/api/products` com o que a tela usa: busca parcial sem
 * diferenciar maiúsculas, filtros, paginação, CRUD e o `409 PRODUCT_IN_USE`.
 */
export class FakeProductsApi {
  products: ProductBodyFixture[] = [];
  /** Produtos em pedidos abertos: a exclusão é recusada. */
  readonly inUse = new Set<string>();
  readonly listQueries: URLSearchParams[] = [];
  readonly writes: { method: string; id: string | null; body: unknown }[] = [];
  /** Força a próxima escrita a falhar (ex.: queda da API no meio da ação). */
  failNextWrite: { status: number; code: string; message: string } | null = null;
  #sequence = 0;

  given(...products: ProductBodyFixture[]): void {
    this.products = products.map((product) => structuredClone(product));
  }

  handlers(): HttpHandler[] {
    return [
      http.get(apiUrl('/products'), ({ request }) => {
        const query = new URL(request.url).searchParams;
        this.listQueries.push(query);
        const search = query.get('search')?.toLowerCase();
        const category = query.get('category');
        const available = query.get('isAvailable');
        const page = Number(query.get('page') ?? '1');
        const limit = Number(query.get('limit') ?? '20');

        const matching = this.products.filter(
          (product) =>
            (search === undefined || product.name.toLowerCase().includes(search)) &&
            (category === null || product.category === category) &&
            (available === null || String(product.isAvailable) === available),
        );
        return HttpResponse.json({
          data: matching.slice((page - 1) * limit, page * limit),
          pagination: { page, limit, total: matching.length, totalPages: Math.ceil(matching.length / limit) },
        });
      }),

      http.post(apiUrl('/products'), async ({ request }) => {
        const body = (await request.json()) as Omit<ProductBodyFixture, 'id' | 'createdAt' | 'updatedAt'>;
        this.writes.push({ method: 'POST', id: null, body });
        const failure = this.#takeFailure();
        if (failure !== null) return failure;
        this.#sequence += 1;
        const now = new Date().toISOString();
        const created: ProductBodyFixture = { ...body, id: `product-new-${this.#sequence}`, createdAt: now, updatedAt: now };
        this.products.unshift(created);
        return HttpResponse.json(created, { status: 201 });
      }),

      http.put(apiUrl('/products/:id'), async ({ params, request }) => {
        const body = (await request.json()) as Partial<ProductBodyFixture>;
        this.writes.push({ method: 'PUT', id: String(params.id), body });
        const failure = this.#takeFailure();
        if (failure !== null) return failure;
        const product = this.products.find((candidate) => candidate.id === params.id);
        if (product === undefined) return apiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado');
        Object.assign(product, body, { updatedAt: new Date().toISOString() });
        return HttpResponse.json(product);
      }),

      http.delete(apiUrl('/products/:id'), ({ params }) => {
        const id = String(params.id);
        this.writes.push({ method: 'DELETE', id, body: null });
        if (this.inUse.has(id)) {
          // Mesmo formato do backend: o detalhe não é por campo.
          return apiError(409, 'PRODUCT_IN_USE', 'O produto está em pedidos em andamento e não pode ser removido.', [
            { productId: id },
          ]);
        }
        this.products = this.products.filter((product) => product.id !== id);
        return new HttpResponse(null, { status: 204 });
      }),
    ];
  }

  #takeFailure() {
    const failure = this.failNextWrite;
    this.failNextWrite = null;
    return failure === null ? null : apiError(failure.status, failure.code, failure.message);
  }
}
