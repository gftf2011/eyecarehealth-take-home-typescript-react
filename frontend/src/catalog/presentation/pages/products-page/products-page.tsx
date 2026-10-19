import { useState } from 'react';

import {
  Alert,
  Button,
  EmptyState,
  Pagination,
  Spinner,
  errorMessage,
  useCan,
} from '../../../../shared-kernel/presentation';
import type { ProductDto } from '../../../application';
import { ProductFilters } from '../../components/product-filters/product-filters';
import { ProductFormDialog } from '../../components/product-form-dialog/product-form-dialog';
import { ProductTable } from '../../components/product-table/product-table';
import { ProductTableSkeleton } from '../../components/product-table-skeleton/product-table-skeleton';
import { RemoveProductDialog } from '../../components/remove-product-dialog/remove-product-dialog';
import { useProductFilters } from '../../hooks/use-product-filters';
import { useProductLiveUpdates } from '../../hooks/use-product-live-updates';
import { useProducts } from '../../hooks/use-products';
import styles from './products-page.module.css';

/** Cardápio: busca e filtros na URL, tabela paginada, criar/editar em modal e exclusão confirmada. */
export function ProductsPage() {
  useProductLiveUpdates();
  const canWrite = useCan('products:write');
  const { filters, input, applyFilters, goToCursor } = useProductFilters();
  const products = useProducts(input);
  const page = products.data;
  const filtered = Object.values(filters).some((value) => value !== '');
  // Um link de página antigo (cursor) pode não valer mais: sempre há o caminho de volta ao início.
  const backToStart =
    input.cursor === '' ? undefined : (
      <Button variant="secondary" size="sm" onClick={() => goToCursor(null)}>
        Primeira página
      </Button>
    );

  const [editing, setEditing] = useState<ProductDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<ProductDto | null>(null);

  return (
    <section className={styles.page} aria-labelledby="products-title">
      <header className={styles.header}>
        <div>
          <h1 id="products-title" className={styles.title}>
            Produtos
          </h1>
          <p className={styles.subtitle}>Cardápio, preços e disponibilidade.</p>
        </div>
        <div className={styles.headerActions}>
          {products.isFetching && page !== undefined ? <Spinner size="sm" label="Atualizando produtos" /> : null}
          {canWrite ? <Button onClick={() => setEditing('new')}>Novo produto</Button> : null}
        </div>
      </header>

      <ProductFilters value={filters} onApply={applyFilters} />

      {products.isError ? (
        <Alert tone="error" title="Não foi possível carregar os produtos">
          <p>{errorMessage(products.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void products.refetch()}>
            Tentar novamente
          </Button>
          {backToStart}
        </Alert>
      ) : null}

      {products.isPending ? <ProductTableSkeleton /> : null}

      {page !== undefined && page.data.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nenhum produto encontrado' : 'O cardápio está vazio'}
          description={filtered ? 'Tente outra busca ou limpe os filtros.' : 'Cadastre o primeiro produto do cardápio.'}
          action={
            backToStart ??
            (canWrite && !filtered ? <Button onClick={() => setEditing('new')}>Novo produto</Button> : undefined)
          }
        />
      ) : null}

      {page !== undefined && page.data.length > 0 ? (
        <div className={styles.results} aria-busy={products.isFetching}>
          <ProductTable products={page.data} onEdit={setEditing} onRemove={setRemoving} />
          <Pagination
            pagination={page.pagination}
            count={page.data.length}
            onCursorChange={goToCursor}
            itemLabel="produtos"
          />
        </div>
      ) : null}

      <ProductFormDialog product={editing} onClose={() => setEditing(null)} />
      <RemoveProductDialog product={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}
