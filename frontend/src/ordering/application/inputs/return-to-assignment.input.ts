import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import { ReturnReason } from '../../domain';

/** Motivo como o gestor digita. */
export type ReturnToAssignmentFormInput = {
  readonly reason: string;
};

export function parseReturnToAssignmentInput(input: ReturnToAssignmentFormInput): { readonly reason: ReturnReason } {
  return validateInput({ reason: () => ReturnReason.create(input.reason) });
}

/** Mensagens por campo para a validação em tempo real (mesmas regras do caso de uso). */
export function returnToAssignmentErrors(input: ReturnToAssignmentFormInput): Partial<Record<'reason', string>> {
  return collectFieldErrors(() => parseReturnToAssignmentInput(input));
}
