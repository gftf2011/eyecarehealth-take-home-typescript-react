import { useState } from 'react';

import { Button, SelectField, TextField } from '../../../../shared-kernel/presentation';
import { listOrdersInputErrors } from '../../../application';
import { ORDER_STATUSES } from '../../../domain';
import type { OrderFilterValues } from '../../hooks/use-order-filters';
import { ORDER_STATUS_LABELS, SORT_OPTIONS } from '../../labels/order-labels';
import styles from './order-filters.module.css';

export type OrderFiltersProps = {
  readonly value: OrderFilterValues;
  readonly onApply: (filters: OrderFilterValues) => void;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
];

const EMPTY: OrderFilterValues = { status: '', startDate: '', endDate: '', sortBy: '', sortOrder: '' };

function sameFilters(a: OrderFilterValues, b: OrderFilterValues): boolean {
  return (Object.keys(EMPTY) as (keyof OrderFilterValues)[]).every((key) => a[key] === b[key]);
}

/**
 * Filtros do painel. Cada mudança válida é aplicada na hora; um período
 * inválido (fim antes do início) mostra o erro e não é aplicado.
 */
export function OrderFilters({ value, onApply }: OrderFiltersProps) {
  const [draft, setDraft] = useState<OrderFilterValues>(value);
  const [syncedValue, setSyncedValue] = useState(value);
  // A URL mudou por fora (voltar, limpar, link): o rascunho acompanha. Mudanças
  // aplicadas daqui já chegam iguais ao rascunho; um rascunho inválido não é perdido.
  if (!sameFilters(syncedValue, value)) {
    setSyncedValue(value);
    setDraft(value);
  }
  const errors = listOrdersInputErrors(draft);
  const sort = `${draft.sortBy || 'createdAt'}:${draft.sortOrder || 'desc'}`;
  const hasFilters = Object.values(value).some((field) => field !== '');

  const change = (patch: Partial<OrderFilterValues>): void => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (Object.keys(listOrdersInputErrors(next)).length === 0) onApply(next);
  };

  return (
    <form className={styles.filters} aria-label="Filtrar pedidos" onSubmit={(event) => event.preventDefault()}>
      <SelectField
        label="Status"
        options={STATUS_OPTIONS}
        value={draft.status}
        onChange={(event) => change({ status: event.target.value })}
        error={errors.status}
      />
      <TextField
        label="Criados de"
        type="date"
        value={draft.startDate}
        onChange={(event) => change({ startDate: event.target.value })}
        error={errors.startDate}
      />
      <TextField
        label="até"
        type="date"
        value={draft.endDate}
        min={draft.startDate || undefined}
        onChange={(event) => change({ endDate: event.target.value })}
        error={errors.endDate}
      />
      <SelectField
        label="Ordenar por"
        options={SORT_OPTIONS}
        value={sort}
        onChange={(event) => {
          const [sortBy = '', sortOrder = ''] = event.target.value.split(':');
          change({ sortBy, sortOrder });
        }}
      />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          disabled={!hasFilters}
          onClick={() => {
            setDraft(EMPTY);
            onApply(EMPTY);
          }}
        >
          Limpar filtros
        </Button>
      </div>
    </form>
  );
}
