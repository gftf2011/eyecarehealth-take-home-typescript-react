import { NotFoundError } from '../../../../shared-kernel/domain';

export class UserNotFoundError extends NotFoundError {
  readonly code = 'USER_NOT_FOUND';

  constructor(userId: string) {
    super('Usuário não encontrado', [{ userId }]);
  }
}
