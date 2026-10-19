import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { REFRESH_TOKEN_COOKIE } from '../../identity/presentation/cookies/refresh-token.cookie';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import type { HttpMethod } from '../../shared-kernel/presentation';
import { buildTestApp, type TestApp } from './testing/build-test-app';

/**
 * Contrato documentado = contrato real. Cada rota com corpo de sucesso é
 * chamada de verdade, e a resposta é validada contra o schema **estrito**
 * que está no Swagger: um campo a mais, a menos ou de outro tipo derruba o
 * teste. O último caso confere que nenhuma rota ficou sem verificação.
 */
describe('Contratos da API: as respostas reais seguem o Swagger', () => {
  let testApp: TestApp;
  let token = '';
  let refreshCookie = '';
  const verified = new Set<string>();
  const ids = { product: '', order: '', courier: '' };

  beforeAll(async () => {
    testApp = await buildTestApp({ auth: 'jwt' });
    await resetDatabase(testApp.orderingDb);
    await testApp.givenUser('contrato@fastmeals.com', 'Contrato@123', 'admin');
  });

  afterAll(async () => {
    await testApp.close();
  });

  /** Schema documentado da resposta de sucesso de uma rota. */
  function documentedSchema(method: HttpMethod, url: string, status: number): z.ZodType {
    const route = testApp.routes.find((candidate) => candidate.method === method && candidate.url === url);
    const schema = route?.docs.responses[status]?.schema;
    if (schema === undefined) throw new Error(`${method} ${url} não documenta corpo para ${status}`);
    return schema;
  }

  /** Chama a rota e valida status e corpo contra o Swagger. */
  async function expectContract(
    method: HttpMethod,
    url: string,
    status: number,
    { path = url, payload, cookies }: { path?: string; payload?: object; cookies?: Record<string, string> } = {},
  ) {
    const response = await testApp.app.inject({
      method,
      url: path,
      headers: token === '' ? {} : { authorization: `Bearer ${token}` },
      ...(payload !== undefined && { payload }),
      ...(cookies !== undefined && { cookies }),
    });
    expect(response.statusCode, `${method} ${path}: ${response.body}`).toBe(status);
    const parsed = documentedSchema(method, url, status).safeParse(response.json());
    expect(parsed.error?.issues ?? [], `${method} ${url} fora do contrato`).toEqual([]);
    verified.add(`${method} ${url}`);
    return response;
  }

  it('autenticação: login e renovação', async () => {
    const login = await expectContract('POST', '/api/auth/login', 200, {
      payload: { email: 'contrato@fastmeals.com', password: 'Contrato@123' },
    });
    token = login.json().accessToken;
    refreshCookie = login.cookies.find((cookie) => cookie.name === REFRESH_TOKEN_COOKIE)?.value ?? '';

    const refreshed = await expectContract('POST', '/api/auth/refresh', 200, { cookies: { [REFRESH_TOKEN_COOKIE]: refreshCookie } });
    token = refreshed.json().accessToken;
  });

  it('produtos: criar, detalhar, atualizar e listar', async () => {
    const created = await expectContract('POST', '/api/products', 201, {
      payload: {
        name: 'Prato do Contrato',
        description: 'Prato criado pelo teste de contrato',
        price: 42.5,
        category: 'meal',
        preparationTime: 20,
        imageUrl: 'https://example.com/prato.jpg',
      },
    });
    ids.product = created.json().id;

    await expectContract('GET', '/api/products/:id', 200, { path: `/api/products/${ids.product}` });
    await expectContract('PUT', '/api/products/:id', 200, { path: `/api/products/${ids.product}`, payload: { price: 44.9 } });
    await expectContract('GET', '/api/products', 200, { path: '/api/products?search=contrato&sortBy=price&sortOrder=asc' });
  });

  it('entregadores: cadastrar, atualizar e listar', async () => {
    const created = await expectContract('POST', '/api/delivery-persons', 201, {
      payload: {
        name: 'Entregador do Contrato',
        phone: '(11) 91234-5678',
        vehicleType: 'motorcycle',
        currentLatitude: -22.9,
        currentLongitude: -43.17,
      },
    });
    ids.courier = created.json().id;

    await expectContract('PUT', '/api/delivery-persons/:id', 200, { path: `/api/delivery-persons/${ids.courier}`, payload: { isActive: true } });
    await expectContract('GET', '/api/delivery-persons', 200, { path: '/api/delivery-persons?isActive=true' });
  });

  it('pedidos: criar, detalhar, avançar, atribuir, sugerir, despachar, devolver e listar', async () => {
    const placed = await expectContract('POST', '/api/orders', 201, {
      payload: {
        customerName: 'Cliente do Contrato',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        items: [{ productId: ids.product, quantity: 2 }],
      },
    });
    ids.order = placed.json().id;
    const order = (suffix = '') => ({ path: `/api/orders/${ids.order}${suffix}` });

    await expectContract('GET', '/api/orders/:id', 200, order());
    await expectContract('PATCH', '/api/orders/:id/status', 200, { ...order('/status'), payload: { status: 'preparing' } });
    await expectContract('PATCH', '/api/orders/:id/status', 200, { ...order('/status'), payload: { status: 'ready' } });
    await expectContract('PATCH', '/api/orders/:id/assign', 200, { ...order('/assign'), payload: { deliveryPersonId: ids.courier } });
    const suggestion = await expectContract('POST', '/api/orders/optimize-assignment', 200);
    expect(suggestion.json().assignments).toHaveLength(1);
    await expectContract('POST', '/api/orders/:id/dispatch', 200, { ...order('/dispatch'), payload: { deliveryPersonId: ids.courier } });
    // O entregador some; a entrega volta para a atribuição e sai de novo com ele.
    await expectContract('POST', '/api/orders/:id/return-to-assignment', 200, {
      ...order('/return-to-assignment'),
      payload: { reason: 'Entregador sem contato' },
    });
    await expectContract('POST', '/api/orders/:id/dispatch', 200, { ...order('/dispatch'), payload: { deliveryPersonId: ids.courier } });
    await expectContract('PATCH', '/api/orders/:id/status', 200, { ...order('/status'), payload: { status: 'delivered' } });
    await expectContract('GET', '/api/orders', 200, { path: '/api/orders?status=delivered&sortBy=totalAmount' });
  });

  it('relatórios: os quatro, com o pedido entregue', async () => {
    const period = 'startDate=2025-01-01&endDate=2025-12-31';
    await expectContract('GET', '/api/reports/revenue', 200, { path: `/api/reports/revenue?${period}` });
    await expectContract('GET', '/api/reports/orders-by-status', 200, { path: `/api/reports/orders-by-status?${period}` });
    await expectContract('GET', '/api/reports/top-products', 200, { path: `/api/reports/top-products?${period}&limit=5` });
    await expectContract('GET', '/api/reports/average-delivery-time', 200, { path: `/api/reports/average-delivery-time?${period}` });
  });

  it('erros seguem o formato documentado', async () => {
    const response = await testApp.app.inject({
      method: 'GET',
      url: `/api/orders/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(documentedSchema('GET', '/api/orders/:id', 404).safeParse(response.json()).success).toBe(true);
  });

  it('nenhuma rota com corpo de sucesso ficou sem verificação', () => {
    const withBody = testApp.routes
      .filter((route) => Object.entries(route.docs.responses).some(([status, doc]) => Number(status) < 300 && doc.schema !== undefined))
      .map((route) => `${route.method} ${route.url}`)
      .sort();

    expect([...verified].sort()).toEqual(withBody);
  });
});
