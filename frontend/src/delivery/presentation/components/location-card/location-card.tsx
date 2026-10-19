import { Alert, Button, errorMessage } from '../../../../shared-kernel/presentation';
import { useUpdateMyLocation } from '../../hooks/use-update-my-location';
import { formatCoordinate } from '../../labels/delivery-labels';
import styles from './location-card.module.css';

/** O entregador envia a posição do celular: a próxima sugestão de atribuição usa a distância real. */
export function LocationCard() {
  const update = useUpdateMyLocation();

  return (
    <section className={styles.card} aria-labelledby="location-title">
      <h2 id="location-title" className={styles.title}>
        Minha localização
      </h2>
      <p className={styles.muted}>Envie a sua posição para receber as entregas mais próximas.</p>
      {update.error === null ? null : <Alert tone="error">{errorMessage(update.error)}</Alert>}
      {update.data === undefined ? null : (
        <p role="status">
          Localização enviada: {formatCoordinate(update.data.latitude)}; {formatCoordinate(update.data.longitude)}
        </p>
      )}
      <Button variant="secondary" fullWidth loading={update.isPending} onClick={() => update.mutate()}>
        Atualizar minha localização
      </Button>
    </section>
  );
}
