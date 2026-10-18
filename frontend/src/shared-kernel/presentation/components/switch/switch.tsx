import { cx } from '../../styles/cx';
import styles from './switch.module.css';

export type SwitchProps = {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Nome acessível (ex.: "Disponível: X-Burger"). */
  readonly label: string;
  /** Texto visível ao lado; omitido em tabelas, onde a coluna já diz o que é. */
  readonly visibleLabel?: string;
  readonly disabled?: boolean;
};

/** Interruptor liga/desliga acessível (`role="switch"`, Espaço/Enter alternam). */
export function Switch({ checked, onChange, label, visibleLabel, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={cx(styles.track, checked && styles.on)} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {visibleLabel === undefined ? null : <span className={styles.text}>{visibleLabel}</span>}
    </button>
  );
}
