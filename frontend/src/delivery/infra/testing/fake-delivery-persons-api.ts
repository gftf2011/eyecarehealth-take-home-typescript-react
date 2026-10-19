import { http, HttpResponse, type HttpHandler } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';
import type { DeliveryPersonBodyFixture } from '../../domain/delivery-person/testing/delivery-person.fixture';

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

type WritableFields = Omit<DeliveryPersonBodyFixture, 'id' | 'currentOrderId' | 'createdAt' | 'updatedAt'>;

/**
 * Imitação de `/api/delivery-persons` com o que a tela usa: filtros de
 * ativação e de entrega em andamento, CRUD e o `409 DELIVERY_PERSON_IN_USE`
 * (entregador com pedido em `delivering`).
 */
export class FakeDeliveryPersonsApi {
  persons: DeliveryPersonBodyFixture[] = [];
  readonly listQueries: URLSearchParams[] = [];
  readonly writes: { method: string; id: string | null; body: unknown }[] = [];
  /** Força a próxima escrita a falhar (ex.: queda da API no meio da ação). */
  failNextWrite: { status: number; code: string; message: string; details?: unknown[] } | null = null;
  #sequence = 0;

  given(...persons: DeliveryPersonBodyFixture[]): void {
    this.persons = persons.map((person) => structuredClone(person));
  }

  handlers(): HttpHandler[] {
    return [
      http.get(apiUrl('/delivery-persons'), ({ request }) => {
        const query = new URL(request.url).searchParams;
        this.listQueries.push(query);
        const active = query.get('isActive');
        const available = query.get('available');
        return HttpResponse.json({
          data: this.persons.filter(
            (person) =>
              (active === null || String(person.isActive) === active) &&
              (available === null || String(person.currentOrderId === null) === available),
          ),
        });
      }),

      http.post(apiUrl('/delivery-persons'), async ({ request }) => {
        const body = (await request.json()) as WritableFields;
        this.writes.push({ method: 'POST', id: null, body });
        const failure = this.#takeFailure();
        if (failure !== null) return failure;
        this.#sequence += 1;
        const now = new Date().toISOString();
        const created: DeliveryPersonBodyFixture = {
          ...body,
          id: `courier-new-${this.#sequence}`,
          currentOrderId: null,
          createdAt: now,
          updatedAt: now,
        };
        this.persons.unshift(created);
        return HttpResponse.json(created, { status: 201 });
      }),

      http.put(apiUrl('/delivery-persons/:id'), async ({ params, request }) => {
        const body = (await request.json()) as Partial<WritableFields>;
        this.writes.push({ method: 'PUT', id: String(params.id), body });
        const failure = this.#takeFailure();
        if (failure !== null) return failure;
        const person = this.persons.find((candidate) => candidate.id === params.id);
        if (person === undefined) return apiError(404, 'DELIVERY_PERSON_NOT_FOUND', 'Entregador não encontrado');
        Object.assign(person, body, { updatedAt: new Date().toISOString() });
        return HttpResponse.json(person);
      }),

      http.delete(apiUrl('/delivery-persons/:id'), ({ params }) => {
        const id = String(params.id);
        this.writes.push({ method: 'DELETE', id, body: null });
        const person = this.persons.find((candidate) => candidate.id === id);
        if (person?.currentOrderId !== null && person !== undefined) {
          return apiError(
            409,
            'DELIVERY_PERSON_IN_USE',
            "Não é possível remover este entregador pois ele está atribuído a um pedido com status 'delivering'",
            // Mesmo formato do backend: o detalhe não é por campo.
            [{ deliveryPersonId: id }],
          );
        }
        this.persons = this.persons.filter((candidate) => candidate.id !== id);
        return new HttpResponse(null, { status: 204 });
      }),
    ];
  }

  #takeFailure() {
    const failure = this.failNextWrite;
    this.failNextWrite = null;
    return failure === null ? null : apiError(failure.status, failure.code, failure.message, failure.details);
  }
}
