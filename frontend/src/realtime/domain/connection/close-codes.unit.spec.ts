import { describe, expect, it } from 'vitest';

import { CLOSE_CODES, reactionTo, type CloseReaction } from '..';

describe('reactionTo', () => {
  it.each<[string, number, CloseReaction]>([
    ['token inválido ou vencido', CLOSE_CODES.unauthorized, 'renew-and-reconnect'],
    ['sem permissão', CLOSE_CODES.forbidden, 'give-up'],
    ['mensagem fora do protocolo', CLOSE_CODES.invalidMessage, 'give-up'],
    ['servidor reiniciando', CLOSE_CODES.serviceRestart, 'reconnect'],
    ['cliente lento', CLOSE_CODES.tryAgainLater, 'reconnect'],
    ['erro interno', CLOSE_CODES.internalError, 'reconnect'],
    ['queda de rede', CLOSE_CODES.abnormal, 'reconnect'],
    ['código desconhecido', 4999, 'reconnect'],
  ])('%s (%i) → %s', (_, code, reaction) => {
    expect(reactionTo(code)).toBe(reaction);
  });
});
