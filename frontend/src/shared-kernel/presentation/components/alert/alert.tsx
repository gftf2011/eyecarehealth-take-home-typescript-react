import type { ReactNode } from 'react';

import { cx } from '../../styles/cx';
import styles from './alert.module.css';

export type AlertTone = 'error' | 'warning' | 'info' | 'success';

export type AlertProps = {
  readonly tone?: AlertTone;
  readonly title?: string;
  readonly children: ReactNode;
};

/**
 * Mensagem em destaque. Erros usam `role="alert"` (anunciados na hora pelo
 * leitor de tela); os demais tons, `role="status"`.
 */
export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div className={cx(styles.alert, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      {title === undefined ? null : <p className={styles.title}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}
