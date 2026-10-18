import type { ReactNode } from 'react';

import styles from './empty-state.module.css';

/** Lista sem resultados: explica o motivo e sugere o próximo passo. */
export function EmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.title}>{title}</p>
      {description === undefined ? null : <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}
