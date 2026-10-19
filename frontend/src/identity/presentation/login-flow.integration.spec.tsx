import { screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { renderApp } from '../../main/testing/render-app';
import { FakeMyDeliveriesApi } from '../../delivery/infra/testing/fake-my-deliveries-api';
import { FakeOrdersApi } from '../../ordering/infra/testing/fake-orders-api';
import { FakeAuthApi, SEED_USERS } from '../infra/testing/fake-auth-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let app: ReturnType<typeof renderApp> | null = null;

function open(options: Parameters<typeof renderApp>[0] = {}) {
  app = renderApp(options);
  return app;
}

async function signIn(view: ReturnType<typeof renderApp>, email: string, password: string) {
  await view.user.type(await screen.findByLabelText('Email'), email);
  await view.user.type(screen.getByLabelText('Senha'), password);
  await view.user.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeAll(() => api.listen());
beforeEach(() => {
  auth = new FakeAuthApi();
  api.server.use(...auth.handlers(), ...new FakeOrdersApi().handlers(), ...new FakeMyDeliveriesApi().handlers());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Fluxo de login', () => {
  it('sem sessão, o painel manda para o login', async () => {
    const view = open({ path: '/' });

    expect(await screen.findByRole('heading', { name: 'FastMeals' })).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/login');
    expect(auth.refreshCalls).toBe(1);
  });

  it('credenciais inválidas: mostra o erro e continua no login', async () => {
    const view = open();

    await signIn(view, SEED_USERS.admin.email, 'senha-errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos');
    expect(view.router.state.location.pathname).toBe('/login');
  });

  it('login válido: entra no painel com o usuário e o perfil', async () => {
    const view = open();

    await signIn(view, SEED_USERS.admin.email, SEED_USERS.admin.password);

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByText(SEED_USERS.admin.email)).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/pedidos');
  });

  it('depois do login, volta para a página que o usuário tentou abrir', async () => {
    const view = open({ path: '/pedidos?status=ready' });

    await signIn(view, SEED_USERS.viewer.email, SEED_USERS.viewer.password);

    await screen.findByRole('button', { name: 'Sair' });
    expect(view.router.state.location.pathname).toBe('/pedidos');
    expect(view.router.state.location.search).toBe('?status=ready');
  });

  it('ao recarregar com o cookie válido, entra direto (sessão restaurada)', async () => {
    auth.givenSignedIn(SEED_USERS.viewer);
    const view = open({ path: '/' });

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByText(SEED_USERS.viewer.email)).toBeInTheDocument();
    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/pedidos');
    expect(auth.loginCalls).toBe(0);
  });

  it('sessão revogada no servidor: volta ao login avisando que expirou', async () => {
    auth.tokenTtlMs = 1_000;
    auth.givenSignedIn();
    const view = open({ renewal: { marginMs: 60_000, minDelayMs: 50 } });
    await screen.findByRole('button', { name: 'Sair' });

    auth.revokeSession();

    expect(
      await screen.findByText('Sua sessão expirou. Entre novamente para continuar.'),
    ).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/login');
  });

  it('sair: revoga no servidor e volta ao login', async () => {
    auth.givenSignedIn();
    const view = open();

    await view.user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByText('Você saiu do painel.')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/login');
    expect(auth.logoutCalls).toBe(1);
  });

  describe('outra pessoa no mesmo navegador', () => {
    it('o admin sai de /pedidos e o entregador entra: vai para a tela dele, não para a do admin', async () => {
      auth.givenSignedIn(SEED_USERS.admin);
      const view = open({ path: '/pedidos' });
      await view.user.click(await screen.findByRole('button', { name: 'Sair' }));
      await screen.findByText('Você saiu do painel.');

      await signIn(view, SEED_USERS.courier.email, SEED_USERS.courier.password);

      expect(await screen.findByRole('heading', { name: 'Minhas entregas' })).toBeInTheDocument();
      expect(view.router.state.location.pathname).toBe('/minhas-entregas');
      expect(screen.queryByText('Acesso negado')).not.toBeInTheDocument();
    });

    it('depois de "Sair", a página não é lembrada: o próximo login vai para a tela inicial', async () => {
      auth.givenSignedIn(SEED_USERS.admin);
      const view = open({ path: '/produtos' });
      await view.user.click(await screen.findByRole('button', { name: 'Sair' }));
      await screen.findByText('Você saiu do painel.');

      await signIn(view, SEED_USERS.admin.email, SEED_USERS.admin.password);

      await screen.findByRole('button', { name: 'Sair' });
      expect(view.router.state.location.pathname).toBe('/pedidos');
    });

    it('sessão expirada em /pedidos e quem entra é o entregador: tela inicial dele', async () => {
      auth.tokenTtlMs = 1_000;
      auth.givenSignedIn(SEED_USERS.admin);
      const view = open({ path: '/pedidos', renewal: { marginMs: 60_000, minDelayMs: 50 } });
      await screen.findByRole('button', { name: 'Sair' });
      auth.revokeSession();
      await screen.findByText('Sua sessão expirou. Entre novamente para continuar.');

      await signIn(view, SEED_USERS.courier.email, SEED_USERS.courier.password);

      expect(await screen.findByRole('heading', { name: 'Minhas entregas' })).toBeInTheDocument();
      expect(view.router.state.location.pathname).toBe('/minhas-entregas');
    });

    it('sessão expirada e a mesma pessoa entra de novo: volta para a página onde estava', async () => {
      auth.tokenTtlMs = 1_000;
      auth.givenSignedIn(SEED_USERS.viewer);
      const view = open({ path: '/produtos', renewal: { marginMs: 60_000, minDelayMs: 50 } });
      await screen.findByRole('button', { name: 'Sair' });
      auth.revokeSession();
      await screen.findByText('Sua sessão expirou. Entre novamente para continuar.');

      await signIn(view, SEED_USERS.viewer.email, SEED_USERS.viewer.password);

      await screen.findByRole('button', { name: 'Sair' });
      expect(view.router.state.location.pathname).toBe('/produtos');
    });

    it('link direto para uma tela do outro perfil: o aviso de acesso negado leva à tela inicial', async () => {
      auth.givenSignedIn(SEED_USERS.viewer);
      const view = open({ path: '/entregadores' });

      expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
      await view.user.click(screen.getByRole('link', { name: 'Ir para a minha tela inicial' }));

      expect(view.router.state.location.pathname).toBe('/pedidos');
    });
  });
});

