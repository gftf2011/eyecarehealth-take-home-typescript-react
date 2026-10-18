import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { EMPTY_PRODUCT_FORM } from '../../../application';
import { ProductForm } from './product-form';

function setup(props: Partial<Parameters<typeof ProductForm>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <>
      <ProductForm id="product-form" initialValue={EMPTY_PRODUCT_FORM} onSubmit={onSubmit} {...props} />
      <button type="submit" form="product-form">
        Salvar
      </button>
    </>,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('ProductForm', () => {
  it('renderiza todos os campos do produto, disponível por padrão', () => {
    setup();

    for (const label of ['Nome', 'Descrição', 'Preço (R$)', 'Categoria', 'Preparo (min)', 'URL da imagem (opcional)']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('switch', { name: 'Disponível para pedidos' })).toBeChecked();
  });

  it('valida em tempo real: o erro aparece ao sair do campo e some ao corrigir', async () => {
    const { user } = setup();
    const name = screen.getByLabelText('Nome');

    await user.type(name, 'X');
    await user.tab();
    expect(name).toHaveAccessibleDescription('O nome deve ter entre 3 e 120 caracteres');

    await user.type(name, '-Burger');
    expect(name).toHaveAttribute('aria-invalid', 'false');
  });

  it('mostra o contador da descrição', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('Descrição'), 'Pão e queijo');

    expect(screen.getByText('12/500')).toBeInTheDocument();
  });

  it('enviar inválido mostra todos os erros, foca o primeiro e não envia', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe o preço')).toBeInTheDocument();
    expect(screen.getByText('Escolha uma categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia o formulário preenchido', async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText('Nome'), 'Suco de Laranja');
    await user.type(screen.getByLabelText('Descrição'), 'Suco natural, 500ml');
    await user.type(screen.getByLabelText('Preço (R$)'), '12,50');
    await user.selectOptions(screen.getByLabelText('Categoria'), 'drink');
    await user.type(screen.getByLabelText('Preparo (min)'), '5');
    await user.click(screen.getByRole('switch', { name: 'Disponível para pedidos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: 'Suco de Laranja',
      description: 'Suco natural, 500ml',
      price: '12,50',
      category: 'drink',
      imageUrl: '',
      preparationTime: '5',
      isAvailable: false,
    });
  });

  it('erro por campo vindo da API aparece no campo', async () => {
    const error = new InputValidationError([{ field: 'name', message: 'Já existe um produto com esse nome' }]);
    const { user } = setup({ error });

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription(
      'O nome deve ter entre 3 e 120 caracteres',
    );
    await user.type(screen.getByLabelText('Nome'), 'Suco');
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Já existe um produto com esse nome');
  });
});
