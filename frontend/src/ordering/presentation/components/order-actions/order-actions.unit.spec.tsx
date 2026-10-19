import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BusinessRuleRejectedError } from '../../../../shared-kernel/application';
import { toOrderDto } from '../../../application';
import { buildOrder } from '../../../domain/order/testing/order.fixture';
import { renderWithOrdering } from '../../testing/render-with-ordering';
import { OrderActions } from './order-actions';

const dto = (overrides: Parameters<typeof buildOrder>[0] = {}) => toOrderDto(buildOrder(overrides));

describe('OrderActions', () => {
  it.each([
    ['pending', ['Iniciar preparo', 'Cancelar pedido']],
    ['preparing', ['Marcar como pronto', 'Cancelar pedido']],
    ['delivering', ['Confirmar entrega', 'Devolver para a atribuição']],
  ] as const)('pedido %s mostra só as ações válidas', (status, labels) => {
    renderWithOrdering(<OrderActions order={dto({ status })} />);

    const buttons = within(screen.getByRole('group')).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(labels);
  });

  it('pedidos finalizados não mostram ações', () => {
    const { container } = renderWithOrdering(<OrderActions order={dto({ status: 'delivered' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('perfil somente leitura não vê ações', () => {
    renderWithOrdering(<OrderActions order={dto({ status: 'pending' })} />, { permissions: ['orders:read'] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('pronto sem entregador: despachar desabilitado, com o motivo', () => {
    renderWithOrdering(<OrderActions order={dto({ status: 'ready' })} />);

    const dispatch = screen.getByRole('button', { name: 'Despachar' });
    expect(dispatch).toBeDisabled();
    expect(dispatch).toHaveAccessibleDescription('Atribua um entregador na tela de atribuição para despachar.');
  });

  it('avança o status com um clique', async () => {
    const { user, gateway } = renderWithOrdering(<OrderActions order={dto({ status: 'pending' })} />);

    await user.click(screen.getByRole('button', { name: 'Iniciar preparo' }));

    expect(gateway.statusChanges).toEqual([{ id: 'order-1', status: 'preparing' }]);
  });

  it('cancelar pede confirmação; "Manter pedido" não cancela', async () => {
    const { user, gateway } = renderWithOrdering(<OrderActions order={dto({ status: 'pending' })} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Cancelar pedido?' });
    expect(dialog).toHaveTextContent('João Silva');

    await user.click(within(dialog).getByRole('button', { name: 'Manter pedido' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(gateway.statusChanges).toHaveLength(0);
  });

  it('cancelar confirmado envia o cancelamento', async () => {
    const { user, gateway } = renderWithOrdering(<OrderActions order={dto({ status: 'pending' })} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar pedido' }));

    expect(gateway.statusChanges).toEqual([{ id: 'order-1', status: 'cancelled' }]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('mostra a recusa da API', async () => {
    const { user, gateway } = renderWithOrdering(<OrderActions order={dto({ status: 'pending' })} />);
    gateway.changeStatusAnswer = () =>
      Promise.reject(new BusinessRuleRejectedError('INVALID_STATUS_TRANSITION', 'O pedido já foi cancelado'));

    await user.click(screen.getByRole('button', { name: 'Iniciar preparo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O pedido já foi cancelado');
  });

  describe('devolver a entrega para a atribuição', () => {
    const delivering = () => dto({ status: 'delivering', deliveryPerson: { id: 'c-1', name: 'Carlos Santos' } });

    it('pede o motivo, explica o efeito e valida antes de enviar', async () => {
      const { user, gateway } = renderWithOrdering(<OrderActions order={delivering()} />);

      await user.click(screen.getByRole('button', { name: 'Devolver para a atribuição' }));
      const dialog = screen.getByRole('dialog', { name: 'Devolver entrega para a atribuição?' });
      expect(dialog).toHaveTextContent('volta para os prontos, sem entregador (Carlos Santos fica livre)');

      await user.click(within(dialog).getByRole('button', { name: 'Devolver para a atribuição' }));

      expect(within(dialog).getByLabelText('Motivo')).toHaveAccessibleDescription(
        expect.stringContaining('O motivo deve ter entre 3 e 200 caracteres'),
      );
      expect(within(dialog).getByLabelText('Motivo')).toHaveFocus();
      expect(gateway.returns).toEqual([]);
    });

    it('envia o motivo e fecha', async () => {
      const { user, gateway } = renderWithOrdering(<OrderActions order={delivering()} />);

      await user.click(screen.getByRole('button', { name: 'Devolver para a atribuição' }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText('Motivo'), 'Entregador sem contato');
      await user.click(within(dialog).getByRole('button', { name: 'Devolver para a atribuição' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(gateway.returns).toEqual([{ id: 'order-1', reason: 'Entregador sem contato' }]);
    });

    it('não aparece na linha da lista, só no detalhe', () => {
      renderWithOrdering(<OrderActions order={delivering()} compact />);
      expect(screen.queryByRole('button', { name: 'Devolver para a atribuição' })).not.toBeInTheDocument();
    });
  });
});
