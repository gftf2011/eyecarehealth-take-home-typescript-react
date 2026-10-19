import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { FakeRealtimeGateway } from '../../realtime/infra/testing/fake-realtime-gateway';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { courierOrder, FakeMyDeliveriesApi } from '../infra/testing/fake-my-deliveries-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let mine: FakeMyDeliveriesApi;
let gateway: FakeRealtimeGateway;
let app: ReturnType<typeof renderApp> | null = null;

const CURRENT = courierOrder({ id: 'o-current', customerName: 'João Silva' });
const NEXT = courierOrder({ id: 'o-next', customerName: 'Maria Santos', status: 'ready', deliveryAddress: 'Av. Paulista, 1000' });

/** O jsdom não tem geolocalização: o teste define a resposta do "celular". */
function givenGeolocation(geolocation: object): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
}

function open(path = '/', options: { realtime?: boolean } = {}) {
  app = renderApp({ path, ...options });
  return app;
}

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.courier);
  mine = new FakeMyDeliveriesApi();
  mine.given(CURRENT, NEXT);
  gateway = new FakeRealtimeGateway();
  api.server.use(...auth.handlers(), ...mine.handlers(), gateway.handler());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
  Reflect.deleteProperty(navigator, 'geolocation');
});
afterAll(() => api.close());

describe('Tela do entregador', () => {
  it('o entregador entra direto nas próprias entregas, e o menu só tem essa tela', async () => {
    const view = open('/');

    expect(await screen.findByRole('heading', { name: 'Minhas entregas' })).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/minhas-entregas');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Minhas entregas']);
    expect(await screen.findByText('Olá, Carlos Santos.')).toBeInTheDocument();
  });

  it('mostra a entrega em andamento com o que é preciso na rua, e as próximas', async () => {
    open('/minhas-entregas');

    const current = await screen.findByRole('region', { name: 'João Silva' });
    expect(within(current).getByRole('link', { name: 'Ligar para (11) 99999-1234' })).toHaveAttribute('href', 'tel:11999991234');
    expect(within(current).getByRole('link', { name: 'Abrir no mapa' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-23.5891,-46.6378',
    );
    expect(current).toHaveTextContent('2× X-Burger Especial');
    const upcoming = screen.getByRole('list', { name: 'Próximas entregas' });
    expect(upcoming).toHaveTextContent('Maria Santos');
    expect(upcoming).toHaveTextContent('Pronto para retirar');
  });

  it('confirma a entrega depois de "Entreguei"; a tela recarrega sem ela', async () => {
    const view = open('/minhas-entregas');

    await view.user.click(await screen.findByRole('button', { name: 'Confirmar entrega' }));
    await view.user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar entrega?' })).getByRole('button', { name: 'Entreguei' }));

    expect(await screen.findByText('Nenhuma entrega em andamento')).toBeInTheDocument();
    expect(mine.confirmations).toEqual(['o-current']);
  });

  it('"Ainda não" não confirma nada', async () => {
    const view = open('/minhas-entregas');

    await view.user.click(await screen.findByRole('button', { name: 'Confirmar entrega' }));
    await view.user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Ainda não' }));

    expect(mine.confirmations).toEqual([]);
    expect(screen.getByRole('region', { name: 'João Silva' })).toBeInTheDocument();
  });

  it('envia a posição do celular', async () => {
    givenGeolocation({
      getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number } }) => void) =>
        success({ coords: { latitude: -23.5614, longitude: -46.6559 } }),
    });
    const view = open('/minhas-entregas');

    await view.user.click(await screen.findByRole('button', { name: 'Atualizar minha localização' }));

    expect(await screen.findByText('Localização enviada: -23,5614; -46,6559')).toBeInTheDocument();
    expect(mine.locations).toEqual([{ latitude: -23.5614, longitude: -46.6559 }]);
  });

  it('sem permissão de localização, explica o que fazer', async () => {
    givenGeolocation({
      getCurrentPosition: (_: unknown, failure: (error: { code: number; PERMISSION_DENIED: number }) => void) =>
        failure({ code: 1, PERMISSION_DENIED: 1 }),
    });
    const view = open('/minhas-entregas');

    await view.user.click(await screen.findByRole('button', { name: 'Atualizar minha localização' }));

    expect(await screen.findByText(/Permita o acesso à localização no navegador/)).toBeInTheDocument();
    expect(mine.locations).toEqual([]);
  });

  it('o entregador não abre as telas do painel', async () => {
    open('/pedidos');

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
  });

  it('em tempo real: um pedido despachado para ele aparece sozinho', async () => {
    mine.given(NEXT);
    open('/minhas-entregas', { realtime: true });
    expect(await screen.findByText('Nenhuma entrega em andamento')).toBeInTheDocument();
    await screen.findByRole('status', { name: /Ao vivo/ });
    await waitFor(() => expect(app?.dependencies.queryClient.isFetching()).toBe(0));

    mine.given(NEXT, courierOrder({ id: 'o-dispatched', customerName: 'Pedro Almeida' }));
    gateway.publishOrderUpdate({
      type: 'order.status-changed',
      orderId: 'o-dispatched',
      previousStatus: 'ready',
      status: 'delivering',
      deliveryPersonId: 'courier-1',
    });

    expect(await screen.findByRole('region', { name: 'Pedro Almeida' })).toBeInTheDocument();
  });

  it('não conseguiu entregar: relata o motivo e a entrega mostra que espera o gestor', async () => {
    const view = open('/minhas-entregas');

    await view.user.click(await screen.findByRole('button', { name: 'Não consegui entregar' }));
    const dialog = screen.getByRole('dialog', { name: 'Não conseguiu entregar?' });
    await view.user.selectOptions(within(dialog).getByLabelText('Motivo'), 'other');
    await view.user.click(within(dialog).getByRole('button', { name: 'Relatar problema' }));
    expect(within(dialog).getByLabelText('Observação')).toHaveAccessibleDescription(
      expect.stringContaining('Descreva o problema quando o motivo for "outro"'),
    );
    expect(mine.issues).toEqual([]);

    await view.user.selectOptions(within(dialog).getByLabelText('Motivo'), 'customer_absent');
    await view.user.type(within(dialog).getByLabelText('Observação (opcional)'), 'Ninguém atende');
    await view.user.click(within(dialog).getByRole('button', { name: 'Relatar problema' }));

    const current = screen.getByRole('region', { name: 'João Silva' });
    expect(await within(current).findByText('Problema relatado: Cliente ausente')).toBeInTheDocument();
    expect(current).toHaveTextContent('Ninguém atende');
    // A entrega fica parada até o gestor decidir: nem confirmar, nem relatar de novo.
    expect(within(current).queryByRole('button', { name: 'Não consegui entregar' })).not.toBeInTheDocument();
    expect(within(current).queryByRole('button', { name: 'Confirmar entrega' })).not.toBeInTheDocument();
    expect(current).toHaveTextContent('Aguardando a decisão do gestor');
    expect(mine.issues).toEqual([{ orderId: 'o-current', reason: 'customer_absent', note: 'Ninguém atende' }]);
  });
});
