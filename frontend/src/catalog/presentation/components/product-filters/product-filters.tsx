import { useEffect, useEffectEvent, useState } from 'react';

import { Button, SelectField, TextField, useDebouncedValue } from '../../../../shared-kernel/presentation';
import { listProductsInputErrors } from '../../../application';
import { PRODUCT_CATEGORIES } from '../../../domain';
import type { ProductFilterValues } from '../../hooks/use-product-filters';
import { CATEGORY_LABELS, PRODUCT_SORT_OPTIONS } from '../../labels/product-labels';
import styles from './product-filters.module.css';

const SEARCH_DELAY_MS = 300;

const EMPTY: ProductFilterValues = { search: '', category: '', isAvailable: '', sortBy: '', sortOrder: '' };

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas as categorias' },
  ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Disponíveis' },
  { value: 'false', label: 'Indisponíveis' },
];

function sameFilters(a: ProductFilterValues, b: ProductFilterValues): boolean {
  return (Object.keys(EMPTY) as (keyof ProductFilterValues)[]).every((key) => a[key] === b[key]);
}

/**
 * Busca por nome (aplicada quando a pessoa para de digitar) e filtros
 * aplicados na hora. Valores inválidos mostram o erro e não são aplicados.
 */
export function ProductFilters({
  value,
  onApply,
}: {
  readonly value: ProductFilterValues;
  readonly onApply: (filters: ProductFilterValues) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (!sameFilters(synced, value)) {
    setSynced(value);
    setDraft(value);
  }

  const errors = listProductsInputErrors(draft);
  const debouncedSearch = useDebouncedValue(draft.search, SEARCH_DELAY_MS);

  const apply = (next: ProductFilterValues): void => {
    if (Object.keys(listProductsInputErrors(next)).length === 0 && !sameFilters(next, value)) onApply(next);
  };

  // Só a busca digitada dispara daqui (os outros filtros aplicam no próprio
  // onChange); o evento lê `value` e `apply` atuais sem virar dependência.
  const applySearch = useEffectEvent((search: string) => apply({ ...value, search }));
  useEffect(() => {
    applySearch(debouncedSearch);
  }, [debouncedSearch]);

  const change = (patch: Partial<ProductFilterValues>): void => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (patch.search === undefined) apply(next);
  };

  const sort = `${draft.sortBy || 'createdAt'}:${draft.sortOrder || 'desc'}`;

  return (
    <form className={styles.filters} role="search" aria-label="Buscar produtos" onSubmit={(event) => event.preventDefault()}>
      <TextField
        label="Buscar por nome"
        type="search"
        placeholder="Ex.: burger"
        value={draft.search}
        onChange={(event) => change({ search: event.target.value })}
        error={errors.search}
      />
      <SelectField
        label="Categoria"
        options={CATEGORY_OPTIONS}
        value={draft.category}
        onChange={(event) => change({ category: event.target.value })}
      />
      <SelectField
        label="Disponibilidade"
        options={AVAILABILITY_OPTIONS}
        value={draft.isAvailable}
        onChange={(event) => change({ isAvailable: event.target.value })}
      />
      <SelectField
        label="Ordenar por"
        options={PRODUCT_SORT_OPTIONS}
        value={sort}
        onChange={(event) => {
          const [sortBy = '', sortOrder = ''] = event.target.value.split(':');
          change({ sortBy, sortOrder });
        }}
      />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          disabled={Object.values(value).every((field) => field === '') && sameFilters(draft, EMPTY)}
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
