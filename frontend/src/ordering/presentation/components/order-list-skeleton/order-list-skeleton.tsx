import { Skeleton } from '../../../../shared-kernel/presentation';
import styles from '../order-list/order-list.module.css';

const ROWS = 5;

/** Esqueleto da lista enquanto a primeira página carrega (mesmo formato das linhas). */
export function OrderListSkeleton() {
  return (
    <ul className={styles.list} aria-hidden="true">
      {Array.from({ length: ROWS }, (_, index) => (
        <li key={index} className={styles.row}>
          <span className={styles.open}>
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="85%" height="0.75rem" />
          </span>
          <Skeleton width="5rem" height="1.25rem" />
          <Skeleton width="4.5rem" />
          <Skeleton width="6.5rem" />
          <Skeleton width="8rem" height="2rem" />
        </li>
      ))}
    </ul>
  );
}
