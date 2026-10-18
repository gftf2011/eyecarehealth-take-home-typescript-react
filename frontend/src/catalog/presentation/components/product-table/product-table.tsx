import { Alert, Button, Switch, errorMessage, formatCents, useCan } from '../../../../shared-kernel/presentation';
import type { ProductDto } from '../../../application';
import { useSetProductAvailability } from '../../hooks/use-set-product-availability';
import { CATEGORY_LABELS } from '../../labels/product-labels';
import styles from './product-table.module.css';

export type ProductTableProps = {
  readonly products: readonly ProductDto[];
  readonly onEdit: (product: ProductDto) => void;
  readonly onRemove: (product: ProductDto) => void;
};

/**
 * Tabela do cardápio. A disponibilidade alterna direto na linha (atualização
 * otimista); editar e excluir só aparecem para quem tem `products:write`.
 */
export function ProductTable({ products, onEdit, onRemove }: ProductTableProps) {
  const canWrite = useCan('products:write');
  const availability = useSetProductAvailability();

  return (
    <div className={styles.wrapper}>
      {availability.error === null ? null : (
        <Alert tone="error" title="Não foi possível alterar a disponibilidade">
          {errorMessage(availability.error)}
        </Alert>
      )}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="visually-hidden">Produtos do cardápio</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Categoria</th>
              <th scope="col" className={styles.numeric}>
                Preço
              </th>
              <th scope="col" className={styles.numeric}>
                Preparo
              </th>
              <th scope="col">Disponível</th>
              {canWrite ? (
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className={product.isAvailable ? undefined : styles.unavailable}>
                <th scope="row" className={styles.product}>
                  {product.imageUrl === null ? (
                    <span className={styles.placeholder} aria-hidden="true">
                      {product.name.charAt(0)}
                    </span>
                  ) : (
                    <img className={styles.thumb} src={product.imageUrl} alt="" loading="lazy" />
                  )}
                  <span className={styles.text}>
                    <span className={styles.name}>{product.name}</span>
                    <span className={styles.description}>{product.description}</span>
                  </span>
                </th>
                <td>{CATEGORY_LABELS[product.category]}</td>
                <td className={styles.numeric}>{formatCents(product.priceCents)}</td>
                <td className={styles.numeric}>{product.preparationTime} min</td>
                <td>
                  {canWrite ? (
                    <Switch
                      checked={product.isAvailable}
                      label={`Disponível: ${product.name}`}
                      onChange={(isAvailable) => availability.mutate({ id: product.id, isAvailable })}
                    />
                  ) : (
                    <span>{product.isAvailable ? 'Sim' : 'Não'}</span>
                  )}
                </td>
                {canWrite ? (
                  <td>
                    <div className={styles.actions}>
                      <Button variant="secondary" size="sm" onClick={() => onEdit(product)} aria-label={`Editar ${product.name}`}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onRemove(product)} aria-label={`Excluir ${product.name}`}>
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
