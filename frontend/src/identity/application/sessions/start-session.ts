import { Email, Role, Session } from '../../domain';
import type { IssuedSession } from '../ports/auth-gateway';

/** Converte a sessão emitida pela API no agregado, validando o que veio. */
export function startSession(issued: IssuedSession): Session {
  return Session.start({
    userId: issued.user.id,
    email: Email.create(issued.user.email),
    role: Role.create(issued.user.role),
    accessToken: issued.accessToken,
    accessTokenExpiresAt: issued.accessTokenExpiresAt,
  });
}
