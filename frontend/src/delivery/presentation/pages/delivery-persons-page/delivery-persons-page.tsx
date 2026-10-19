import { useState } from 'react';

import { Alert, Button, EmptyState, Spinner, errorMessage, useCan } from '../../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../../application';
import { DeliveryPersonFilters } from '../../components/delivery-person-filters/delivery-person-filters';
import { DeliveryPersonFormDialog } from '../../components/delivery-person-form-dialog/delivery-person-form-dialog';
import { DeliveryPersonTable } from '../../components/delivery-person-table/delivery-person-table';
import { DeliveryPersonTableSkeleton } from '../../components/delivery-person-table-skeleton/delivery-person-table-skeleton';
import { RemoveDeliveryPersonDialog } from '../../components/remove-delivery-person-dialog/remove-delivery-person-dialog';
import { useDeliveryPersonFilters } from '../../hooks/use-delivery-person-filters';
import { useDeliveryPersonLiveUpdates } from '../../hooks/use-delivery-person-live-updates';
import { useDeliveryPersons } from '../../hooks/use-delivery-persons';
import styles from './delivery-persons-page.module.css';

/** Frota: filtros na URL, tabela, cadastrar/editar em modal e exclusão confirmada. */
export function DeliveryPersonsPage() {
  useDeliveryPersonLiveUpdates();
  const canWrite = useCan('delivery-persons:write');
  const { filters, input, applyFilters } = useDeliveryPersonFilters();
  const persons = useDeliveryPersons(input);
  const list = persons.data;
  const filtered = filters.isActive !== '' || filters.available !== '';

  const [editing, setEditing] = useState<DeliveryPersonDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<DeliveryPersonDto | null>(null);

  return (
    <section className={styles.page} aria-labelledby="delivery-persons-title">
      <header className={styles.header}>
        <div>
          <h1 id="delivery-persons-title" className={styles.title}>
            Entregadores
          </h1>
          <p className={styles.subtitle}>Frota, veículos, localização e quem está em entrega.</p>
        </div>
        <div className={styles.headerActions}>
          {persons.isFetching && list !== undefined ? <Spinner size="sm" label="Atualizando entregadores" /> : null}
          {canWrite ? <Button onClick={() => setEditing('new')}>Novo entregador</Button> : null}
        </div>
      </header>

      <DeliveryPersonFilters value={filters} onApply={applyFilters} />

      {persons.isError ? (
        <Alert tone="error" title="Não foi possível carregar os entregadores">
          <p>{errorMessage(persons.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void persons.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      {persons.isPending ? <DeliveryPersonTableSkeleton /> : null}

      {list !== undefined && list.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nenhum entregador encontrado' : 'Nenhum entregador cadastrado'}
          description={filtered ? 'Tente outro filtro ou limpe os filtros.' : 'Cadastre o primeiro entregador da frota.'}
          action={
            canWrite && !filtered ? <Button onClick={() => setEditing('new')}>Novo entregador</Button> : undefined
          }
        />
      ) : null}

      {list !== undefined && list.length > 0 ? (
        <div className={styles.results} aria-busy={persons.isFetching}>
          <DeliveryPersonTable persons={list} onEdit={setEditing} onRemove={setRemoving} />
        </div>
      ) : null}

      <DeliveryPersonFormDialog person={editing} onClose={() => setEditing(null)} />
      <RemoveDeliveryPersonDialog person={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}
