import { Skeleton } from '../../../../shared-kernel/presentation';
import styles from '../delivery-person-table/delivery-person-table.module.css';

const ROWS = 5;

/** Esqueleto da tabela enquanto a frota carrega. */
export function DeliveryPersonTableSkeleton() {
  return (
    <div className={styles.scroller} aria-hidden="true">
      <table className={styles.table}>
        <tbody>
          {Array.from({ length: ROWS }, (_, index) => (
            <tr key={index}>
              <td className={styles.person}>
                <Skeleton width="2.5rem" height="2.5rem" />
                <span className={styles.text}>
                  <Skeleton width="9rem" />
                  <Skeleton width="7rem" height="0.75rem" />
                </span>
              </td>
              <td>
                <Skeleton width="4rem" />
              </td>
              <td>
                <Skeleton width="5rem" />
              </td>
              <td>
                <Skeleton width="8rem" />
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
