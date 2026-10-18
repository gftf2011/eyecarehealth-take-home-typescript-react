import { useId, type ReactNode } from 'react';

import styles from './board-panel.module.css';

/** Coluna do quadro de atribuição: título com contagem e o conteúdo (ou o estado vazio). */
export function BoardPanel({
  title,
  count,
  empty,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly empty: string;
  readonly children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <span className={styles.count} aria-label={`${count} itens`}>
          {count}
        </span>
      </header>
      {count === 0 ? <p className={styles.empty}>{empty}</p> : children}
    </section>
  );
}
