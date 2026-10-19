import { z } from 'zod';

import { isoDateTime, uuid } from '../../../shared-kernel/presentation';
import { ROLES } from '../../domain';
import { REFRESH_TOKEN_COOKIE } from '../cookies/refresh-token.cookie';

export const loginBodySchema = z.object({
  email: z.string().meta({ format: 'email', examples: ['admin@fastmeals.com'] }),
  password: z.string().meta({ format: 'password', examples: ['Admin@123'] }),
});

/** O refresh token só circula no cookie `httpOnly` (o JavaScript do painel nunca o vê). */
export const refreshCookieSchema = z.object({
  [REFRESH_TOKEN_COOKIE]: z.string().meta({
    description: 'Refresh token rotativo, definido pelo login (`HttpOnly; SameSite=Strict; Path=/api/auth`)',
  }),
});

/** Corpo de login e renovação; o refresh token novo vai no `Set-Cookie`. */
export const sessionSchema = z.strictObject({
  accessToken: z.string().meta({ description: 'JWT para `Authorization: Bearer` (15 min)' }),
  accessTokenExpiresAt: isoDateTime,
  user: z.strictObject({
    id: uuid,
    email: z.string().meta({ format: 'email' }),
    role: z.enum(ROLES),
  }),
});
