import { describe, expect, it } from 'vitest';

import { InvalidPasswordError, Password } from '../..';

describe('Password', () => {
  it('exige a senha', () => {
    expect(() => Password.create('')).toThrow(new InvalidPasswordError('Informe a senha'));
  });

  it('não normaliza: espaços fazem parte da senha', () => {
    expect(Password.create(' Admin@123 ').value).toBe(' Admin@123 ');
  });

  it('não aplica política de força no login (quem confere é a API)', () => {
    expect(Password.create('1').value).toBe('1');
  });
});
