import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { productBody } from '../../catalog/domain/product/testing/product.fixture';
import { FakeProductsApi } from '../../catalog/infra/testing/fake-products-api';
import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { FakeReportsApi } from '../../reporting/infra/testing/fake-reports-api';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { FakeRealtimeGateway } from '../infra/testing/fake-realtime-gateway';

const api = createTestApiServer();
let auth: FakeAuthApi;
let products: FakeProductsApi;
let reports: FakeReportsApi;
let gateway: FakeRealtimeGateway;
let app: ReturnType<typeof renderApp> | null = null;

function open(path: string) {
  app = renderApp({ path, realtime: true });
  return app;
}

const availability = (name: string) => screen.findByRole('switch', { name: `Disponível: ${name}` });
const liveBadge = () => screen.findByRole('status', { name: /Ao vivo/ });

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  products = new FakeProductsApi();
  products.given(productBody({ id: 'p-burger', name: 'X-Burger Especial', isAvailable: true }));
  reports = new FakeReportsApi();
  gateway = new FakeRealtimeGateway();
  api.server.use(...auth.handlers(), ...products.handlers(), ...reports.handlers(), gateway.handler());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Cardápio em tempo real', () => {
  it('produto pausado em outra aba atualiza a tabela sem recarregar', async () => {
    open('/produtos');
    expect(await availability('X-Burger Especial')).toBeChecked();
    await liveBadge();

    const [burger] = products.products;
    if (burger !== undefined) burger.isAvailable = false;
    gateway.publishProductUpdate({ type: 'product.availability-changed', productId: 'p-burger', isAvailable: false });

    await waitFor(async () => expect(await availability('X-Burger Especial')).not.toBeChecked());
  });

  it('produto criado em outro lugar aparece sozinho', async () => {
    open('/produtos');
    await availability('X-Burger Especial');
    await liveBadge();

    products.products.unshift(productBody({ id: 'p-suco', name: 'Suco de Laranja', category: 'drink' }));
    gateway.publishProductUpdate({ type: 'product.created', productId: 'p-suco' });

    expect(await screen.findByRole('rowheader', { name: /Suco de Laranja/ })).toBeInTheDocument();
  });

  it('evento de pedido não recarrega o cardápio', async () => {
    open('/produtos');
    await availability('X-Burger Especial');
    await liveBadge();
    const before = products.listQueries.length;

    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'x' });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(products.listQueries.length).toBe(before);
  });
});

describe('Relatórios em tempo real', () => {
  const PERIOD = '/relatorios?startDate=2026-10-01&endDate=2026-10-17';

  const reloaded = (before: number) => reports.queries.slice(before).map((query) => query.report).sort();

  it.each([
    ['pedido novo', () => gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'x' }), ['orders-by-status']],
    [
      'produto renomeado',
      () => gateway.publishProductUpdate({ type: 'product.updated', productId: 'p-burger' }),
      ['top-products'],
    ],
    [
      'pedido entregue',
      () =>
        gateway.publishOrderUpdate({
          type: 'order.status-changed',
          orderId: 'x',
          previousStatus: 'delivering',
          status: 'delivered',
        }),
      ['average-delivery-time', 'orders-by-status', 'revenue', 'top-products'],
    ],
  ])('%s recarrega só as métricas que ele muda', async (_, publish, expected) => {
    open(PERIOD);
    await waitFor(() => expect(reports.queries).toHaveLength(4));
    await liveBadge();

    publish();

    await waitFor(() => expect(reloaded(4)).toEqual(expected));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(reloaded(4)).toEqual(expected);
    expect(within(await screen.findByRole('region', { name: 'Receita por dia' })).getByRole('table')).toBeInTheDocument();
  });

  it('mudança de preço ou disponibilidade não recarrega nenhum relatório', async () => {
    open(PERIOD);
    await waitFor(() => expect(reports.queries).toHaveLength(4));
    await liveBadge();

    gateway.publishProductUpdate({ type: 'product.price-changed', productId: 'p-burger' });
    gateway.publishProductUpdate({ type: 'product.availability-changed', productId: 'p-burger', isAvailable: false });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(reports.queries).toHaveLength(4);
  });
});
