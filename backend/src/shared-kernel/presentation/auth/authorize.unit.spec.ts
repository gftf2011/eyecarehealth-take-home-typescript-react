import { describe, expect, it } from 'vitest';

import { ForbiddenError, InvalidTokenError, TokenExpiredError } from '../errors/http-errors';
import {
  ADMIN_TOKEN,
  EXPIRED_TOKEN,
  StaticAuthenticator,
  VIEWER_TOKEN,
} from '../testing/static-authenticator';
import { ANONYMOUS_USER } from './authenticated-user';
import { authorize } from './authorize';

const authenticator = new StaticAuthenticator();

describe('authorize', () => {
  it('rota pública não exige token', async () => {
    await expect(authorize(authenticator, undefined, null)).resolves.toBe(ANONYMOUS_USER);
  });

  it('libera quando o usuário tem a permissão', async () => {
    const user = await authorize(authenticator, `Bearer ${VIEWER_TOKEN}`, 'products:read');
    expect(user.role).toBe('viewer');
  });

  it('viewer não escreve: 403 FORBIDDEN', async () => {
    await expect(
      authorize(authenticator, `Bearer ${VIEWER_TOKEN}`, 'products:write'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('admin tem acesso total', async () => {
    await expect(
      authorize(authenticator, `Bearer ${ADMIN_TOKEN}`, 'delivery-persons:write'),
    ).resolves.toMatchObject({ role: 'admin' });
  });

  it.each([
    [undefined, InvalidTokenError],
    ['Bearer desconhecido', InvalidTokenError],
    [ADMIN_TOKEN, InvalidTokenError],
    [`Bearer ${EXPIRED_TOKEN}`, TokenExpiredError],
  ])('header %j → %o (401)', async (header, errorType) => {
    await expect(authorize(authenticator, header, 'products:read')).rejects.toBeInstanceOf(errorType);
  });
});
