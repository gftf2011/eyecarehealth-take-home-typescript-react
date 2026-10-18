/** Sessão emitida pela API no login ou na renovação. */
export type IssuedSession = {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: string;
  };
};

/**
 * Autenticação na API. O refresh token nunca passa por aqui: ele vai e volta
 * num cookie httpOnly que o navegador gerencia sozinho.
 */
export interface AuthGateway {
  login(credentials: { readonly email: string; readonly password: string }): Promise<IssuedSession>;

  /** Rotaciona o refresh token do cookie e emite um novo access token. */
  renew(): Promise<IssuedSession>;

  /** Revoga a sessão no servidor e apaga o cookie. */
  logout(): Promise<void>;
}
