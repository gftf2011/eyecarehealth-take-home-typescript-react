import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeAuthApi, SEED_USERS } from '../../identity/infra/testing/fake-auth-api';
import { renderApp } from '../../main/testing/render-app';
import { createTestApiServer } from '../../shared-kernel/infra/testing/test-api';
import { productBody } from '../domain/product/testing/product.fixture';
import { FakeProductsApi } from '../infra/testing/fake-products-api';

const api = createTestApiServer();
let auth: FakeAuthApi;
let products: FakeProductsApi;
let app: ReturnType<typeof renderApp> | null = null;

const BURGER = productBody({ id: 'p-burger', name: 'X-Burger Especial', price: 32.9 });
const JUICE = productBody({
  id: 'p-juice',
  name: 'Suco de Laranja',
  description: 'Suco natural de laranja, 500ml',
  price: 12.5,
  category: 'drink',
  preparationTime: 5,
});
const BROWNIE = productBody({
  id: 'p-brownie',
  name: 'Brownie',
  description: 'Brownie de chocolate meio amargo',
  price: 14,
  category: 'dessert',
  isAvailable: false,
});

function open(path = '/produtos') {
  app = renderApp({ path });
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
  products = new FakeProductsApi();
  products.given(BURGER, JUICE, BROWNIE);
  api.server.use(...auth.handlers(), ...products.handlers());
});
afterEach(() => {
  app?.unmount();
  app = null;
  api.reset();
});
afterAll(() => api.close());

describe('Tela de produtos', () => {
  it('lista os produtos com categoria, preço, preparo e disponibilidade', async () => {
    open();

    const burger = await rowOf('X-Burger Especial');
    expect(burger).toHaveTextContent('Refeição');
    expect(burger).toHaveTextContent(/R\$\s?32,90/);
    expect(burger).toHaveTextContent('15 min');
    expect(within(burger).getByRole('switch', { name: 'Disponível: X-Burger Especial' })).toBeChecked();
    expect(within(await rowOf('Brownie')).getByRole('switch')).not.toBeChecked();
  });

  it('busca por nome enquanto digita (sem uma requisição por tecla)', async () => {
    const view = open();
    await rowOf('X-Burger Especial');
    const before = products.listQueries.length;

    await view.user.type(screen.getByLabelText('Buscar por nome'), 'suco');

    await waitFor(() => expect(view.router.state.location.search).toBe('?search=suco'));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /X-Burger/ })).not.toBeInTheDocument());
    expect(await rowOf('Suco de Laranja')).toBeInTheDocument();
    expect(products.listQueries.length - before).toBe(1);
    expect(products.listQueries.at(-1)?.get('search')).toBe('suco');
  });

  it('filtra por categoria e disponibilidade', async () => {
    const view = open();
    await rowOf('X-Burger Especial');

    await view.user.selectOptions(screen.getByLabelText('Disponibilidade'), 'false');

    expect(await rowOf('Brownie')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /X-Burger/ })).not.toBeInTheDocument());
    expect(products.listQueries.at(-1)?.get('isAvailable')).toBe('false');
  });

  it('cria um produto com validação em tempo real', async () => {
    const view = open();
    await view.user.click(await screen.findByRole('button', { name: 'Novo produto' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo produto' });

    await view.user.type(within(dialog).getByLabelText('Nome'), 'Batata Frita');
    await view.user.type(within(dialog).getByLabelText('Descrição'), 'Porção de batata frita crocante');
    await view.user.type(within(dialog).getByLabelText('Preço (R$)'), '16,5');
    await view.user.selectOptions(within(dialog).getByLabelText('Categoria'), 'side');
    await view.user.type(within(dialog).getByLabelText('Preparo (min)'), '10');
    await view.user.click(within(dialog).getByRole('button', { name: 'Criar produto' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(products.writes[0]).toMatchObject({
      method: 'POST',
      body: { name: 'Batata Frita', price: 16.5, category: 'side', preparationTime: 10, imageUrl: null },
    });
    expect(await rowOf('Batata Frita')).toHaveTextContent('Acompanhamento');
  });

  it('edita um produto a partir dos dados atuais', async () => {
    const view = open();
    await view.user.click(within(await rowOf('Suco de Laranja')).getByRole('button', { name: 'Editar Suco de Laranja' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar Suco de Laranja' });
    const price = within(dialog).getByLabelText('Preço (R$)');
    expect(price).toHaveValue('12,50');

    await view.user.clear(price);
    await view.user.type(price, '13,90');
    await view.user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(products.writes[0]).toMatchObject({ method: 'PUT', id: 'p-juice', body: { price: 13.9 } });
    expect(await rowOf('Suco de Laranja')).toHaveTextContent(/R\$\s?13,90/);
  });

  it('alterna a disponibilidade na hora e desfaz se a API recusar', async () => {
    const view = open();
    const toggle = within(await rowOf('X-Burger Especial')).getByRole('switch');
    products.failNextWrite = { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Indisponível' };

    await view.user.click(toggle);

    expect(await screen.findByText('Não foi possível alterar a disponibilidade')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('rowheader', { name: /X-Burger/ }).closest('tr') ?? document.body).getByRole('switch')).toBeChecked());

    await view.user.click(within(await rowOf('X-Burger Especial')).getByRole('switch'));
    await waitFor(() => expect(products.products.find((product) => product.id === 'p-burger')?.isAvailable).toBe(false));
    expect(products.writes.at(-1)).toMatchObject({ method: 'PUT', body: { isAvailable: false } });
  });

  it('exclusão pede confirmação e mostra o 409 quando o produto está em pedido aberto', async () => {
    products.inUse.add('p-burger');
    const view = open();

    await view.user.click(within(await rowOf('X-Burger Especial')).getByRole('button', { name: 'Excluir X-Burger Especial' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Excluir produto?' });
    await view.user.click(within(dialog).getByRole('button', { name: 'Excluir produto' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'O produto está em pedidos em andamento e não pode ser removido. Você pode marcá-lo como indisponível',
    );
    expect(await rowOf('X-Burger Especial')).toBeInTheDocument();
  });

  it('exclui depois de confirmar', async () => {
    const view = open();

    await view.user.click(within(await rowOf('Brownie')).getByRole('button', { name: 'Excluir Brownie' }));
    await view.user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir produto' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Brownie/ })).not.toBeInTheDocument());
    expect(products.writes).toEqual([{ method: 'DELETE', id: 'p-brownie', body: null }]);
  });

  it('perfil somente leitura vê o cardápio sem edição', async () => {
    auth.givenSignedIn(SEED_USERS.viewer);
    open();

    const burger = await rowOf('X-Burger Especial');
    expect(within(burger).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(burger).getByText('Sim')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo produto' })).not.toBeInTheDocument();
  });
});
