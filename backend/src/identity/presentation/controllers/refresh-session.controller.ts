import type { UseCase } from '../../../shared-kernel/application';
import type { Controller, HttpRequest, HttpResponse } from '../../../shared-kernel/presentation';
import type { AuthTokensDto } from '../../application/dtos/auth-tokens.dto';
import type { RefreshSessionInput } from '../../application/usecases/refresh-session/refresh-session.usecase';
import type { RefreshTokenCookie } from '../cookies/refresh-token.cookie';
import { sessionResponse } from './session-response';

/** POST /api/auth/refresh — lê o refresh token do cookie e o rotaciona. */
export class RefreshSessionController implements Controller {
  constructor(
    private readonly refreshSession: UseCase<RefreshSessionInput, AuthTokensDto>,
    private readonly cookie: RefreshTokenCookie,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const tokens = await this.refreshSession.execute({ refreshToken: this.cookie.read(request) });
    return sessionResponse(tokens, this.cookie);
  }
}
