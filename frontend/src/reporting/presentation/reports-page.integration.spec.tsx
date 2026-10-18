import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { FakeReportsApi } from '../infra/testing/fake-reports-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let reports: FakeReportsApi;
let app: ReturnType<typeof renderApp> | null = null;

const PERIOD = '/relatorios?startDate=2026-10-01&endDate=2026-10-17';

function open(path = PERIOD) {
  app = renderApp({ path });
  return app;
}

const card = (title: string) => screen.findByRole('region', { name: title });

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.viewer);
  reports = new FakeReportsApi();
  api.server.use(...auth.handlers(), ...reports.handlers());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Tela de relatórios', () => {
  it('consulta as quatro métricas com o período da URL e mostra o resumo', async () => {
    open();

    const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).closest('div');
    expect(await screen.findByText(/R\$\s?1\.234,50/)).toBeInTheDocument();
    expect(metric('Pedidos entregues')).toHaveTextContent('30');
    expect(metric('Ticket médio')).toHaveTextContent(/R\$\s?41,15/);
    await waitFor(() => expect(metric('Tempo médio de entrega')).toHaveTextContent('39 min'));
    await waitFor(() => expect(reports.queries).toHaveLength(4));
    for (const query of reports.queries) {
      expect(query.params.get('startDate')).toBe('2026-10-01');
      expect(query.params.get('endDate')).toBe('2026-10-17');
    }
  });

  it('receita por período: série diária acessível em tabela', async () => {
    open();

    const revenue = await card('Receita por dia');
    const table = await within(revenue).findByRole('table', { name: 'Receita por dia' });
    expect(within(table).getByRole('row', { name: /16\/10/ })).toHaveTextContent(/R\$\s?600,00/);
    expect(within(table).getByRole('row', { name: /17\/10/ })).toHaveTextContent('16');
  });

  it('produtos mais vendidos: top 10 em ordem, com quantidade e receita', async () => {
    open();

    const table = await within(await card('Produtos mais vendidos')).findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent(/1X-Burger Especial42R\$\s?1\.381,80/);
    expect(rows[1]).toHaveTextContent('Suco de Laranja');
    expect(reports.queries.find((query) => query.report === 'top-products')?.params.get('limit')).toBe('10');
  });

  it('pedidos por status: contagem e participação de cada status', async () => {
    open();

    const legend = await within(await card('Pedidos por status')).findByRole('list', { name: 'Pedidos por status' });
    expect(within(legend).getByText('Entregue').closest('li')).toHaveTextContent('3075%');
    expect(within(legend).getByText('Cancelado').closest('li')).toHaveTextContent('38%');
  });

  it('tempo de entrega por tipo de veículo', async () => {
    open();

    const table = await within(await card('Tempo médio de entrega')).findByRole('table');
    expect(within(table).getByRole('row', { name: /Bicicleta/ })).toHaveTextContent('1054 min30 min1 h 35 min');
    expect(within(table).getByRole('row', { name: /Todos/ })).toHaveTextContent('30');
  });

  it('período inválido mostra o erro e não consulta a API', async () => {
    open();
    await waitFor(() => expect(reports.queries).toHaveLength(4));

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-01' } });

    expect(screen.getByLabelText('Até')).toHaveAccessibleDescription(
      'A data fim deve ser igual ou posterior à data início',
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reports.queries).toHaveLength(4);
  });

  it('atalho de período atualiza a URL e consulta de novo', async () => {
    const view = open();
    await waitFor(() => expect(reports.queries).toHaveLength(4));

    await view.user.click(screen.getByRole('button', { name: 'Últimos 7 dias' }));

    await waitFor(() => expect(reports.queries.length).toBeGreaterThanOrEqual(8));
    expect(view.router.state.location.search).toMatch(/startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}/);
    expect(screen.getByRole('button', { name: 'Últimos 7 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sem entregas no período: estados vazios explicando o motivo', async () => {
    reports.revenue = { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, dailyRevenue: [] };
    reports.topProducts = { data: [] };
    reports.deliveryTime = { averageMinutes: null, fastestMinutes: null, slowestMinutes: null, totalDelivered: 0, byVehicleType: [] };
    open();

    expect(await screen.findByText('Nenhum pedido entregue no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum produto vendido no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma entrega concluída no período.')).toBeInTheDocument();
  });

  // Falha transitória (5xx): o painel tenta de novo duas vezes (1 s + 2 s) antes de mostrar o erro.
  it('um relatório com erro não derruba os outros', { timeout: 15_000 }, async () => {
    reports.failures.set('top-products', { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Indisponível' });
    open();

    const alert = await within(await card('Produtos mais vendidos')).findByRole('alert', {}, { timeout: 8_000 });
    expect(alert).toHaveTextContent('O servidor encontrou um erro');
    expect(reports.queries.filter((query) => query.report === 'top-products')).toHaveLength(3);
    expect(await within(await card('Pedidos por status')).findByRole('list', { name: 'Pedidos por status' })).toBeInTheDocument();
  });
});
