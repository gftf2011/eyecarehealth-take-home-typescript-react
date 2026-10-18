import { useId, type InputHTMLAttributes, type Ref } from 'react';

import { cx } from '../../styles/cx';
import styles from './text-field.module.css';

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & {
  readonly label: string;
  /** Mensagem de erro do campo; marca o input como inválido e é lida pelo leitor de tela. */
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly ref?: Ref<HTMLInputElement>;
};

export function TextField({ label, error, hint, ref, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        ref={ref}
        id={id}
        className={cx(styles.input, error !== undefined && styles.invalid)}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      {hint === undefined ? null : (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
