import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { FakeRealtimeGateway } from '../../realtime/infra/testing/fake-realtime-gateway';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { deliveryPersonBody } from '../domain/delivery-person/testing/delivery-person.fixture';
import { FakeDeliveryPersonsApi } from '../infra/testing/fake-delivery-persons-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let couriers: FakeDeliveryPersonsApi;
let gateway: FakeRealtimeGateway;
let app: ReturnType<typeof renderApp> | null = null;

const CARLOS = deliveryPersonBody({ id: 'c-carlos', name: 'Carlos Santos', currentOrderId: 'order-1' });
const ANA = deliveryPersonBody({
  id: 'c-ana',
  name: 'Ana Ferreira',
  phone: '(11) 98765-4321',
  vehicleType: 'bicycle',
  currentLatitude: null,
  currentLongitude: null,
});
const BRUNO = deliveryPersonBody({ id: 'c-bruno', name: 'Bruno Lima', vehicleType: 'car', isActive: false });

function open(path = '/entregadores', options: { realtime?: boolean } = {}) {
  app = renderApp({ path, ...options });
  return app;
}

const rowOf = async (name: string): Promise<HTMLElement> => {
  const header = await screen.findByRole('rowheader', { name: new RegExp(`^.?${name}`) });
  const row = header.closest('tr');
  if (row === null) throw new Error(`linha de ${name} não encontrada`);
  return row;
};

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  auth.givenSignedIn(SEED_USERS.admin);
  couriers = new FakeDeliveryPersonsApi();
  couriers.given(CARLOS, ANA, BRUNO);
  gateway = new FakeRealtimeGateway();
  api.server.use(...auth.handlers(), ...couriers.handlers(), gateway.handler());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Tela de entregadores', () => {
  it('lista a frota com veículo, situação, localização e ativação', async () => {
    open();

    const carlos = await rowOf('Carlos Santos');
    expect(carlos).toHaveTextContent('Moto');
    expect(carlos).toHaveTextContent('Em entrega');
    expect(carlos).toHaveTextContent('-23,5489; -46,6388');
    const ana = await rowOf('Ana Ferreira');
    expect(ana).toHaveTextContent('Livre');
    expect(ana).toHaveTextContent('Sem localização');
    expect(ana).toHaveTextContent('(11) 98765-4321');
    expect(within(await rowOf('Bruno Lima')).getByRole('switch', { name: 'Ativo: Bruno Lima' })).not.toBeChecked();
    expect(await rowOf('Bruno Lima')).toHaveTextContent('Inativo');
  });

  it('está no menu do admin', async () => {
    open('/');

    expect(await screen.findByRole('link', { name: 'Entregadores' })).toHaveAttribute('href', '/entregadores');
  });

  it('filtra por situação e entrega pela URL', async () => {
    const view = open();
    await rowOf('Carlos Santos');

    await view.user.selectOptions(screen.getByLabelText('Entrega'), 'false');

    await waitFor(() => expect(view.router.state.location.search).toBe('?available=false'));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Ana Ferreira/ })).not.toBeInTheDocument());
    expect(await rowOf('Carlos Santos')).toBeInTheDocument();
    expect(couriers.listQueries.at(-1)?.get('available')).toBe('false');

    await view.user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await rowOf('Ana Ferreira')).toBeInTheDocument();
  });

  it('cadastra um entregador com validação em tempo real', async () => {
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Novo entregador' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo entregador' });

    const phone = within(dialog).getByLabelText('Telefone');
    await view.user.type(phone, '11987654321');
    await view.user.tab();
    expect(phone).toHaveAccessibleDescription('O telefone deve estar no formato (XX) XXXXX-XXXX');

    await view.user.type(within(dialog).getByLabelText('Nome'), 'Diego Souza');
    await view.user.clear(phone);
    await view.user.type(phone, '(11) 97777-6666');
    await view.user.selectOptions(within(dialog).getByLabelText('Veículo'), 'car');
    await view.user.type(within(dialog).getByLabelText('Latitude'), '-23,57');
    await view.user.click(within(dialog).getByRole('button', { name: 'Cadastrar entregador' }));
    expect(within(dialog).getByLabelText('Longitude')).toHaveAccessibleDescription('Informe a longitude junto com a latitude');
    expect(couriers.writes).toEqual([]);

    await view.user.type(within(dialog).getByLabelText('Longitude'), '-46,64');
    await view.user.click(within(dialog).getByRole('button', { name: 'Cadastrar entregador' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(couriers.writes[0]).toMatchObject({
      method: 'POST',
      body: {
        name: 'Diego Souza',
        phone: '(11) 97777-6666',
        vehicleType: 'car',
        isActive: true,
        currentLatitude: -23.57,
        currentLongitude: -46.64,
      },
    });
    expect(await rowOf('Diego Souza')).toHaveTextContent('Carro');
  });

  it('erro por campo vindo da API aparece no campo', async () => {
    couriers.failNextWrite = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: [{ field: 'name', message: 'Nome já usado por outro entregador' }],
    };
    const view = open();
    await view.user.click(within(await rowOf('Ana Ferreira')).getByRole('button', { name: 'Editar Ana Ferreira' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar Ana Ferreira' });

    await view.user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByText('Nome já usado por outro entregador')).toBeInTheDocument();
  });

  it('edita a partir dos dados atuais e apaga a localização', async () => {
    const view = open();
    await view.user.click(within(await rowOf('Carlos Santos')).getByRole('button', { name: 'Editar Carlos Santos' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar Carlos Santos' });
    const latitude = within(dialog).getByLabelText('Latitude');
    expect(latitude).toHaveValue('-23,5489');

    await view.user.clear(latitude);
    await view.user.clear(within(dialog).getByLabelText('Longitude'));
    await view.user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(couriers.writes[0]).toMatchObject({
      method: 'PUT',
      id: 'c-carlos',
      body: { name: 'Carlos Santos', currentLatitude: null, currentLongitude: null },
    });
    expect(await rowOf('Carlos Santos')).toHaveTextContent('Sem localização');
  });

  it('alterna a ativação na hora e desfaz se a API recusar', async () => {
    const view = open();
    couriers.failNextWrite = { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Indisponível' };

    await view.user.click(within(await rowOf('Ana Ferreira')).getByRole('switch'));

    expect(await screen.findByText('Não foi possível alterar a ativação')).toBeInTheDocument();
    await waitFor(async () => expect(within(await rowOf('Ana Ferreira')).getByRole('switch')).toBeChecked());

    await view.user.click(within(await rowOf('Ana Ferreira')).getByRole('switch'));
    await waitFor(() => expect(couriers.persons.find((person) => person.id === 'c-ana')?.isActive).toBe(false));
    expect(couriers.writes.at(-1)).toEqual({ method: 'PUT', id: 'c-ana', body: { isActive: false } });
  });

  it('quem está em entrega não pode ser excluído: o botão fica desabilitado, com o motivo', async () => {
    open();

    const remove = within(await rowOf('Carlos Santos')).getByRole('button', { name: 'Excluir Carlos Santos' });

    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute('title', 'Em entrega: espere terminar ou desative-o');
    expect(within(await rowOf('Ana Ferreira')).getByRole('button', { name: 'Excluir Ana Ferreira' })).toBeEnabled();
  });

  it('se a entrega começar depois de a tela carregar, a API recusa (409) e o painel explica', async () => {
    const view = open();
    await view.user.click(within(await rowOf('Ana Ferreira')).getByRole('button', { name: 'Excluir Ana Ferreira' }));
    const ana = couriers.persons.find((person) => person.id === 'c-ana');
    if (ana !== undefined) ana.currentOrderId = 'order-2';

    const dialog = screen.getByRole('alertdialog', { name: 'Excluir entregador?' });
    await view.user.click(within(dialog).getByRole('button', { name: 'Excluir entregador' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "atribuído a um pedido com status 'delivering'. Espere a entrega terminar ou desative-o",
    );
  });

  it('exclui depois de confirmar', async () => {
    const view = open();

    await view.user.click(within(await rowOf('Bruno Lima')).getByRole('button', { name: 'Excluir Bruno Lima' }));
    await view.user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir entregador' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Bruno Lima/ })).not.toBeInTheDocument());
    expect(couriers.writes).toEqual([{ method: 'DELETE', id: 'c-bruno', body: null }]);
  });

  it('perfil somente leitura não vê a tela nem o menu (a API exige delivery-persons:read)', async () => {
    auth.givenSignedIn(SEED_USERS.viewer);
    open();

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entregadores' })).not.toBeInTheDocument();
    expect(couriers.listQueries).toEqual([]);
  });

  it('em tempo real: entregador cadastrado em outro lugar e despacho que o ocupa aparecem sozinhos', async () => {
    open('/entregadores', { realtime: true });
    await rowOf('Ana Ferreira');
    await screen.findByRole('status', { name: /Ao vivo/ });
    await waitFor(() => expect(app?.dependencies.queryClient.isFetching()).toBe(0));

    couriers.persons.push(deliveryPersonBody({ id: 'c-eva', name: 'Eva Rocha' }));
    gateway.publishDeliveryPersonUpdate({ type: 'delivery-person.registered', deliveryPersonId: 'c-eva' });
    expect(await rowOf('Eva Rocha')).toHaveTextContent('Livre');

    const ana = couriers.persons.find((person) => person.id === 'c-ana');
    if (ana !== undefined) ana.currentOrderId = 'order-2';
    gateway.publishOrderUpdate({ type: 'order.status-changed', orderId: 'order-2', previousStatus: 'ready', status: 'delivering' });
    await waitFor(async () => expect(await rowOf('Ana Ferreira')).toHaveTextContent('Em entrega'), { timeout: 3_000 });
  });
});
