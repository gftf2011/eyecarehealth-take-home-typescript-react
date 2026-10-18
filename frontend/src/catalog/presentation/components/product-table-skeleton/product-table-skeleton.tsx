import { Skeleton } from '../../../../shared-kernel/presentation';
import styles from '../product-table/product-table.module.css';

const ROWS = 6;

/** Esqueleto da tabela enquanto a primeira página carrega. */
export function ProductTableSkeleton() {
  return (
    <div className={styles.scroller} aria-hidden="true">
      <table className={styles.table}>
        <tbody>
          {Array.from({ length: ROWS }, (_, index) => (
            <tr key={index}>
              <td className={styles.product}>
                <Skeleton width="2.75rem" height="2.75rem" />
                <span className={styles.text}>
                  <Skeleton width="10rem" />
                  <Skeleton width="14rem" height="0.75rem" />
                </span>
              </td>
              <td>
                <Skeleton width="5rem" />
              </td>
              <td>
                <Skeleton width="4rem" />
              </td>
              <td>
                <Skeleton width="3rem" />
              </td>
              <td>
                <Skeleton width="2.5rem" height="1.375rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
