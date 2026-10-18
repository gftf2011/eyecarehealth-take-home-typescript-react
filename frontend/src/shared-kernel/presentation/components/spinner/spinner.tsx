import { cx } from '../../styles/cx';
import styles from './spinner.module.css';

export type SpinnerProps = {
  readonly size?: 'sm' | 'md' | 'lg';
  /** Texto para leitores de tela; `null` quando o contexto já anuncia o carregamento. */
  readonly label?: string | null;
};

export function Spinner({ size = 'md', label = 'Carregando' }: SpinnerProps) {
  const decorative = label === null;
  return (
    <span
      className={cx(styles.spinner, styles[size])}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative ? true : undefined}
    >
      {decorative ? null : <span className="visually-hidden">{label}</span>}
    </span>
  );
}
