import type { ProductId } from '../../domain';

/**
 * Camada anticorrupção para o contexto Ordering: responde, na linguagem do
 * Catalog, se um produto está em pedidos ainda em aberto (`pending` ou
 * `preparing`). O Catalog não conhece pedidos, só esse fato.
 *
 * É obtido dentro da unit of work para que a checagem e a remoção ocorram na
 * mesma transação; a implementação deve travar o produto (ex.: `SELECT … FOR
 * UPDATE`) para impedir que um pedido o inclua entre a checagem e a remoção.
 */
export interface ActiveOrdersChecker {
  hasActiveOrdersFor(productId: ProductId): Promise<boolean>;
}
