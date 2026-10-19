import { describe, expect, it } from 'vitest';

import { InvalidReturnReasonError } from '../errors';
import { ReturnReason } from './return-reason';

describe('ReturnReason', () => {
  it.each(['Moto', 'a'.repeat(200), '  Entregador sem contato  '])('aceita %j (sem espaços nas pontas)', (raw) => {
    expect(ReturnReason.create(raw).value).toBe(raw.trim());
  });

  it.each(['', '  ab ', 'a'.repeat(201)])('recusa %j no campo reason', (raw) => {
    expect(() => ReturnReason.create(raw)).toThrow(InvalidReturnReasonError);
    expect(() => ReturnReason.create(raw)).toThrow(expect.objectContaining({ field: 'reason' }));
  });
});
