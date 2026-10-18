import type { AvailableCourier } from '../../../domain';
import { VEHICLE_LABELS } from '../../labels/delivery-labels';
import { BoardPanel } from '../board-panel/board-panel';
import styles from './available-couriers-panel.module.css';

/** Entregadores ativos e livres; sem GPS ficam fora do cálculo e são sinalizados. */
export function AvailableCouriersPanel({ couriers }: { readonly couriers: readonly AvailableCourier[] }) {
  return (
    <BoardPanel title="Entregadores disponíveis" count={couriers.length} empty="Nenhum entregador ativo e livre agora.">
      <ul className={styles.list}>
        {couriers.map((courier) => (
          <li key={courier.id} className={styles.item}>
            <span className={styles.avatar} aria-hidden="true">
              {courier.name.charAt(0)}
            </span>
            <span className={styles.name}>{courier.name}</span>
            <span className={styles.vehicle}>{VEHICLE_LABELS[courier.vehicleType]}</span>
            {courier.hasLocation ? null : (
              <span className={styles.noGps} title="Sem localização: não entra no cálculo de distâncias">
                Sem GPS
              </span>
            )}
          </li>
        ))}
      </ul>
    </BoardPanel>
  );
}
