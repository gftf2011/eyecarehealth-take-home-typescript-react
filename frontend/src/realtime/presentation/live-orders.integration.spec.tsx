import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { orderBody } from '../../ordering/domain/order/testing/order.fixture';
import { FakeOrdersApi } from '../../ordering/infra/testing/fake-orders-api';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { FakeRealtimeGateway } from '../infra/testing/fake-realtime-gateway';

const api = createTestApiServer();
let auth: FakeAuthApi;
let orders: FakeOrdersApi;
let gateway: FakeRealtimeGateway;
let app: ReturnType<typeof renderApp> | null = null;

function open(path = '/pedidos') {
  app = renderApp({ path, realtime: true });
  return app;
}

const rowOf = async (customer: string): Promise<HTMLElement> => {
  const button = await screen.findByRole('button', { name: `Ver detalhes do pedido de ${customer}` });
  const row = button.closest('li');
  if (row === null) throw new Error(`linha de ${customer} não encontrada`);
  return row;
};

const liveBadge = () => screen.findByRole('status', { name: /Ao vivo/ });

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  orders = new FakeOrdersApi();
  orders.given(orderBody({ id: 'order-joao', customerName: 'João Silva', status: 'pending' }));
  gateway = new FakeRealtimeGateway();
  api.server.use(...auth.handlers(), ...orders.handlers(), gateway.handler());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Painel de pedidos em tempo real', () => {
  it('conecta com o access token da sessão e mostra "Ao vivo"', async () => {
    open();

    expect(await liveBadge()).toBeInTheDocument();
    expect(gateway.authTokens).toEqual(['access-1']);
  });

  it('pedido alterado em outro lugar atualiza a lista sem recarregar', async () => {
    open();
    await rowOf('João Silva');
    await liveBadge();

    orders.update('order-joao', { status: 'preparing' });
    gateway.publishOrderUpdate({ type: 'order.status-changed', orderId: 'order-joao', previousStatus: 'pending', status: 'preparing' });

    expect(await within(await rowOf('João Silva')).findByText('Em preparo')).toBeInTheDocument();
  });

  it('pedido novo aparece sozinho na lista', async () => {
    open();
    await rowOf('João Silva');
    await liveBadge();

    orders.orders.unshift(orderBody({ id: 'order-ana', customerName: 'Ana Costa', createdAt: new Date().toISOString() }));
    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'order-ana', status: 'pending', totalAmount: 78.3 });

    expect(await rowOf('Ana Costa')).toBeInTheDocument();
  });

  it('evento repetido (entrega "pelo menos uma vez") não recarrega de novo', async () => {
    open();
    await rowOf('João Silva');
    await liveBadge();
    const before = orders.listQueries.length;

    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'x' }, 'evt-repetido');
    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'x' }, 'evt-repetido');

    await waitFor(() => expect(orders.listQueries.length).toBe(before + 1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(orders.listQueries.length).toBe(before + 1);
  });

  it('gateway reinicia: reconecta sozinho e recarrega o que pode ter se perdido', async () => {
    open();
    await rowOf('João Silva');
    await liveBadge();
    const before = orders.listQueries.length;

    orders.update('order-joao', { status: 'cancelled' });
    gateway.restart();

    expect(await screen.findByRole('status', { name: /Reconectando/ })).toBeInTheDocument();
    expect(await liveBadge()).toBeInTheDocument();
    expect(gateway.connections).toBe(2);
    expect(await within(await rowOf('João Silva')).findByText('Cancelado')).toBeInTheDocument();
    expect(orders.listQueries.length).toBeGreaterThan(before);
  });

  it('sair do painel fecha a conexão', async () => {
    const view = open();
    await liveBadge();

    await view.user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(gateway.openConnections).toBe(0));
    expect(screen.queryByRole('status', { name: /Ao vivo/ })).not.toBeInTheDocument();
  });
});
