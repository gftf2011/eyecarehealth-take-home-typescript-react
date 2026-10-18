/**
 * Objeto imutável, sem identidade, definido apenas pelos seus atributos.
 * Subclasses validam as invariantes na criação (factory estática) e expõem
 * os atributos por getters.
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: ValueObject<TProps> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    if (other.constructor !== this.constructor) return false;

    const keys = Object.keys(this.props) as (keyof TProps)[];
    if (keys.length !== Object.keys(other.props).length) return false;

    return keys.every((key) => areEqual(this.props[key], other.props[key]));
  }
}

function areEqual(left: unknown, right: unknown): boolean {
  if (left instanceof ValueObject && right instanceof ValueObject) return left.equals(right);
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return Object.is(left, right);
}
