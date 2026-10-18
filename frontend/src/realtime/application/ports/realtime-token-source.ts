/**
 * Access token da sessão para autenticar no gateway. Quem fornece é o
 * Identity (ligado em `main`); o Realtime só conhece este contrato.
 */
export interface RealtimeTokenSource {
  /** Token válido agora (renovado se estiver vencendo), ou `null` sem sessão. */
  current(): Promise<string | null>;
  /** O gateway recusou o token (`4401`): renova; `null` se a sessão acabou. */
  renew(): Promise<string | null>;
  /** Avisa quando o token muda: login, renovação (`string`) ou fim da sessão (`null`). */
  subscribe(listener: (token: string | null) => void): () => void;
}
