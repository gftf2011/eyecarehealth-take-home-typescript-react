import type { HttpResponse } from '../../../shared-kernel/presentation';
import type { AuthTokensDto } from '../../application/dtos/auth-tokens.dto';
import type { RefreshTokenCookie } from '../cookies/refresh-token.cookie';

/**
 * Resposta de login/renovação: access token no corpo (o frontend o mantém só
 * em memória) e refresh token apenas no cookie httpOnly.
 */
export function sessionResponse(tokens: AuthTokensDto, cookie: RefreshTokenCookie): HttpResponse {
  return {
    status: 200,
    body: {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      user: tokens.user,
    },
    cookies: [cookie.set(tokens.refreshToken, tokens.refreshTokenExpiresAt)],
  };
}
