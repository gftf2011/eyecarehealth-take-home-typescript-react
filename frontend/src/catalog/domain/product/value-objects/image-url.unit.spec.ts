import { describe, expect, it } from 'vitest';

import { ImageUrl, InvalidImageUrlError } from '../..';

describe('ImageUrl', () => {
  it.each(['https://example.com/burger.jpg', 'http://cdn.local/a.png?w=400'])('aceita %s', (raw) => {
    expect(ImageUrl.create(raw).value).toBe(raw);
  });

  it.each([
    'not a url',
    'ftp://example.com/a.png',
    'javascript:alert(1)',
    `https://e.com/${'a'.repeat(500)}`,
  ])('rejeita %s', (raw) => {
    expect(() => ImageUrl.create(raw)).toThrow(InvalidImageUrlError);
  });
});
