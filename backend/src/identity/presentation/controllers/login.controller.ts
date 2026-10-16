import { z } from 'zod';

import type { UseCase } from '../../../shared-kernel/application';
import {
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { AuthTokensDto } from '../../application/dtos/auth-tokens.dto';
import type { LoginInput } from '../../application/usecases/login/login.usecase';
import type { RefreshTokenCookie } from '../cookies/refresh-token.cookie';
import { sessionResponse } from './session-response';

const bodySchema = z.object({
  email: z.string(),
  password: z.string(),
});

/** POST /api/auth/login */
export class LoginController implements Controller {
  constructor(
    private readonly login: UseCase<LoginInput, AuthTokensDto>,
    private readonly cookie: RefreshTokenCookie,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { email, password } = parseRequest(bodySchema, request.body, 'body');
    const tokens = await this.login.execute({ email, password, ipAddress: request.ip });
    return sessionResponse(tokens, this.cookie);
  }
}
