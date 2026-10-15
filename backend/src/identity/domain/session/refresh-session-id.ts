import { UniqueId } from '../../../shared-kernel/domain/index';

export class RefreshSessionId extends UniqueId {
  declare private readonly brand: 'RefreshSessionId';

  static generate(): RefreshSessionId {
    return new RefreshSessionId(UniqueId.newUuid());
  }

  static from(raw: string): RefreshSessionId {
    return new RefreshSessionId(raw, 'sessionId');
  }
}
