/**
 * Exclusão mútua das renovações de sessão entre **todas as abas** do painel.
 *
 * A API rotaciona o refresh token e trata o reuso de um token já rotacionado
 * como roubo (revoga a sessão). Duas abas renovando ao mesmo tempo enviariam o
 * mesmo cookie: a segunda seria tomada por reuso e derrubaria as duas. Com a
 * trava, a segunda aba só renova depois da primeira, já com o cookie novo.
 */
export interface SessionRenewalLock {
  runExclusive<T>(task: () => Promise<T>): Promise<T>;
}
