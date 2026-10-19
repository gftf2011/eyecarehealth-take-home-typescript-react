/**
 * Marca a navegação feita logo depois do login (estado do roteador). Se a
 * página lembrada não for permitida para quem entrou (outra pessoa usou o
 * mesmo navegador), o guard de permissão manda para a tela inicial do perfil
 * em vez de mostrar "Acesso negado".
 */
const AFTER_LOGIN_KEY = 'fastmeals.afterLogin';

export function afterLoginState(): Readonly<Record<string, true>> {
  return { [AFTER_LOGIN_KEY]: true };
}

export function cameFromLogin(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[AFTER_LOGIN_KEY] === true;
}
