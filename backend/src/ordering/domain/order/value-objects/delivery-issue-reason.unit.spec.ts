import { describe, expect, it } from 'vitest';

import { InvalidDeliveryIssueNoteError, InvalidDeliveryIssueReasonError } from '../errors';
import { DeliveryIssueNote } from './delivery-issue-note';
import { DeliveryIssueReason } from './delivery-issue-reason';

describe('DeliveryIssueReason', () => {
  it.each([
    ['customer_absent', 'cliente ausente', false],
    ['address_not_found', 'endereço não encontrado', false],
    ['refused', 'cliente recusou', false],
    ['other', 'outro motivo', true],
  ])('aceita %s ("%s"; exige observação? %s)', (raw, description, requiresNote) => {
    const reason = DeliveryIssueReason.create(raw);

    expect(reason.description).toBe(description);
    expect(reason.requiresNote).toBe(requiresNote);
  });

  it('recusa motivo desconhecido no campo reason', () => {
    expect(() => DeliveryIssueReason.create('chuva')).toThrow(InvalidDeliveryIssueReasonError);
    expect(() => DeliveryIssueReason.create('chuva')).toThrow(expect.objectContaining({ field: 'reason' }));
  });
});

describe('DeliveryIssueNote', () => {
  it('em branco ou ausente vira sem observação; o texto perde os espaços das pontas', () => {
    expect(DeliveryIssueNote.createOptional(undefined)).toBeNull();
    expect(DeliveryIssueNote.createOptional('   ')).toBeNull();
    expect(DeliveryIssueNote.createOptional(' Portão fechado ')?.value).toBe('Portão fechado');
  });

  it('até 150 caracteres (cabe no motivo do histórico)', () => {
    expect(DeliveryIssueNote.createOptional('a'.repeat(150))?.value).toHaveLength(150);
    expect(() => DeliveryIssueNote.createOptional('a'.repeat(151))).toThrow(InvalidDeliveryIssueNoteError);
  });
});
