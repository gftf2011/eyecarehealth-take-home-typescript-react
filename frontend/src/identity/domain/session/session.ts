import type { Permission } from '../../../shared-kernel/domain';
import { InvalidSessionError } from './errors';
import type { Email } from './value-objects/email';
import type { Role } from './value-objects/role';

export type SessionProps = {
  readonly userId: string;
  readonly email: Email;
  readonly role: Role;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
};

/**
 * Sessão do usuário no painel. O access token vive só em memória (nunca em
 * `localStorage`): ao recarregar a página, a sessão é restaurada pelo refresh
 * token, que fica num cookie httpOnly fora do alcance do JavaScript.
 */
export class Session {
  private constructor(private readonly props: SessionProps) {}

  static start(props: SessionProps): Session {
    if (props.userId.trim() === '') throw new InvalidSessionError('userId', 'Usuário sem identificador');
    if (props.accessToken.trim() === '') {
      throw new InvalidSessionError('accessToken', 'Access token vazio');
    }
    if (Number.isNaN(props.accessTokenExpiresAt.getTime())) {
      throw new InvalidSessionError('accessTokenExpiresAt', 'Expiração inválida');
    }
    return new Session({ ...props, accessTokenExpiresAt: new Date(props.accessTokenExpiresAt) });
  }

  get userId(): string {
    return this.props.userId;
  }

  get email(): Email {
    return this.props.email;
  }

  get role(): Role {
    return this.props.role;
  }

  get accessToken(): string {
    return this.props.accessToken;
  }

  get accessTokenExpiresAt(): Date {
    return new Date(this.props.accessTokenExpiresAt);
  }

  can(permission: Permission): boolean {
    return this.props.role.can(permission);
  }

  /**
   * O token vence em até `marginMs`: vale renová-lo antes de usar, para a
   * requisição não chegar à API já expirada.
   */
  isExpiringWithin(marginMs: number, now: Date): boolean {
    return this.props.accessTokenExpiresAt.getTime() - now.getTime() <= marginMs;
  }
}
