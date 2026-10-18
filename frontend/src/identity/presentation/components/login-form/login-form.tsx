import { useRef, useState, type FormEvent } from 'react';

import { InputValidationError } from '../../../../shared-kernel/application';
import { Alert, Button, TextField, errorMessage } from '../../../../shared-kernel/presentation';
import { loginInputErrors, type LoginField, type LoginInput } from '../../../application';
import styles from './login-form.module.css';

export type LoginFormProps = {
  readonly onSubmit: (input: LoginInput) => void;
  readonly pending?: boolean;
  /** Falha do último envio (credenciais inválidas, limite de tentativas, rede). */
  readonly error?: unknown;
};

const FIELDS: readonly LoginField[] = ['email', 'password'];

/**
 * Formulário de login com validação em tempo real: as mesmas regras do caso
 * de uso (Value Objects) rodam a cada digitação, mas um campo só mostra erro
 * depois de visitado ou de uma tentativa de envio.
 */
export function LoginForm({ onSubmit, pending = false, error = null }: LoginFormProps) {
  const [values, setValues] = useState<LoginInput>({ email: '', password: '' });
  const [touched, setTouched] = useState<ReadonlySet<LoginField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const inputs = useRef<Partial<Record<LoginField, HTMLInputElement | null>>>({});

  const clientErrors = loginInputErrors(values);
  const serverFieldErrors = error instanceof InputValidationError ? error.messagesByField() : {};
  const formError = error === null || error instanceof InputValidationError ? null : error;

  const visibleError = (field: LoginField): string | undefined =>
    submitted || touched.has(field) ? (clientErrors[field] ?? serverFieldErrors[field]) : undefined;

  const change = (field: LoginField, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const blur = (field: LoginField): void => {
    setTouched((current) => new Set(current).add(field));
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalid = FIELDS.find((field) => clientErrors[field] !== undefined);
    if (firstInvalid !== undefined) {
      inputs.current[firstInvalid]?.focus();
      return;
    }
    onSubmit(values);
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-label="Entrar no painel">
      {formError === null ? null : <Alert tone="error">{errorMessage(formError)}</Alert>}

      <TextField
        ref={(element) => {
          inputs.current.email = element;
        }}
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        placeholder="voce@fastmeals.com"
        value={values.email}
        onChange={(event) => change('email', event.target.value)}
        onBlur={() => blur('email')}
        error={visibleError('email')}
        required
      />

      <TextField
        ref={(element) => {
          inputs.current.password = element;
        }}
        label="Senha"
        type="password"
        name="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(event) => change('password', event.target.value)}
        onBlur={() => blur('password')}
        error={visibleError('password')}
        required
      />

      <Button type="submit" fullWidth loading={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
