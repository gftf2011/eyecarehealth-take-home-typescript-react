import type { Clock } from '../../shared-kernel/application';
import type { TokenAuthenticator } from '../../shared-kernel/presentation';
import { JoseAccessTokenService } from '../infra/security/jose-access-token.service';
import { AccessTokenAuthenticator } from '../presentation/auth/access-token.authenticator';

/**
 * Só a verificação de access tokens, sem banco: para processos que autenticam
 * usuários mas não fazem login (ex.: o gateway de tempo real). Usa o mesmo
 * segredo e as mesmas regras (emissor, audiência, expiração) da API.
 */
export function makeTokenAuthenticator(accessTokenSecret: string, clock: Clock): TokenAuthenticator {
  return new AccessTokenAuthenticator(new JoseAccessTokenService(accessTokenSecret, clock));
}
