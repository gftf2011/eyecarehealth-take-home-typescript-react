import { describe, expect, it } from 'vitest';

import { InvalidPreparationTimeError, PreparationTime } from '../../index.js';

describe('PreparationTime', () => {
  it.each([1, 25, 120])('aceita %d minutos', (minutes) => {
    expect(PreparationTime.ofMinutes(minutes).minutes).toBe(minutes);
  });

  it.each([0, 121, 2.5, -1])('rejeita %d', (minutes) => {
    expect(() => PreparationTime.ofMinutes(minutes)).toThrow(InvalidPreparationTimeError);
  });
});
