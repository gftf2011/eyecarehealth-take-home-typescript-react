import { useId, type TextareaHTMLAttributes } from 'react';

import { cx } from '../../styles/cx';
import styles from '../text-field/text-field.module.css';
import own from './text-area-field.module.css';

export type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> & {
  readonly label: string;
  readonly error?: string | undefined;
  /** Mostra "n/max" para o usuário acompanhar o limite. */
  readonly maxLengthHint?: number;
};

export function TextAreaField({ label, error, maxLengthHint, value, ...props }: TextAreaFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const length = typeof value === 'string' ? value.trim().length : 0;
  const describedBy = [maxLengthHint === undefined ? null : countId, error === undefined ? null : errorId]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea
        {...props}
        id={id}
        value={value}
        className={cx(styles.input, own.textarea, error !== undefined && styles.invalid)}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      <div className={own.footer}>
        {error === undefined ? <span /> : (
          <p id={errorId} className={styles.error}>
            {error}
          </p>
        )}
        {maxLengthHint === undefined ? null : (
          <span id={countId} className={cx(styles.hint, length > maxLengthHint && own.over)}>
            {length}/{maxLengthHint}
          </span>
        )}
      </div>
    </div>
  );
}
