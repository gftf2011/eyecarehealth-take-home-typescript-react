import { describe, expect, it } from 'vitest';

import { RecentEventIds } from '..';

describe('RecentEventIds', () => {
  it('reconhece um evento repetido', () => {
    const recent = new RecentEventIds();

    expect(recent.remember('evt-1')).toBe(true);
    expect(recent.remember('evt-1')).toBe(false);
    expect(recent.remember('evt-2')).toBe(true);
  });

  it('esquece os mais antigos quando passa do limite', () => {
    const recent = new RecentEventIds(2);
    recent.remember('a');
    recent.remember('b');
    recent.remember('c');

    expect(recent.remember('a')).toBe(true);
    expect(recent.remember('c')).toBe(false);
  });
});
