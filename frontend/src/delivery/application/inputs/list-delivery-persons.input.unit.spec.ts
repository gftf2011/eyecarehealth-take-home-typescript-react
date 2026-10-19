import { describe, expect, it } from 'vitest';

import { listDeliveryPersonsInputErrors, parseListDeliveryPersonsInput } from './list-delivery-persons.input';

describe('Filtros da lista de entregadores', () => {
  it('vazio = todos', () => {
    expect(parseListDeliveryPersonsInput({ isActive: '', available: undefined })).toEqual({
      isActive: null,
      available: null,
    });
  });

  it('converte true/false da URL', () => {
    expect(parseListDeliveryPersonsInput({ isActive: 'true', available: 'false' })).toEqual({
      isActive: true,
      available: false,
    });
  });

  it('valor fora do contrato vira erro no campo', () => {
    expect(listDeliveryPersonsInputErrors({ isActive: 'sim', available: 'talvez' })).toEqual({
      isActive: 'A ativação deve ser true ou false',
      available: 'A disponibilidade deve ser true ou false',
    });
  });
});
