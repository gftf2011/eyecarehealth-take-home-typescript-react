import type { UseQueryResult } from '@tanstack/react-query';
import { useId, type ReactNode } from 'react';

import { Alert, Button, Skeleton, cx, errorMessage } from '../../../../shared-kernel/presentation';
import styles from './report-card.module.css';

export type ReportCardProps<TData> = {
  readonly title: string;
  readonly description?: string;
  readonly query: UseQueryResult<TData>;
  readonly isEmpty: (data: TData) => boolean;
  readonly emptyMessage: string;
  readonly wide?: boolean;
  readonly children: (data: TData) => ReactNode;
};

/**
 * Moldura de um relatório: carregamento, erro (com nova tentativa) e estado
 * vazio próprios, para um relatório com problema não esconder os outros.
 */
export function ReportCard<TData>({
  title,
  description,
  query,
  isEmpty,
  emptyMessage,
  wide = false,
  children,
}: ReportCardProps<TData>) {
  const titleId = useId();
  const data = query.data;

  return (
    <section className={cx(styles.card, wide && styles.wide)} aria-labelledby={titleId} aria-busy={query.isFetching}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
      </header>

      {query.isError ? (
        <Alert tone="error">
          <p>{errorMessage(query.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      {data === undefined && !query.isError ? (
        <div className={styles.loading} role="status" aria-label={`Carregando ${title}`}>
          <Skeleton height="12rem" />
        </div>
      ) : null}

      {data === undefined ? null : isEmpty(data) ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        <div className={styles.body}>{children(data)}</div>
      )}
    </section>
  );
}
