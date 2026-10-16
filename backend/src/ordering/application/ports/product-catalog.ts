import type { ProductId, ProductSnapshot } from '../../domain';

/**
 * Camada anticorrupção para o contexto Catalog: devolve, na linguagem do
 * Ordering, a visão dos produtos no instante do pedido (nome, preço vigente e
 * disponibilidade). O Ordering não conhece o agregado Product, só esse fato.
 *
 * É obtido dentro da unit of work para que a leitura dos preços e a gravação
 * do pedido ocorram na mesma transação; a implementação deve travar os
 * produtos em modo compartilhado (ex.: `SELECT … FOR SHARE`), o que impede a
 * remoção concorrente (que usa `FOR UPDATE`) sem bloquear outros pedidos.
 */
export interface ProductCatalog {
  /**
   * Snapshots dos produtos existentes e não removidos entre `ids`. IDs
   * desconhecidos ou removidos simplesmente não aparecem no resultado.
   */
  snapshotsOf(ids: readonly ProductId[]): Promise<readonly ProductSnapshot[]>;
}
