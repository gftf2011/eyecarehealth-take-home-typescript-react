import { InvalidValueError, type DomainErrorDetail } from '../../domain/index.js';
import { InputValidationError } from '../errors/input-validation.error.js';

type Factories = Record<string, () => unknown>;

type Built<TFactories extends Factories> = { [K in keyof TFactories]: ReturnType<TFactories[K]> };

/**
 * Executa todas as fábricas de Value Objects e, se alguma falhar por valor
 * inválido, lança um único `InputValidationError` com os detalhes de todas.
 * Erros de outra natureza são relançados sem alteração.
 *
 * @example
 * const { name, price } = validateInput({
 *   name: () => ProductName.create(input.name),
 *   price: () => ProductPrice.fromDecimal(input.price),
 * });
 */
export function validateInput<TFactories extends Factories>(
  factories: TFactories,
): Built<TFactories> {
  const built: Partial<Built<TFactories>> = {};
  const details: DomainErrorDetail[] = [];

  const entries = Object.entries(factories) as [keyof TFactories, () => unknown][];
  for (const [key, factory] of entries) {
    try {
      built[key] = factory() as ReturnType<TFactories[typeof key]>;
    } catch (error) {
      // Aceita também validações já agrupadas (ex.: PageRequest com page e limit inválidos).
      if (!(error instanceof InvalidValueError || error instanceof InputValidationError)) {
        throw error;
      }
      details.push(...error.details);
    }
  }

  if (details.length > 0) throw new InputValidationError(details);
  return built as Built<TFactories>;
}
