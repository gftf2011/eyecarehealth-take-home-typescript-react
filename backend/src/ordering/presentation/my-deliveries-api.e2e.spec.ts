import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { insertDeliveryPerson, insertProduct } from '../infra/persistence/testing/ordering-test-data';

const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const ME = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OTHER = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const PASSWORD = 'Senha@1234';

/**
 * O entregador logado (perfil `courier`) só enxerga e conclui as próprias
 * entregas: autorização por permissão **e** por dono do recurso.
 */
describe('Minhas entregas (/api/me/...)', () => {
  let testApp: TestApp;
  const tokens = { admin: '', me: '', other: '', unlinked: '' };

  async function login(email: string): Promise<string> {
    const response = await testApp.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(response.statusCode).toBe(200);
    return response.json().accessToken;
  }

  const request = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, token: string, payload?: object) =>
    testApp.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload && { payload }) });

  /** Pedido levado pelo admin até `status`, atribuído (ou despachado) ao entregador. */
  async function orderFor(courierId: string, status: 'ready' | 'delivering', customerName = 'Maria Oliveira'): Promise<string> {
    const placed = await request('POST', '/api/orders', tokens.admin, {
      customerName,
      customerPhone: '(21) 98765-4321',
      deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
      latitude: -22.9068,
      longitude: -43.1729,
      items: [{ productId: BURGER_ID, quantity: 1 }],
    });
    const id: string = placed.json().id;
    await request('PATCH', `/api/orders/${id}/status`, tokens.admin, { status: 'preparing' });
    await request('PATCH', `/api/orders/${id}/status`, tokens.admin, { status: 'ready' });
    const path = status === 'delivering' ? 'dispatch' : 'assign';
    const response = await request(status === 'delivering' ? 'POST' : 'PATCH', `/api/orders/${id}/${path}`, tokens.admin, {
      deliveryPersonId: courierId,
    });
    expect(response.statusCode).toBe(200);
    return id;
  }

  beforeAll(async () => {
    testApp = await buildTestApp({ auth: 'jwt' });
  });

  beforeEach(async () => {
    await resetDatabase(testApp.orderingDb);
    const raw = testApp.orderingDb as unknown as Kysely<unknown>;
    await testApp.givenUser('admin@fastmeals.com', PASSWORD, 'admin');
    const me = await testApp.givenUser('eu@fastmeals.com', PASSWORD, 'courier');
    const other = await testApp.givenUser('outro@fastmeals.com', PASSWORD, 'courier');
    await testApp.givenUser('sem.vinculo@fastmeals.com', PASSWORD, 'courier');
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertDeliveryPerson(raw, { id: ME, name: 'Carlos Santos', userId: me.id.value });
    await insertDeliveryPerson(raw, { id: OTHER, name: 'Ana Lima', userId: other.id.value });
    tokens.admin = await login('admin@fastmeals.com');
    tokens.me = await login('eu@fastmeals.com');
    tokens.other = await login('outro@fastmeals.com');
    tokens.unlinked = await login('sem.vinculo@fastmeals.com');
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('lista só as minhas: a entrega em andamento e as próximas, com o que preciso para entregar', async () => {
    // Atribuir exige o entregador livre: o próximo é atribuído antes do despacho do atual.
    const next = await orderFor(ME, 'ready', 'Cliente Próximo');
    const delivering = await orderFor(ME, 'delivering', 'Cliente Atual');
    await orderFor(OTHER, 'delivering', 'Cliente da Ana');

    const response = await request('GET', '/api/me/deliveries', tokens.me);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.deliveryPerson).toEqual({ id: ME, name: 'Carlos Santos' });
    expect(body.inProgress).toMatchObject({
      id: delivering,
      customerName: 'Cliente Atual',
      customerPhone: '(21) 98765-4321',
      deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
    });
    expect(body.upcoming.map((order: { id: string }) => order.id)).toEqual([next]);
  });

  it('confirma a própria entrega; a de outro entregador responde como inexistente', async () => {
    const mine = await orderFor(ME, 'delivering');
    const others = await orderFor(OTHER, 'delivering');

    const confirmed = await request('POST', `/api/me/deliveries/${mine}/delivered`, tokens.me);
    const foreign = await request('POST', `/api/me/deliveries/${others}/delivered`, tokens.me);

    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe('delivered');
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('ORDER_NOT_FOUND');
    const stillDelivering = await request('GET', `/api/orders/${others}`, tokens.admin);
    expect(stillDelivering.json().status).toBe('delivering');
  });

  it('pedido meu que ainda não saiu não pode ser confirmado (422)', async () => {
    const ready = await orderFor(ME, 'ready');

    const response = await request('POST', `/api/me/deliveries/${ready}/delivered`, tokens.me);

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('atualiza só a minha localização (o entregador vem do token)', async () => {
    const response = await request('PUT', '/api/me/location', tokens.me, { latitude: -23.5614, longitude: -46.6559 });
    const invalid = await request('PUT', '/api/me/location', tokens.me, { latitude: 91, longitude: 0 });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: ME, currentLatitude: -23.5614, currentLongitude: -46.6559 });
    expect(invalid.statusCode).toBe(400);
    const fleet = await request('GET', '/api/delivery-persons', tokens.admin);
    const ana = fleet.json().data.find((person: { id: string }) => person.id === OTHER);
    expect(ana).toMatchObject({ currentLatitude: -23.5489, currentLongitude: -46.6388 });
  });

  it('usuário courier sem entregador vinculado: 404 DELIVERY_PERSON_NOT_LINKED', async () => {
    const response = await request('GET', '/api/me/deliveries', tokens.unlinked);

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('DELIVERY_PERSON_NOT_LINKED');
  });

  it('o entregador não acessa o painel, e o admin não tem "minhas entregas" (403)', async () => {
    const courierOnOrders = await request('GET', '/api/orders', tokens.me);
    const courierOnFleet = await request('GET', '/api/delivery-persons', tokens.me);
    const adminOnMine = await request('GET', '/api/me/deliveries', tokens.admin);

    expect([courierOnOrders.statusCode, courierOnFleet.statusCode, adminOnMine.statusCode]).toEqual([403, 403, 403]);
  });
});
