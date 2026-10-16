import type { UseCase } from '../../../shared-kernel/application';
import type { Controller, HttpRequest, HttpResponse } from '../../../shared-kernel/presentation';
import type { LogoutInput } from '../../application/usecases/logout/logout.usecase';
import type { RefreshTokenCookie } from '../cookies/refresh-token.cookie';

/** POST /api/auth/logout — revoga a sessão e remove o cookie. */
export class LogoutController implements Controller {
  constructor(
    private readonly logout: UseCase<LogoutInput, void>,
    private readonly cookie: RefreshTokenCookie,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    await this.logout.execute({ refreshToken: this.cookie.read(request) });
    return { status: 204, cookies: [this.cookie.clear()] };
  }
}
