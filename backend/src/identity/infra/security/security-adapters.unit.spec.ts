import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';

import { InvalidTokenError, TokenExpiredError } from '../../../shared-kernel/application';
import { FixedClock } from '../../../shared-kernel/application/testing/fixed-clock';
import { InvalidRefreshTokenError, RefreshSessionId, UserId } from '../../domain';
import { BcryptPasswordHasher } from './bcrypt-password.hasher';
import { JoseAccessTokenService } from './jose-access-token.service';
import { JoseRefreshTokenService } from './jose-refresh-token.service';
import { Sha256TokenHasher } from './sha256-token.hasher';

const ACCESS_SECRET = 'access-secret-with-at-least-32-characters!!';
const REFRESH_SECRET = 'refresh-secret-with-at-least-32-characters!';
const NOW = new Date('2025-03-01T10:00:00Z');
const IN_15_MIN = new Date(NOW.getTime() + 15 * 60_000);
const USER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher(10);

  it('gera hash bcrypt com custo 10 e verifica a senha', async () => {
    const hash = await hasher.hash('Admin@123');

    expect(hash.cost).toBe(10);
    expect(hash.value).toMatch(/^\$2b\$10\$/);
    await expect(hasher.verify('Admin@123', hash)).resolves.toBe(true);
    await expect(hasher.verify('admin@123', hash)).resolves.toBe(false);
  });

  it('usa salt aleatório: mesma senha, hashes diferentes', async () => {
    const [first, second] = await Promise.all([hasher.hash('Admin@123'), hasher.hash('Admin@123')]);
    expect(first.value).not.toBe(second.value);
  });

  it('recusa custo abaixo de 10', () => {
    expect(() => new BcryptPasswordHasher(9)).toThrow(RangeError);
  });
});

describe('JoseAccessTokenService', () => {
  const clock = new FixedClock(NOW);
  const service = new JoseAccessTokenService(ACCESS_SECRET, clock);

  it('emite e verifica o access token com papel e expiração', async () => {
    const token = await service.issue({ userId: USER_ID, role: 'viewer' }, NOW, IN_15_MIN);

    await expect(service.verify(token)).resolves.toEqual({
      userId: USER_ID,
      role: 'viewer',
      expiresAt: IN_15_MIN,
    });
    expect(decodeJwt(token)).toMatchObject({ sub: USER_ID, role: 'viewer', exp: IN_15_MIN.getTime() / 1000 });
  });

  it('token vencido → TOKEN_EXPIRED', async () => {
    const token = await service.issue({ userId: USER_ID, role: 'admin' }, NOW, IN_15_MIN);
    const later = new JoseAccessTokenService(ACCESS_SECRET, new FixedClock(new Date(IN_15_MIN.getTime() + 1000)));

    await expect(later.verify(token)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it.each([
    ['assinado com outro segredo', async () =>
      new JoseAccessTokenService('another-secret-with-at-least-32-characters', clock).issue(
        { userId: USER_ID, role: 'admin' },
        NOW,
        IN_15_MIN,
      )],
    ['adulterado', async () => {
      const token = await service.issue({ userId: USER_ID, role: 'viewer' }, NOW, IN_15_MIN);
      const [header, , signature] = token.split('.');
      const forged = Buffer.from(JSON.stringify({ sub: USER_ID, role: 'admin', exp: 9e9 })).toString('base64url');
      return `${header}.${forged}.${signature}`;
    }],
    ['refresh token usado como access token', async () =>
      new JoseRefreshTokenService(REFRESH_SECRET, clock).issue(
        { sessionId: RefreshSessionId.generate(), userId: UserId.from(USER_ID) },
        NOW,
        IN_15_MIN,
      )],
    ['lixo', async () => 'nao.e.jwt'],
  ])('%s → INVALID_TOKEN', async (_case, makeToken) => {
    await expect(service.verify(await makeToken())).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe('JoseRefreshTokenService', () => {
  const clock = new FixedClock(NOW);
  const service = new JoseRefreshTokenService(REFRESH_SECRET, clock);
  const claims = { sessionId: RefreshSessionId.generate(), userId: UserId.from(USER_ID) };

  it('emite e lê o ID da sessão; cada emissão é única', async () => {
    const first = await service.issue(claims, NOW, IN_15_MIN);
    const second = await service.issue(claims, NOW, IN_15_MIN);

    expect(first).not.toBe(second);
    const read = await service.verify(first);
    expect(read.sessionId.equals(claims.sessionId)).toBe(true);
    expect(read.userId.value).toBe(USER_ID);
  });

  it('vencido → INVALID_REFRESH_TOKEN (expired)', async () => {
    const token = await service.issue(claims, NOW, IN_15_MIN);
    const later = new JoseRefreshTokenService(REFRESH_SECRET, new FixedClock(new Date(IN_15_MIN.getTime() + 1000)));

    await expect(later.verify(token)).rejects.toMatchObject({ reason: 'expired' });
  });

  it('access token usado como refresh → INVALID_REFRESH_TOKEN (invalid)', async () => {
    const accessToken = await new JoseAccessTokenService(ACCESS_SECRET, clock).issue(
      { userId: USER_ID, role: 'admin' },
      NOW,
      IN_15_MIN,
    );

    await expect(service.verify(accessToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});

describe('Sha256TokenHasher', () => {
  it('é determinístico e sensível ao conteúdo', () => {
    const hasher = new Sha256TokenHasher();
    expect(hasher.hash('abc').equals(hasher.hash('abc'))).toBe(true);
    expect(hasher.hash('abc').equals(hasher.hash('abd'))).toBe(false);
    expect(hasher.hash('abc').value).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
