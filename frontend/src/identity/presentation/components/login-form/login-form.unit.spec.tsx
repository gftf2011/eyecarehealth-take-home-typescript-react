import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  InputValidationError,
  RateLimitedError,
  UnauthenticatedError,
} from '../../../../shared-kernel/application';
import { LoginForm } from './login-form';

function setup(props: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} {...props} />);
  return {
    onSubmit,
    user,
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Senha'),
    submitButton: () => screen.getByRole('button', { name: 'Entrar' }),
  };
}

describe('LoginForm', () => {
  it('renderiza email, senha e o botão de entrar, sem erros iniciais', () => {
    const { email, password, submitButton } = setup();

    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('type', 'password');
    expect(submitButton()).toBeEnabled();
    expect(email).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('valida em tempo real depois que o campo é visitado', async () => {
    const { user, email } = setup();

    await user.type(email, 'admin');
    expect(screen.queryByText('Informe um email válido')).not.toBeInTheDocument();

    await user.tab();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Informe um email válido');

    await user.type(email, '@fastmeals.com');
    expect(email).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Informe um email válido')).not.toBeInTheDocument();
  });

  it('enviar vazio mostra os dois erros, foca o primeiro e não envia', async () => {
    const { user, email, submitButton, onSubmit } = setup();

    await user.click(submitButton());

    expect(screen.getByText('Informe o email')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
    expect(email).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia email e senha digitados (Enter também envia)', async () => {
    const { user, email, password, onSubmit } = setup();

    await user.type(email, 'admin@fastmeals.com');
    await user.type(password, 'Admin@123{Enter}');

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      email: 'admin@fastmeals.com',
      password: 'Admin@123',
    });
  });

  it('enquanto envia, bloqueia o botão e mostra o progresso', () => {
    setup({ pending: true });

    const button = screen.getByRole('button', { name: 'Entrando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    [new UnauthenticatedError('INVALID_CREDENTIALS', 'Email ou senha inválidos'), 'Email ou senha inválidos'],
    [
      new RateLimitedError('TOO_MANY_LOGIN_ATTEMPTS', 'Muitas tentativas de login.', 60),
      'Muitas tentativas de login. Tente novamente em 60 s.',
    ],
    [new Error('detalhe interno'), 'Algo deu errado. Tente novamente.'],
  ])('mostra a falha do envio: %s', (error, message) => {
    setup({ error });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('erros por campo vindos da API aparecem no campo depois do envio', async () => {
    const error = new InputValidationError([{ field: 'email', message: 'Email recusado pela API' }]);
    const { user, email, password } = setup({ error });

    await user.type(email, 'admin@fastmeals.com');
    await user.type(password, 'x{Enter}');

    expect(email).toHaveAccessibleDescription('Email recusado pela API');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
