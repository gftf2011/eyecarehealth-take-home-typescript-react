import { useId, type SelectHTMLAttributes } from 'react';

import { cx } from '../../styles/cx';
import styles from '../text-field/text-field.module.css';

export type SelectOption = { readonly value: string; readonly label: string };

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> & {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly error?: string | undefined;
};

/** Select nativo (acessível e bom no celular) com o mesmo visual dos campos de texto. */
export function SelectField({ label, options, error, ...props }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className={cx(styles.input, error !== undefined && styles.invalid)}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
