import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { insertDeliveryPerson, insertProduct } from '../infra/persistence/testing/ordering-test-data';

const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
/** O entregador logado nos testes (perfil `courier`). */
const ME = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
/** Outro entregador, sempre livre: atribuir e despachar não dependem de ME estar ocupado. */
const OTHER = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const PASSWORD = 'Senha@1234';

type Http = { readonly method: 'POST' | 'PATCH'; readonly url: string; readonly payload?: object; readonly as: 'admin' | 'me' };

const STATES = [
  'pending',
  'preparing',
  'ready',
  'ready com entregador',
  'delivering',
  'problema: cliente ausente',
  'problema: cliente recusou',
  'problema depois de 2 novas tentativas',
  'delivered',
  'cancelled',
] as const;
type State = (typeof STATES)[number];

const ACTIONS = {
  'status → preparing': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'preparing' }, as: 'admin' }),
  'status → ready': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'ready' }, as: 'admin' }),
  'status → delivering': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'delivering' }, as: 'admin' }),
  'status → delivered': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'delivered' }, as: 'admin' }),
  'status → cancelled': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'cancelled' }, as: 'admin' }),
  'status → pending': (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/status`, payload: { status: 'pending' }, as: 'admin' }),
  atribuir: (id: string): Http => ({ method: 'PATCH', url: `/api/orders/${id}/assign`, payload: { deliveryPersonId: OTHER }, as: 'admin' }),
  despachar: (id: string): Http => ({ method: 'POST', url: `/api/orders/${id}/dispatch`, payload: { deliveryPersonId: OTHER }, as: 'admin' }),
  devolver: (id: string): Http => ({ method: 'POST', url: `/api/orders/${id}/return-to-assignment`, payload: { reason: 'Sem contato' }, as: 'admin' }),
  'tentar de novo': (id: string): Http => ({ method: 'POST', url: `/api/orders/${id}/delivery-issue/retry`, as: 'admin' }),
  'cancelar entrega': (id: string): Http => ({ method: 'POST', url: `/api/orders/${id}/delivery-issue/cancel`, as: 'admin' }),
  'entregador relata problema': (id: string): Http => ({ method: 'POST', url: `/api/me/deliveries/${id}/issue`, payload: { reason: 'customer_absent' }, as: 'me' }),
  'entregador confirma': (id: string): Http => ({ method: 'POST', url: `/api/me/deliveries/${id}/delivered`, as: 'me' }),
} as const;
type Action = keyof typeof ACTIONS;

/**
 * O que a API deve responder a cada ação em cada estado: 200 permitido, 422
 * regra de negócio, 404 pedido que não é do entregador. Nunca 500.
 */
const EXPECTED: Readonly<Record<State, Readonly<Record<Action, 200 | 404 | 422>>>> = {
  pending: row({ 'status → preparing': 200, 'status → cancelled': 200, atribuir: 200 }, 404),
  preparing: row({ 'status → ready': 200, 'status → cancelled': 200, atribuir: 200 }, 404),
  ready: row({ 'status → cancelled': 200, atribuir: 200, despachar: 200 }, 404),
  'ready com entregador': row({ 'status → delivering': 200, 'status → cancelled': 200, atribuir: 200, despachar: 200 }, 422),
  delivering: row({ 'status → delivered': 200, devolver: 200, 'entregador relata problema': 200, 'entregador confirma': 200 }, 422),
  'problema: cliente ausente': row({ devolver: 200, 'tentar de novo': 200, 'cancelar entrega': 200 }, 422),
  'problema: cliente recusou': row({ 'cancelar entrega': 200 }, 422),
  'problema depois de 2 novas tentativas': row({ devolver: 200, 'cancelar entrega': 200 }, 422),
  delivered: row({}, 422),
  cancelled: row({}, 404),
};

/** As ações permitidas valem 200; as outras do gestor, 422; as do entregador, o código dado. */
function row(allowed: Partial<Record<Action, 200>>, courierWhenNotAllowed: 404 | 422): Record<Action, 200 | 404 | 422> {
  return Object.fromEntries(
    (Object.keys(ACTIONS) as Action[]).map((action) => [
      action,
      allowed[action] ?? (action.startsWith('entregador') ? courierWhenNotAllowed : 422),
    ]),
  ) as Record<Action, 200 | 404 | 422>;
}

describe('Matriz de estados × ações da API de pedidos', () => {
  let testApp: TestApp;
  const tokens = { admin: '', me: '' };

  const send = ({ method, url, payload, as }: Http) =>
    testApp.app.inject({ method, url, headers: { authorization: `Bearer ${tokens[as]}` }, ...(payload && { payload }) });

  async function expectOk(http: Http): Promise<void> {
    const response = await send(http);
    expect(response.statusCode, `${http.method} ${http.url}: ${response.body}`).toBeLessThan(300);
  }

  /** Um pedido novo levado até o estado pedido, pelas mesmas rotas que o painel usa. */
  async function orderIn(state: State): Promise<string> {
    const placed = await send({
      method: 'POST',
      url: '/api/orders',
      as: 'admin',
      payload: {
        customerName: 'Cliente da Matriz',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        items: [{ productId: BURGER_ID, quantity: 1 }],
      },
    });
    const id: string = placed.json().id;
    const status = (value: string) => expectOk(ACTIONS[`status → ${value}` as Action](id));
    const report = (reason: string) =>
      expectOk({ method: 'POST', url: `/api/me/deliveries/${id}/issue`, payload: { reason }, as: 'me' });
    if (state === 'pending') return id;
    if (state === 'cancelled') {
      await status('cancelled');
      return id;
    }
    await status('preparing');
    if (state === 'preparing') return id;
    await status('ready');
    if (state === 'ready') return id;
    await expectOk({ method: 'PATCH', url: `/api/orders/${id}/assign`, payload: { deliveryPersonId: ME }, as: 'admin' });
    if (state === 'ready com entregador') return id;
    await status('delivering');
    if (state === 'delivering') return id;
    if (state === 'delivered') {
      await status('delivered');
      return id;
    }
    if (state === 'problema: cliente recusou') {
      await report('refused');
      return id;
    }
    if (state === 'problema depois de 2 novas tentativas') {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await report('customer_absent');
        await expectOk(ACTIONS['tentar de novo'](id));
      }
    }
    await report('customer_absent');
    return id;
  }

  async function login(email: string): Promise<string> {
    const response = await testApp.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    return response.json().accessToken;
  }

  // Usuários e entregadores uma vez (o bcrypt é lento de propósito); só os pedidos mudam entre os casos.
  beforeAll(async () => {
    testApp = await buildTestApp({ auth: 'jwt', rateLimit: { max: 100_000 } });
    await resetDatabase(testApp.orderingDb);
    const raw = testApp.orderingDb as unknown as Kysely<unknown>;
    await testApp.givenUser('admin@fastmeals.com', PASSWORD, 'admin');
    const me = await testApp.givenUser('eu@fastmeals.com', PASSWORD, 'courier');
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertDeliveryPerson(raw, { id: ME, name: 'Carlos Santos', userId: me.id.value });
    await insertDeliveryPerson(raw, { id: OTHER, name: 'Ana Lima' });
    tokens.admin = await login('admin@fastmeals.com');
    tokens.me = await login('eu@fastmeals.com');
  });

  beforeEach(async () => {
    // Cada caso começa sem pedidos: o entregador volta a estar livre.
    await sql`TRUNCATE orders, outbox_events CASCADE`.execute(testApp.orderingDb);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const CELLS = STATES.flatMap((state) => (Object.keys(ACTIONS) as Action[]).map((action) => [state, action] as const));

  it.each(CELLS)('%s → %s', async (state, action) => {
    const id = await orderIn(state);

    const response = await send(ACTIONS[action](id));

    expect({ status: response.statusCode, body: response.json() }).toMatchObject({ status: EXPECTED[state][action] });
  });
});
