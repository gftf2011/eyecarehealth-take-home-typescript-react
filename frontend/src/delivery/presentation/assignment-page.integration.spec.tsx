import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { FakeOrdersApi } from '../../ordering/infra/testing/fake-orders-api';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { FakeAssignmentApi } from '../infra/testing/fake-assignment-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let delivery: FakeAssignmentApi;
let app: ReturnType<typeof renderApp> | null = null;

const SAO_PAULO = { latitude: -23.55, longitude: -46.63 };

function open() {
  app = renderApp({ path: '/atribuicao' });
  return app;
}

const cardFor = (address: string) => screen.findByRole('listitem', { name: `Pedido em ${address}` });

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  delivery = new FakeAssignmentApi();
  delivery.orders = [
    { id: 'order-1', customerName: 'João Silva', deliveryAddress: 'Rua das Flores, 123', totalAmount: 78.3 },
    { id: 'order-2', customerName: 'Maria Santos', deliveryAddress: 'Av. Paulista, 1000', totalAmount: 45 },
  ];
  delivery.couriers = [
    { id: 'dp-1', name: 'Carlos Santos', vehicleType: 'motorcycle', location: SAO_PAULO },
    { id: 'dp-2', name: 'Ana Lima', vehicleType: 'bicycle', location: SAO_PAULO },
  ];
  api.server.use(...auth.handlers(), ...delivery.handlers());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Tela de atribuição', () => {
  it('mostra os pedidos prontos e os entregadores disponíveis', async () => {
    open();

    const orders = await screen.findByRole('region', { name: 'Pedidos prontos' });
    expect(within(orders).getByText('João Silva')).toBeInTheDocument();
    expect(within(orders).getByText('Rua das Flores, 123')).toBeInTheDocument();
    const couriers = screen.getByRole('region', { name: 'Entregadores disponíveis' });
    expect(within(couriers).getByText('Carlos Santos')).toBeInTheDocument();
    expect(within(couriers).getByText('Moto')).toBeInTheDocument();
  });

  it('com solução: sugere os pares com distância, total e tempo do algoritmo', async () => {
    const view = open();

    await view.user.click(await screen.findByRole('button', { name: 'Sugerir atribuição otimizada' }));

    const plan = await screen.findByRole('region', { name: 'Sugestão de atribuição' });
    expect(within(plan).getByText('Húngaro · 0,37 ms')).toBeInTheDocument();
    expect(within(plan).getByText('4,00 km')).toBeInTheDocument();
    const first = await cardFor('Rua das Flores, 123');
    expect(first).toHaveTextContent('Carlos Santos');
    expect(first).toHaveTextContent('1,50 km');
  });

  it('aceitar despacha o pedido com o entregador sugerido (vai para delivering)', async () => {
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Sugerir atribuição otimizada' }));

    await view.user.click(within(await cardFor('Rua das Flores, 123')).getByRole('button', { name: 'Aceitar' }));

    expect(await within(await cardFor('Rua das Flores, 123')).findByText('Despachado')).toBeInTheDocument();
    expect(delivery.dispatched).toEqual([{ orderId: 'order-1', deliveryPersonId: 'dp-1' }]);
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Pedidos prontos' })).queryByText('João Silva')).not.toBeInTheDocument(),
    );
  });

  it('rejeitar descarta a sugestão sem chamar a API', async () => {
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Sugerir atribuição otimizada' }));

    await view.user.click(within(await cardFor('Av. Paulista, 1000')).getByRole('button', { name: 'Rejeitar' }));

    expect(within(await cardFor('Av. Paulista, 1000')).getByText('Rejeitado')).toBeInTheDocument();
    expect(delivery.dispatched).toHaveLength(0);
  });

  it('aceitar todas despacha cada par; uma sugestão desatualizada falha sem afetar as outras', async () => {
    delivery.staleOrders.add('order-1');
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Sugerir atribuição otimizada' }));

    await view.user.click(await screen.findByRole('button', { name: 'Aceitar todas (2)' }));

    const stale = await cardFor('Rua das Flores, 123');
    expect(await within(stale).findByText('Não aplicado')).toBeInTheDocument();
    expect(stale).toHaveTextContent('O pedido já saiu para entrega');
    expect(await within(await cardFor('Av. Paulista, 1000')).findByText('Despachado')).toBeInTheDocument();
    expect(delivery.dispatched).toEqual([{ orderId: 'order-2', deliveryPersonId: 'dp-2' }]);
  });

  it('sem entregadores disponíveis: os pedidos ficam sem atribuição, com o motivo', async () => {
    delivery.couriers = [];
    const view = open();
    expect(await screen.findByText('Nenhum entregador ativo e livre agora.')).toBeInTheDocument();

    await view.user.click(screen.getByRole('button', { name: 'Sugerir atribuição otimizada' }));

    const warning = await screen.findByText('2 pedido(s) sem entregador');
    expect(warning.closest('[role="status"]')).toHaveTextContent('Rua das Flores, 123 — Sem entregador disponível');
    expect(screen.queryByRole('button', { name: /Aceitar/ })).not.toBeInTheDocument();
  });

  it('entregador sem GPS é sinalizado e fica fora do cálculo', async () => {
    delivery.couriers.push({ id: 'dp-3', name: 'Bruno Sem Sinal', vehicleType: 'car', location: null });
    const view = open();
    expect(await screen.findByText('Sem GPS')).toBeInTheDocument();

    await view.user.click(screen.getByRole('button', { name: 'Sugerir atribuição otimizada' }));

    expect(await screen.findByText(/Bruno Sem Sinal ficaram fora do cálculo/)).toBeInTheDocument();
  });

  it('sem pedidos prontos: não há o que sugerir', async () => {
    delivery.orders = [];
    open();

    expect(await screen.findByText('Nenhum pedido pronto aguardando entregador.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sugerir atribuição otimizada' })).toBeDisabled();
  });

  it('perfil somente leitura não vê a tela nem o menu de atribuição', async () => {
    auth.givenSignedIn(SEED_USERS.viewer);
    api.server.use(...new FakeOrdersApi().handlers());
    open();

    expect(await screen.findByText('Seu perfil não tem permissão para acessar esta tela.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Atribuição' })).not.toBeInTheDocument();
    expect(delivery.suggestions).toBe(0);
  });
});
