import { Alert, Button, Switch, cx, errorMessage, useCan } from '../../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../../application';
import { useSetDeliveryPersonActivation } from '../../hooks/use-set-delivery-person-activation';
import { VEHICLE_LABELS, formatCoordinate } from '../../labels/delivery-labels';
import styles from './delivery-person-table.module.css';

export type DeliveryPersonTableProps = {
  readonly persons: readonly DeliveryPersonDto[];
  readonly onEdit: (person: DeliveryPersonDto) => void;
  readonly onRemove: (person: DeliveryPersonDto) => void;
};

function Situation({ person }: { readonly person: DeliveryPersonDto }) {
  if (person.isOnDelivery) return <span className={cx(styles.badge, styles.delivering)}>Em entrega</span>;
  if (!person.isActive) return <span className={cx(styles.badge, styles.off)}>Inativo</span>;
  return <span className={styles.badge}>Livre</span>;
}

/**
 * Tabela da frota. A ativação alterna direto na linha (atualização otimista);
 * editar e excluir só aparecem para quem tem `delivery-persons:write`.
 */
export function DeliveryPersonTable({ persons, onEdit, onRemove }: DeliveryPersonTableProps) {
  const canWrite = useCan('delivery-persons:write');
  const activation = useSetDeliveryPersonActivation();

  return (
    <div className={styles.wrapper}>
      {activation.error === null ? null : (
        <Alert tone="error" title="Não foi possível alterar a ativação">
          {errorMessage(activation.error)}
        </Alert>
      )}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="visually-hidden">Entregadores da frota</caption>
          <thead>
            <tr>
              <th scope="col">Entregador</th>
              <th scope="col">Veículo</th>
              <th scope="col">Situação</th>
              <th scope="col">Localização</th>
              <th scope="col">Ativo</th>
              {canWrite ? (
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {persons.map((person) => (
              <tr key={person.id} className={person.isActive ? undefined : styles.inactive}>
                <th scope="row" className={styles.person}>
                  <span className={styles.avatar} aria-hidden="true">
                    {person.name.charAt(0)}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{person.name}</span>
                    <span className={styles.muted}>{person.phone}</span>
                  </span>
                </th>
                <td>{VEHICLE_LABELS[person.vehicleType]}</td>
                <td>
                  <Situation person={person} />
                </td>
                <td>
                  {person.latitude === null || person.longitude === null ? (
                    <span className={styles.muted}>Sem localização</span>
                  ) : (
                    <span className={styles.muted}>
                      {formatCoordinate(person.latitude)}; {formatCoordinate(person.longitude)}
                    </span>
                  )}
                </td>
                <td>
                  {canWrite ? (
                    <Switch
                      checked={person.isActive}
                      label={`Ativo: ${person.name}`}
                      onChange={(isActive) => activation.mutate({ id: person.id, isActive })}
                    />
                  ) : (
                    <span>{person.isActive ? 'Sim' : 'Não'}</span>
                  )}
                </td>
                {canWrite ? (
                  <td>
                    <div className={styles.actions}>
                      <Button variant="secondary" size="sm" onClick={() => onEdit(person)} aria-label={`Editar ${person.name}`}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onRemove(person)} aria-label={`Excluir ${person.name}`}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
