import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import type { DeliveryPersonListCriteria } from '../../domain';
import { InvalidDeliveryPersonFilterError } from '../errors/invalid-delivery-person-filter.error';

/** Filtros como chegam da tela (e da URL): `true`, `false` ou vazio (todos). */
export type ListDeliveryPersonsInput = {
  readonly isActive?: string | undefined;
  readonly available?: string | undefined;
};

export function parseListDeliveryPersonsInput(input: ListDeliveryPersonsInput): DeliveryPersonListCriteria {
  return validateInput({
    isActive: () => parseFlag('isActive', input.isActive, 'A ativação deve ser true ou false'),
    available: () => parseFlag('available', input.available, 'A disponibilidade deve ser true ou false'),
  });
}

export function listDeliveryPersonsInputErrors(input: ListDeliveryPersonsInput): Readonly<Record<string, string>> {
  return collectFieldErrors(() => parseListDeliveryPersonsInput(input));
}

function parseFlag(field: string, raw: string | undefined, message: string): boolean | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  if (value === 'true' || value === 'false') return value === 'true';
  throw new InvalidDeliveryPersonFilterError(field, message);
}
