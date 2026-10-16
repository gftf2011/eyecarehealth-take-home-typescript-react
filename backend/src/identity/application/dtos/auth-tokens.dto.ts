import type { RoleValue, User } from '../../domain';

export type AuthenticatedUserDto = {
  readonly id: string;
  readonly email: string;
  readonly role: RoleValue;
};

/**
 * Resultado de login/renovação. O refresh token sai do caso de uso, mas a
 * camada HTTP o entrega só em cookie httpOnly — nunca no corpo da resposta.
 */
export type AuthTokensDto = {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly user: AuthenticatedUserDto;
};

export function toAuthenticatedUserDto(user: User): AuthenticatedUserDto {
  return { id: user.id.value, email: user.email.value, role: user.role.value };
}
