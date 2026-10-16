import type { PasswordHash } from '../../domain';

/**
 * Gera e verifica hashes de senha. A senha em texto puro só existe aqui e na
 * entrada do caso de uso; o domínio só conhece o `PasswordHash`.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<PasswordHash>;
  verify(plainPassword: string, hash: PasswordHash): Promise<boolean>;
}
