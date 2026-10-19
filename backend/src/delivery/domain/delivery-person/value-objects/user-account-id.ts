import { UniqueId } from '../../../../shared-kernel/domain';

/**
 * Usuário (do Identity) com que o entregador entra no sistema. O Delivery só
 * guarda o id: quem é o usuário e o que ele pode fazer é do Identity.
 */
export class UserAccountId extends UniqueId {
  declare private readonly brand: 'UserAccountId';

  static from(raw: string): UserAccountId {
    return new UserAccountId(raw, 'userId');
  }
}
