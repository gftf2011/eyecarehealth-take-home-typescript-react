import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, TEST_APP_START, type TestApp } from '../../main/http/testing/build-test-app';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { REFRESH_TOKEN_COOKIE } from './cookies/refresh-token.cookie';

const ADMIN = { email: 'admin@fastmeals.com', password: 'Admin@123' };
const VIEWER = { email: 'viewer@fastmeals.com', password: 'Viewer@123' };

describe('API de autenticação (/api/auth) com JWT real', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp({ auth: 'jwt' });
  });

  beforeEach(async () => {
    testApp.clock.setTo(TEST_APP_START);
    await resetDatabase(testApp.identityDb);
    await testApp.givenUser(ADMIN.email, ADMIN.password, 'admin');
    await testApp.givenUser(VIEWER.email, VIEWER.password, 'viewer');
  });

  afterAll(async () => {
    await testApp.close();
  });

  function login(credentials: { email: string; password: string }, remoteAddress = '127.0.0.1') {
    return testApp.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: credentials,
      remoteAddress,
    });
  }

  function refreshCookie(response: { cookies: { name: string; value: string }[] }): string {
    const cookie = response.cookies.find((candidate) => candidate.name === REFRESH_TOKEN_COOKIE);
    if (cookie === undefined) throw new Error('cookie de refresh ausente');
    return cookie.value;
  }

  function listProducts(accessToken: string) {
    return testApp.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  }

  function refresh(cookie?: string) {
    return testApp.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      ...(cookie !== undefined && { cookies: { [REFRESH_TOKEN_COOKIE]: cookie } }),
    });
  }

  describe('POST /api/auth/login', () => {
    it('200: access token no corpo e refresh token só em cookie httpOnly', async () => {
      const response = await login(ADMIN);

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        accessToken: expect.any(String),
        accessTokenExpiresAt: '2025-02-01T12:15:00.000Z',
        user: { id: expect.any(String), email: ADMIN.email, role: 'admin' },
      });
      expect(body).not.toHaveProperty('refreshToken');

      const cookie = response.cookies.find((candidate) => candidate.name === REFRESH_TOKEN_COOKIE);
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/api/auth',
      });
      expect(cookie?.expires).toEqual(new Date('2025-02-08T12:00:00.000Z'));
    });

    it('401 INVALID_CREDENTIALS para senha errada', async () => {
      const response = await login({ ...ADMIN, password: 'errada' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos' },
      });
    });

    it('429 TOO_MANY_LOGIN_ATTEMPTS após 5 tentativas do mesmo email e IP', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await login({ ...ADMIN, password: 'errada' }, '203.0.113.9')).statusCode).toBe(401);
      }

      const blocked = await login(ADMIN, '203.0.113.9');

      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    });
  });

  describe('rotas protegidas', () => {
    it('aceitam o access token válido', async () => {
      const { accessToken } = (await login(VIEWER)).json();

      expect((await listProducts(accessToken)).statusCode).toBe(200);
    });

    it('401 INVALID_TOKEN para token inválido', async () => {
      const response = await listProducts('nao-e-um-jwt');

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('INVALID_TOKEN');
    });

    it('401 TOKEN_EXPIRED depois de 15 minutos', async () => {
      const { accessToken } = (await login(ADMIN)).json();
      testApp.clock.advanceBy(15 * 60_000 + 1_000);

      const response = await listProducts(accessToken);

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('TOKEN_EXPIRED');
    });

    it('403 FORBIDDEN quando o viewer tenta escrever', async () => {
      const { accessToken } = (await login(VIEWER)).json();

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: '/api/products/00000000-0000-4000-8000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('renova a sessão pelo cookie e rotaciona o refresh token', async () => {
      const loginResponse = await login(ADMIN);
      testApp.clock.advanceBy(60_000);

      const response = await refresh(refreshCookie(loginResponse));

      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).not.toBe(loginResponse.json().accessToken);
      expect(refreshCookie(response)).not.toBe(refreshCookie(loginResponse));
      expect((await listProducts(response.json().accessToken)).statusCode).toBe(200);
    });

    it('reuso de cookie antigo derruba a sessão inteira', async () => {
      const original = refreshCookie(await login(ADMIN));
      const rotated = refreshCookie(await refresh(original));

      const reuse = await refresh(original);
      const afterReuse = await refresh(rotated);

      expect(reuse.statusCode).toBe(401);
      expect(reuse.json().error.code).toBe('INVALID_REFRESH_TOKEN');
      expect(afterReuse.statusCode).toBe(401);
    });

    it('401 sem cookie', async () => {
      const response = await refresh();

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toEqual({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token inválido ou expirado',
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('204, remove o cookie e encerra a sessão', async () => {
      const cookie = refreshCookie(await login(ADMIN));

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: { [REFRESH_TOKEN_COOKIE]: cookie },
      });

      expect(response.statusCode).toBe(204);
      const cleared = response.cookies.find((candidate) => candidate.name === REFRESH_TOKEN_COOKIE);
      expect(cleared?.value).toBe('');
      expect((await refresh(cookie)).statusCode).toBe(401);
    });

    it('204 mesmo sem sessão (idempotente)', async () => {
      const response = await testApp.app.inject({ method: 'POST', url: '/api/auth/logout' });
      expect(response.statusCode).toBe(204);
    });
  });
});
