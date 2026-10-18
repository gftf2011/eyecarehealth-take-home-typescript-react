import { screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { productBody } from '../../catalog/domain/product/testing/product.fixture';
import { FakeProductsApi } from '../../catalog/infra/testing/fake-products-api';
import { FakeAssignmentApi } from '../../delivery/infra/testing/fake-assignment-api';
import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { orderBody } from '../../ordering/domain/order/testing/order.fixture';
import { FakeOrdersApi } from '../../ordering/infra/testing/fake-orders-api';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { FakeRealtimeGateway } from '../infra/testing/fake-realtime-gateway';

const api = createTestApiServer();
let auth: FakeAuthApi;
let products: FakeProductsApi;
let gateway: FakeRealtimeGateway;
let app: ReturnType<typeof renderApp> | null = null;
let visibility: DocumentVisibilityState = 'visible';

function open(path: string) {
  app = renderApp({ path, realtime: true });
  return app;
}

const liveBadge = () => screen.findByRole('status', { name: /Ao vivo/ });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** O navegador esconde ou mostra a aba (o TanStack Query ouve `visibilitychange`). */
function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
}

beforeAll(() => {
  api.listen();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
beforeEach(() => {
  visibility = 'visible';
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  products = new FakeProductsApi();
  products.given(productBody({ id: 'p-burger', name: 'X-Burger Especial', isAvailable: true }));
  gateway = new FakeRealtimeGateway();
  api.server.use(...auth.handlers(), ...products.handlers(), gateway.handler());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Invalidação do tempo real sem multiplicar consultas', () => {
  it('uma rajada de eventos vira no máximo duas recargas, e a tela termina com o estado final', async () => {
    open('/produtos');
    await screen.findByRole('switch', { name: 'Disponível: X-Burger Especial' });
    await liveBadge();
    await waitFor(() => expect(products.listQueries.length).toBeGreaterThan(0));
    const before = products.listQueries.length;

    const [burger] = products.products;
    for (let n = 0; n < 20; n += 1) {
      if (burger !== undefined) burger.isAvailable = n % 2 === 0;
      gateway.publishProductUpdate({ type: 'product.availability-changed', productId: 'p-burger', isAvailable: n % 2 === 0 });
    }

    // Recarga imediata pelo primeiro evento e uma no fim do intervalo (1 s) com o resto. Sob
    // carga, as mensagens podem chegar espalhadas por mais de um intervalo: uma a mais, nunca 20.
    await waitFor(() => expect(products.listQueries.length).toBeGreaterThanOrEqual(before + 2), { timeout: 3_000 });
    await pause(1_200);
    expect(products.listQueries.length).toBeLessThanOrEqual(before + 3);
    expect(screen.getByRole('switch', { name: 'Disponível: X-Burger Especial' })).not.toBeChecked();
  });

  it('aba em segundo plano não consulta a API; recarrega ao voltar a ficar visível', async () => {
    open('/produtos');
    await screen.findByRole('switch', { name: 'Disponível: X-Burger Especial' });
    await liveBadge();
    await waitFor(() => expect(products.listQueries.length).toBeGreaterThan(0));
    const before = products.listQueries.length;

    setVisibility('hidden');
    const [burger] = products.products;
    if (burger !== undefined) burger.isAvailable = false;
    gateway.publishProductUpdate({ type: 'product.availability-changed', productId: 'p-burger', isAvailable: false });
    await pause(300);
    expect(products.listQueries.length).toBe(before);

    setVisibility('visible');

    await waitFor(() => expect(products.listQueries.length).toBe(before + 1));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Disponível: X-Burger Especial' })).not.toBeChecked());
  });

  it('lista filtrada por status ignora o pedido que não entra nem sai do filtro', async () => {
    const orders = new FakeOrdersApi();
    orders.given(orderBody({ id: 'order-joao', customerName: 'João Silva', status: 'delivered' }));
    api.server.use(...orders.handlers());
    open('/pedidos?status=delivered');
    await screen.findByRole('button', { name: 'Ver detalhes do pedido de João Silva' });
    await liveBadge();
    const before = orders.listQueries.length;

    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'order-ana', status: 'pending' });
    gateway.publishOrderUpdate({ type: 'order.status-changed', orderId: 'x', previousStatus: 'pending', status: 'preparing' });
    await pause(300);
    expect(orders.listQueries.length).toBe(before);

    gateway.publishOrderUpdate({ type: 'order.status-changed', orderId: 'y', previousStatus: 'delivering', status: 'delivered' });

    await waitFor(() => expect(orders.listQueries.length).toBe(before + 1));
  });

  it('quadro de atribuição ignora pedido novo e recarrega quando um pedido fica pronto', async () => {
    const delivery = new FakeAssignmentApi();
    delivery.orders = [{ id: 'order-1', customerName: 'João Silva', deliveryAddress: 'Rua das Flores, 123', totalAmount: 78.3 }];
    delivery.couriers = [
      { id: 'dp-1', name: 'Carlos Santos', vehicleType: 'motorcycle', location: { latitude: -23.55, longitude: -46.63 } },
    ];
    api.server.use(...delivery.handlers());
    open('/atribuicao');
    await screen.findByText('João Silva');
    await liveBadge();
    const before = delivery.boardQueries;

    gateway.publishOrderUpdate({ type: 'order.placed', orderId: 'order-2', status: 'pending' });
    await pause(300);
    expect(delivery.boardQueries).toBe(before);

    delivery.orders.push({ id: 'order-2', customerName: 'Ana', deliveryAddress: 'Av. Paulista, 1000', totalAmount: 45 });
    gateway.publishOrderUpdate({ type: 'order.status-changed', orderId: 'order-2', previousStatus: 'preparing', status: 'ready' });

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(delivery.boardQueries).toBe(before + 1);
  });
});
