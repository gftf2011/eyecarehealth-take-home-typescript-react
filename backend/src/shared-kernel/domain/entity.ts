import type { UniqueId } from './unique-id';

/** Objeto com identidade: duas entidades são iguais se têm o mesmo ID. */
export abstract class Entity<TId extends UniqueId> {
  readonly id: TId;

  protected constructor(id: TId) {
    this.id = id;
  }

  equals(other: Entity<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    return other.constructor === this.constructor && this.id.equals(other.id);
  }
}
