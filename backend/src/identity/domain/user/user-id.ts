import { UniqueId } from '../../../shared-kernel/domain/index';

export class UserId extends UniqueId {
  declare private readonly brand: 'UserId';

  static generate(): UserId {
    return new UserId(UniqueId.newUuid());
  }

  static from(raw: string): UserId {
    return new UserId(raw, 'userId');
  }
}
