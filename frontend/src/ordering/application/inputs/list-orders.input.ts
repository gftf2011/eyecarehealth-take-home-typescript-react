import {
  collectFieldErrors,
  parseCursor,
  parseDatePeriodInput,
  parsePageLimit,
  parseSortDirection,
  parseSortField,
  validateInput,
} from '../../../shared-kernel/application';
import { ORDER_SORT_FIELDS, OrderStatus, type OrderListCriteria } from '../../domain';

/** Filtros como chegam da tela (e da URL): texto livre, ainda não validado. */
export type ListOrdersInput = {
  /** Cursor da página (`nextCursor`/`previousCursor` da API); vazio = primeira página. */
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly status?: string | undefined;
  /** Dia local de criação (`YYYY-MM-DD`), inclusive. */
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
  /** `createdAt` (padrão) ou `totalAmount`. */
  readonly sortBy?: string | undefined;
  /** `desc` (padrão) ou `asc`. */
  readonly sortOrder?: string | undefined;
};

const present = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

/** Valida tudo de uma vez, com as regras e mensagens da API (um único `VALIDATION_ERROR`). */
export function parseListOrdersInput(input: ListOrdersInput): OrderListCriteria {
  const validated = validateInput({
    cursor: () => parseCursor(input.cursor),
    limit: () => parsePageLimit(input.limit),
    status: () => {
      const status = present(input.status);
      return status === undefined ? null : OrderStatus.create(status).value;
    },
    createdOn: () => parseDatePeriodInput(input.startDate, input.endDate),
    sortField: () => parseSortField(present(input.sortBy), ORDER_SORT_FIELDS, 'createdAt'),
    sortDirection: () => parseSortDirection(present(input.sortOrder), 'desc'),
  });

  return {
    cursor: validated.cursor,
    limit: validated.limit,
    status: validated.status,
    createdOn: validated.createdOn,
    sort: { field: validated.sortField, direction: validated.sortDirection },
  };
}

/** Mensagens por campo para a validação em tempo real do filtro. */
export function listOrdersInputErrors(input: ListOrdersInput): Readonly<Record<string, string>> {
  return collectFieldErrors(() => parseListOrdersInput(input));
}
