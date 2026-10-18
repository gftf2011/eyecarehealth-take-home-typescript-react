/**
 * Fonte do access token das requisições autenticadas. O cliente HTTP só
 * conhece este contrato; quem o implementa (o contexto Identity) decide como
 * renovar a sessão.
 */
export interface AccessTokenProvider {
  /** Token válido para a próxima requisição (renovado se estiver vencendo), ou `null` sem sessão. */
  currentToken(): Promise<string | null>;

  /**
   * A API recusou `rejectedToken` com `401`. Devolve um token novo para uma
   * única nova tentativa, ou `null` se a sessão acabou.
   */
  tokenRejected(rejectedToken: string): Promise<string | null>;
}
