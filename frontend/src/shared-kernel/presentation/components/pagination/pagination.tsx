import type { Pagination as PageInfo } from '../../../application';
import { Button } from '../button/button';
import styles from './pagination.module.css';

export type PaginationProps = {
  readonly pagination: PageInfo;
  /** Itens na página atual. */
  readonly count: number;
  /** Vai para a página do cursor; `null` = primeira página. */
  readonly onCursorChange: (cursor: string | null) => void;
  /** Rótulo do item contado (ex.: "pedidos"). */
  readonly itemLabel: string;
};

/**
 * Navegação por cursor: anterior, próxima e volta ao início. Sem total nem
 * número de página de propósito: contar todos os registros a cada página é o
 * que deixa a listagem lenta com muitos dados (ver ADR de paginação).
 */
export function Pagination({ pagination, count, onCursorChange, itemLabel }: PaginationProps) {
  const { nextCursor, previousCursor } = pagination;
  if (nextCursor === null && previousCursor === null) return null;

  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <p className={styles.summary}>
        {count} {itemLabel} nesta página
      </p>
      <div className={styles.controls}>
        <Button variant="secondary" size="sm" disabled={previousCursor === null} onClick={() => onCursorChange(null)}>
          Início
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={previousCursor === null}
          onClick={() => onCursorChange(previousCursor)}
        >
          Anterior
        </Button>
        <Button variant="secondary" size="sm" disabled={nextCursor === null} onClick={() => onCursorChange(nextCursor)}>
          Próxima
        </Button>
      </div>
    </nav>
  );
}
