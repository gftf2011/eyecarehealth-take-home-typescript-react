import { InputValidationError } from '../../../shared-kernel/application';
import { InvalidValueError, type DomainErrorDetail } from '../../../shared-kernel/domain';
import { EmptyOrderError, ProductId, Quantity } from '../../domain';
import { TooManyOrderItemsError } from '../errors/too-many-order-items.error';

/**
 * Limite de linhas por pedido: mantém a consulta e o lock dos produtos
 * limitados, independentemente do tamanho do corpo enviado.
 */
export const MAX_ORDER_ITEMS = 100;

export type OrderItemInput = {
  readonly productId: string;
  readonly quantity: number;
};

export type ParsedOrderItem = {
  readonly productId: ProductId;
  readonly quantity: Quantity;
};

/**
 * Valida a lista de itens vinda do cliente. Os erros de cada item apontam o
 * índice (`items.1.quantity`), no mesmo formato de caminho da validação de
 * formato da requisição, e são todos reportados de uma vez.
 */
export function parseOrderItemsInput(raw: readonly OrderItemInput[]): ParsedOrderItem[] {
  if (raw.length === 0) throw new EmptyOrderError();
  if (raw.length > MAX_ORDER_ITEMS) throw new TooManyOrderItemsError(MAX_ORDER_ITEMS);

  const items: ParsedOrderItem[] = [];
  const details: DomainErrorDetail[] = [];

  raw.forEach((item, index) => {
    const productId = attempt(() => ProductId.from(item.productId), `items.${index}.productId`, details);
    const quantity = attempt(() => Quantity.of(item.quantity), `items.${index}.quantity`, details);
    if (productId !== undefined && quantity !== undefined) items.push({ productId, quantity });
  });

  if (details.length > 0) throw new InputValidationError(details);
  return items;
}

function attempt<T>(factory: () => T, field: string, details: DomainErrorDetail[]): T | undefined {
  try {
    return factory();
  } catch (error) {
    if (!(error instanceof InvalidValueError)) throw error;
    details.push({ field, message: error.message });
    return undefined;
  }
}
