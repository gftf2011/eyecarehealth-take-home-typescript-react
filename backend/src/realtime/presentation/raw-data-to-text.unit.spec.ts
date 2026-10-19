import { describe, expect, it } from 'vitest';

import { rawDataToText } from './raw-data-to-text';

describe('rawDataToText', () => {
  it.each([
    ['Buffer', Buffer.from('{"type":"auth"}')],
    ['ArrayBuffer', new TextEncoder().encode('{"type":"auth"}').buffer],
    ['fragmentos', [Buffer.from('{"type":'), Buffer.from('"auth"}')]],
  ])('%s vira o texto da mensagem, sem vírgulas entre fragmentos', (_, data) => {
    expect(rawDataToText(data)).toBe('{"type":"auth"}');
  });
});
