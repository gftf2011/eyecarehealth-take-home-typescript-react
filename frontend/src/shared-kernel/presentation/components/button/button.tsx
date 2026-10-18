import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../styles/cx';
import { Spinner } from '../spinner/spinner';
import styles from './button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  readonly variant?: ButtonVariant;
  readonly size?: 'sm' | 'md';
  readonly fullWidth?: boolean;
  /** Mostra o spinner e bloqueia novos cliques enquanto a ação roda. */
  readonly loading?: boolean;
  readonly icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size="sm" label={null} /> : icon}
      <span>{children}</span>
    </button>
  );
}
