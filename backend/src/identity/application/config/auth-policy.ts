/** Parâmetros de segurança da autenticação (vêm do ambiente no composition root). */
export type AuthPolicy = {
  /** Enunciado: 15 minutos. */
  readonly accessTokenTtlMs: number;
  /** Enunciado: 7 dias. A janela desliza a cada renovação. */
  readonly refreshTokenTtlMs: number;
  /** Proteção contra força bruta: tentativas por par (email, IP) por janela. */
  readonly loginAttempts: {
    readonly max: number;
    readonly windowMs: number;
  };
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  accessTokenTtlMs: 15 * MINUTE_MS,
  refreshTokenTtlMs: 7 * DAY_MS,
  loginAttempts: { max: 5, windowMs: MINUTE_MS },
};
