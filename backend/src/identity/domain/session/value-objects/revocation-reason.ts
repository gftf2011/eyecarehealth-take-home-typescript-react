/**
 * - `logout`: o usuário encerrou a sessão.
 * - `reuse-detected`: um refresh token já rotacionado foi reapresentado, sinal
 *   de token roubado; a sessão inteira é derrubada.
 */
export type RevocationReason = 'logout' | 'reuse-detected';
