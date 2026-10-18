import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { orderBody } from '../domain/order/testing/order.fixture';
import { FakeOrdersApi } from '../infra/testing/fake-orders-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let orders: FakeOrdersApi;
let app: ReturnType<typeof renderApp> | null = null;

const JOAO = orderBody({ id: 'order-joao', customerName: 'João Silva', status: 'pending', createdAt: '2026-10-17T15:30:00.000Z' });
const MARIA = orderBody({
  id: 'order-maria',
  customerName: 'Maria Santos',
  status: 'ready',
  totalAmount: 45,
  deliveryPerson: { id: 'dp-1', name: 'Carlos Entregador' },
  items: [{ id: 'item-m', product: { id: 'p-pizza', name: 'Pizza Margherita' }, quantity: 1, unitPrice: 45 }],
  createdAt: '2026-10-17T14:00:00.000Z',
});
const ANA = orderBody({ id: 'order-ana', customerName: 'Ana Costa', status: 'delivered', createdAt: '2026-10-16T12:00:00.000Z' });

function open(path = '/pedidos') {
  app = renderApp({ path });
  return app;
}

const rowOf = async (customer: string): Promise<HTMLElement> => {
  const button = await screen.findByRole('button', { name: `Ver detalhes do pedido de ${customer}` });
  const row = button.closest('li');
  if (row === null) throw new Error(`linha de ${customer} não encontrada`);
  return row;
};

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  orders = new FakeOrdersApi();
  orders.given(JOAO, MARIA, ANA);
  api.server.use(...auth.handlers(), ...orders.handlers());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Painel de pedidos', () => {
  it('lista cliente, itens resumidos, total, status e data, mais recentes primeiro', async () => {
    open('/');

    const joao = await rowOf('João Silva');
    expect(joao).toHaveTextContent('2× X-Burger Especial, 1× Suco de Laranja');
    expect(joao).toHaveTextContent(/R\$\s?78,30/);
    expect(joao).toHaveTextContent('Pendente');
    expect(joao).toHaveTextContent('17/10/2026');

    const names = within(screen.getByRole('list', { name: 'Pedidos' }))
      .getAllByRole('button', { name: /Ver detalhes/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Ver detalhes do pedido de João Silva',
      'Ver detalhes do pedido de Maria Santos',
      'Ver detalhes do pedido de Ana Costa',
    ]);
    expect(screen.getByText('1–3 de 3 pedidos')).toBeInTheDocument();
  });

  it('filtra por status, guardando o filtro na URL', async () => {
    const view = open();
    await rowOf('João Silva');

    await view.user.selectOptions(screen.getByLabelText('Status'), 'ready');

    await rowOf('Maria Santos');
    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    expect(view.router.state.location.search).toBe('?status=ready');
    expect(orders.listQueries.at(-1)?.get('status')).toBe('ready');
  });

  it('período inválido mostra o erro na hora e não consulta a API', async () => {
    open();
    await rowOf('João Silva');

    fireEvent.change(screen.getByLabelText('Criados de'), { target: { value: '2026-10-17' } });
    await waitFor(() => expect(orders.listQueries.at(-1)?.get('startDate')).toBe('2026-10-17'));
    const requests = orders.listQueries.length;

    fireEvent.change(screen.getByLabelText('até'), { target: { value: '2026-10-01' } });

    expect(screen.getByLabelText('até')).toHaveAccessibleDescription(
      'A data fim deve ser igual ou posterior à data início',
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(orders.listQueries).toHaveLength(requests);
    expect(orders.listQueries.at(-1)?.get('endDate')).toBeNull();
  });

  it('sem resultados para o filtro: estado vazio explicando o motivo', async () => {
    open('/pedidos?status=delivering');

    expect(await screen.findByText('Nenhum pedido com esses filtros')).toBeInTheDocument();
  });

  it('abre o detalhe em modal (com link próprio) e fecha com Esc', async () => {
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Ver detalhes do pedido de Maria Santos' }));

    const dialog = await screen.findByRole('dialog', { name: 'Detalhes do pedido' });
    expect(await within(dialog).findByText('Carlos Entregador')).toBeInTheDocument();
    expect(within(dialog).getByRole('row', { name: /Pizza Margherita/ })).toHaveTextContent(/R\$\s?45,00/);
    expect(view.router.state.location.search).toBe('?order=order-maria');

    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(view.router.state.location.search).toBe('');
  });

  it('avança o status pelo botão contextual e a lista se atualiza', async () => {
    const view = open();

    await view.user.click(within(await rowOf('João Silva')).getByRole('button', { name: 'Iniciar preparo' }));

    expect(await within(await rowOf('João Silva')).findByText('Em preparo')).toBeInTheDocument();
    expect(orders.statusChanges).toEqual([{ id: 'order-joao', status: 'preparing' }]);
    expect(within(await rowOf('João Silva')).getByRole('button', { name: 'Marcar como pronto' })).toBeEnabled();
  });

  it('tela desatualizada: a recusa da API aparece e nada muda', async () => {
    const view = open();
    const joao = await rowOf('João Silva');
    orders.update('order-joao', { status: 'cancelled' }); // outro gestor cancelou depois que a lista carregou

    await view.user.click(within(joao).getByRole('button', { name: 'Iniciar preparo' }));

    expect(await within(joao).findByRole('alert')).toHaveTextContent('Transição de cancelled para preparing');
  });

  it('perfil somente leitura vê os pedidos, sem ações', async () => {
    auth.givenSignedIn(SEED_USERS.viewer);
    open();

    const joao = await rowOf('João Silva');
    expect(within(joao).queryByRole('button', { name: 'Iniciar preparo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page');
  });
});
