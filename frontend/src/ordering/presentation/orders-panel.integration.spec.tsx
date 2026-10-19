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
    // Tudo coube numa página: não há para onde navegar.
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('pagina por cursor: próxima, anterior e início, com o cursor na URL', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      orderBody({
        id: `order-${index}`,
        customerName: `Cliente ${String(index).padStart(2, '0')}`,
        createdAt: new Date(Date.UTC(2026, 9, 18, 12, 59 - index)).toISOString(),
      }),
    );
    orders = new FakeOrdersApi();
    orders.given(...many);
    api.server.use(...orders.handlers());
    const view = open();
    await rowOf('Cliente 00');
    const pagination = screen.getByRole('navigation', { name: 'Paginação' });
    expect(within(pagination).getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await view.user.click(within(pagination).getByRole('button', { name: 'Próxima' }));

    await rowOf('Cliente 20');
    expect(screen.queryByText('Cliente 00')).not.toBeInTheDocument();
    expect(view.router.state.location.search).toBe('?cursor=i20');
    expect(screen.getByText('5 pedidos nesta página')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await view.user.click(screen.getByRole('button', { name: 'Anterior' }));
    await rowOf('Cliente 00');

    await view.user.click(screen.getByRole('button', { name: 'Próxima' }));
    await rowOf('Cliente 20');
    await view.user.click(screen.getByRole('button', { name: 'Início' }));
    await rowOf('Cliente 00');
    expect(view.router.state.location.search).toBe('');
  });

  it('trocar o filtro volta para a primeira página (o cursor vale só para a ordenação dele)', async () => {
    const view = open('/pedidos?cursor=i2');
    await rowOf('Ana Costa');

    await view.user.selectOptions(screen.getByLabelText('Status'), 'ready');

    await rowOf('Maria Santos');
    expect(view.router.state.location.search).toBe('?status=ready');
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

  it('devolve uma entrega para a atribuição com motivo: volta a pronto, sem entregador, e o motivo aparece no histórico', async () => {
    const PEDRO = orderBody({
      id: 'order-pedro',
      customerName: 'Pedro Almeida',
      status: 'delivering',
      deliveryPerson: { id: 'dp-1', name: 'Carlos Entregador' },
      createdAt: '2026-10-17T13:00:00.000Z',
    });
    orders.given(JOAO, MARIA, ANA, PEDRO);
    const view = open('/pedidos?order=order-pedro');
    const dialog = await screen.findByRole('dialog', { name: 'Detalhes do pedido' });

    await view.user.click(await within(dialog).findByRole('button', { name: 'Devolver para a atribuição' }));
    const confirm = screen.getByRole('dialog', { name: 'Devolver entrega para a atribuição?' });
    await view.user.type(within(confirm).getByLabelText('Motivo'), 'Entregador sem contato há 30 minutos');
    await view.user.click(within(confirm).getByRole('button', { name: 'Devolver para a atribuição' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Devolver entrega para a atribuição?' })).not.toBeInTheDocument(),
    );
    expect(orders.returns).toEqual([{ id: 'order-pedro', reason: 'Entregador sem contato há 30 minutos' }]);
    const details = screen.getByRole('dialog', { name: 'Detalhes do pedido' });
    expect(await within(details).findByText('Não atribuído')).toBeInTheDocument();
    const history = within(details).getByRole('region', { name: 'Histórico do pedido' });
    expect(history).toHaveTextContent('Em entrega → Pronto');
    expect(history).toHaveTextContent('Entregador sem contato há 30 minutos');
    expect(within(await rowOf('Pedro Almeida')).getByText('Pronto')).toBeInTheDocument();
  });

  describe('entrega com problema relatado pelo entregador', () => {
    const withIssue = (reason: 'customer_absent' | 'refused' = 'customer_absent') =>
      orderBody({
        id: 'order-lucas',
        customerName: 'Lucas Prado',
        status: 'delivering',
        deliveryPerson: { id: 'dp-1', name: 'Carlos Entregador' },
        createdAt: '2026-10-17T13:30:00.000Z',
        deliveryIssues: [
          { id: 'issue-1', reason, note: 'Ninguém atende', reportedAt: '2026-10-17T14:00:00.000Z', resolvedAt: null, resolution: null },
        ],
        deliveryIssueDecisions: reason === 'refused' ? ['cancel'] : ['retry', 'return', 'cancel'],
      });

    it('aparece na lista com o selo e no detalhe com o motivo; "Tentar de novo" mantém a entrega', async () => {
      orders.given(JOAO, MARIA, ANA, withIssue());
      const view = open();

      expect(await within(await rowOf('Lucas Prado')).findByText('Problema na entrega')).toBeInTheDocument();
      await view.user.click(within(await rowOf('Lucas Prado')).getByRole('button', { name: 'Ver detalhes do pedido de Lucas Prado' }));
      const details = await screen.findByRole('dialog', { name: 'Detalhes do pedido' });
      const panel = await within(details).findByRole('region', { name: 'Problemas na entrega' });
      expect(panel).toHaveTextContent('Problema na entrega: Cliente ausente');
      expect(panel).toHaveTextContent('Ninguém atende');
      // Com o problema aberto, a entrega não pode ser concluída pelo painel.
      expect(within(details).getByRole('button', { name: 'Confirmar entrega' })).toBeDisabled();
      expect(within(details).getByText('O entregador relatou um problema: decida antes de concluir a entrega.')).toBeInTheDocument();

      await view.user.click(within(panel).getByRole('button', { name: 'Tentar de novo' }));

      await waitFor(() => expect(within(details).queryByText('Problema na entrega: Cliente ausente')).not.toBeInTheDocument());
      expect(orders.decisions).toEqual([{ id: 'order-lucas', decision: 'retry' }]);
      expect(within(details).getByRole('list', { name: 'Tentativas anteriores' })).toHaveTextContent(
        'Cliente ausente (Ninguém atende) → Nova tentativa',
      );
    });

    it('cliente recusou: só "Cancelar entrega" (sem tentar de novo nem devolver)', async () => {
      orders.given(JOAO, MARIA, ANA, withIssue('refused'));
      open('/pedidos?order=order-lucas');
      const details = await screen.findByRole('dialog', { name: 'Detalhes do pedido' });
      const panel = await within(details).findByRole('region', { name: 'Problemas na entrega' });

      expect(within(panel).getByRole('group', { name: 'Decisão sobre a entrega' })).toHaveTextContent(/^Cancelar entrega$/);
      expect(panel).toHaveTextContent('O cliente recusou: a única saída é cancelar.');
      expect(within(details).queryByRole('button', { name: 'Devolver para a atribuição' })).not.toBeInTheDocument();
    });

    it('"Cancelar entrega" pede confirmação e cancela o pedido', async () => {
      orders.given(JOAO, MARIA, ANA, withIssue());
      const view = open('/pedidos?order=order-lucas');
      const details = await screen.findByRole('dialog', { name: 'Detalhes do pedido' });

      await view.user.click(await within(details).findByRole('button', { name: 'Cancelar entrega' }));
      await view.user.click(
        within(screen.getByRole('alertdialog', { name: 'Cancelar a entrega?' })).getByRole('button', { name: 'Cancelar pedido' }),
      );

      expect(await within(details).findByText('Cancelado')).toBeInTheDocument();
      expect(orders.decisions).toEqual([{ id: 'order-lucas', decision: 'cancel' }]);
    });
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
