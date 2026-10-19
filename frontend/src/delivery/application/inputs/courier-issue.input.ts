import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import { COURIER_ISSUE_REASONS, type CourierIssueReason } from '../../domain';
import { InvalidCourierIssueError } from '../errors/invalid-courier-issue.error';

const MAX_NOTE_LENGTH = 150;

/** O que o entregador escolhe e escreve no formulário. */
export type CourierIssueFormInput = {
  readonly reason: string;
  readonly note: string;
};

/** Mesmas regras da API: motivo conhecido; observação até 150, obrigatória em "outro". */
export function parseCourierIssueInput(input: CourierIssueFormInput): {
  readonly reason: CourierIssueReason;
  readonly note: string | null;
} {
  return validateInput({
    reason: () => {
      if (!(COURIER_ISSUE_REASONS as readonly string[]).includes(input.reason)) {
        throw new InvalidCourierIssueError('reason', 'Escolha o motivo');
      }
      return input.reason as CourierIssueReason;
    },
    note: () => {
      const note = input.note.trim();
      if (note.length > MAX_NOTE_LENGTH) {
        throw new InvalidCourierIssueError('note', `A observação deve ter no máximo ${MAX_NOTE_LENGTH} caracteres`);
      }
      if (note === '' && input.reason === 'other') {
        throw new InvalidCourierIssueError('note', 'Descreva o problema quando o motivo for "outro"');
      }
      return note === '' ? null : note;
    },
  });
}

/** Mensagens por campo para a validação em tempo real do formulário. */
export function courierIssueErrors(input: CourierIssueFormInput): Partial<Record<'reason' | 'note', string>> {
  return collectFieldErrors(() => parseCourierIssueInput(input));
}
