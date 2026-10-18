import type { Pagination as PageInfo } from '../../../application';
import { Button } from '../button/button';
import styles from './pagination.module.css';

export type PaginationProps = {
  readonly pagination: PageInfo;
  readonly onPageChange: (page: number) => void;
  /** Rótulo do item contado (ex.: "pedidos"). */
  readonly itemLabel: string;
};

export function Pagination({ pagination, onPageChange, itemLabel }: PaginationProps) {
  const { page, limit, total, totalPages } = pagination;
  if (total === 0) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <p className={styles.summary}>
        {first}–{last} de {total} {itemLabel}
      </p>
      <div className={styles.controls}>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className={styles.current} aria-current="page">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}
