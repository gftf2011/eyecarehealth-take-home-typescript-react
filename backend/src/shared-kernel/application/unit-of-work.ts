/**
 * Unidade de trabalho: delimita a transação de um caso de uso.
 *
 * Os repositórios só são obtidos **dentro** de `transaction`, já ligados à
 * transação corrente. Assim, todas as escritas de um caso de uso (agregados e
 * os eventos de domínio que vão para o outbox) são confirmadas juntas ou
 * descartadas juntas — nunca pela metade.
 *
 * Cada bounded context define o seu conjunto de repositórios, por exemplo
 * `UnitOfWork<{ products: ProductRepository }>`.
 */
export interface UnitOfWork<TRepositories> {
  /**
   * Executa `work` em uma transação.
   * - Resolveu: commit e devolve o resultado.
   * - Rejeitou: rollback e relança o mesmo erro.
   */
  transaction<TResult>(work: (repositories: TRepositories) => Promise<TResult>): Promise<TResult>;
}
