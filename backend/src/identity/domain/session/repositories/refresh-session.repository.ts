import type { Repository } from '../../../../shared-kernel/domain/index';
import type { RefreshSession } from '../refresh-session';

/**
 * Repositório do agregado RefreshSession. A sessão é localizada pelo ID que
 * viaja no próprio refresh token (claim `sid`); o hash do token é comparado
 * dentro do agregado.
 */
export interface RefreshSessionRepository extends Repository<RefreshSession> {}
