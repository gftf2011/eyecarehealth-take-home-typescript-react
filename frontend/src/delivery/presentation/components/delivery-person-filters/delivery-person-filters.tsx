import { Button, SelectField } from '../../../../shared-kernel/presentation';
import type { DeliveryPersonFilterValues } from '../../hooks/use-delivery-person-filters';
import styles from './delivery-person-filters.module.css';

const EMPTY: DeliveryPersonFilterValues = { isActive: '', available: '' };

const ACTIVE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Inativos' },
];

const AVAILABLE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Livres' },
  { value: 'false', label: 'Em entrega' },
];

/** Filtros aplicados na hora (vão para a URL). */
export function DeliveryPersonFilters({
  value,
  onApply,
}: {
  readonly value: DeliveryPersonFilterValues;
  readonly onApply: (filters: DeliveryPersonFilterValues) => void;
}) {
  return (
    <form
      className={styles.filters}
      role="search"
      aria-label="Filtrar entregadores"
      onSubmit={(event) => event.preventDefault()}
    >
      <SelectField
        label="Situação"
        options={ACTIVE_OPTIONS}
        value={value.isActive}
        onChange={(event) => onApply({ ...value, isActive: event.target.value })}
      />
      <SelectField
        label="Entrega"
        options={AVAILABLE_OPTIONS}
        value={value.available}
        onChange={(event) => onApply({ ...value, available: event.target.value })}
      />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          disabled={value.isActive === '' && value.available === ''}
          onClick={() => onApply(EMPTY)}
        >
          Limpar filtros
        </Button>
      </div>
    </form>
  );
}
