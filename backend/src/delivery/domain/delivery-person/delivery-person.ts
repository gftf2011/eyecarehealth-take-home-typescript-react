import { AggregateRoot, type ValueObject } from '../../../shared-kernel/domain';
import { DispatchCandidate } from '../dispatch/value-objects/dispatch-candidate';
import type { GeoPoint } from '../location/geo-point';
import type { DeliveryPersonId } from './delivery-person-id';
import { DeliveryPersonAlreadyRemovedError, DeliveryPersonInUseError } from './errors';
import {
  DeliveryPersonActivationChanged,
  DeliveryPersonRegistered,
  DeliveryPersonRelocated,
  DeliveryPersonRemoved,
  DeliveryPersonUpdated,
  type DeliveryPersonDetailField,
} from './events';
import type { PersonName } from './value-objects/person-name';
import type { PhoneNumber } from './value-objects/phone-number';
import type { UserAccountId } from './value-objects/user-account-id';
import type { VehicleType } from './value-objects/vehicle-type';

export type DeliveryPersonDetails = {
  name: PersonName;
  phone: PhoneNumber;
  vehicleType: VehicleType;
};

export type DeliveryPersonDetailsChanges = Partial<DeliveryPersonDetails>;

export type RegisterDeliveryPersonParams = DeliveryPersonDetails & {
  id: DeliveryPersonId;
  isActive?: boolean;
  location?: GeoPoint | null;
  /** Usuário (perfil `courier`) com que ele entra no sistema, se houver. */
  userId?: UserAccountId | null;
  now: Date;
};

export type DeliveryPersonSnapshot = DeliveryPersonDetails & {
  isActive: boolean;
  location: GeoPoint | null;
  userId: UserAccountId | null;
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date | null;
};

export type RemoveDeliveryPersonParams = {
  /** Fato vindo do contexto Ordering (via ACL): há pedido `delivering` com ele? */
  hasDeliveryInProgress: boolean;
  now: Date;
};

/**
 * Raiz do agregado DeliveryPerson (contexto Delivery).
 *
 * Invariantes:
 * - Atributos sempre válidos (Value Objects).
 * - Entregador removido (soft delete) é imutável.
 * - Entregador com entrega em andamento não pode ser removido.
 * - Só entregador ativo e não removido entra na otimização de atribuição.
 */
export class DeliveryPerson extends AggregateRoot<DeliveryPersonId> {
  #state: DeliveryPersonSnapshot;

  private constructor(id: DeliveryPersonId, state: DeliveryPersonSnapshot) {
    super(id);
    this.#state = state;
  }

  static register({
    id,
    now,
    isActive = true,
    location = null,
    userId = null,
    ...details
  }: RegisterDeliveryPersonParams): DeliveryPerson {
    const deliveryPerson = new DeliveryPerson(id, {
      ...details,
      isActive,
      location,
      userId,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      removedAt: null,
    });

    deliveryPerson.addDomainEvent(
      new DeliveryPersonRegistered(id, now, {
        name: details.name.value,
        vehicleType: details.vehicleType.value,
        isActive,
      }),
    );
    return deliveryPerson;
  }

  /** Reidrata a partir da persistência. Não emite eventos. */
  static reconstitute(id: DeliveryPersonId, snapshot: DeliveryPersonSnapshot): DeliveryPerson {
    return new DeliveryPerson(id, { ...snapshot });
  }

  get name(): PersonName {
    return this.#state.name;
  }

  get phone(): PhoneNumber {
    return this.#state.phone;
  }

  get vehicleType(): VehicleType {
    return this.#state.vehicleType;
  }

  get isActive(): boolean {
    return this.#state.isActive;
  }

  get location(): GeoPoint | null {
    return this.#state.location;
  }

  get userId(): UserAccountId | null {
    return this.#state.userId;
  }

  get createdAt(): Date {
    return new Date(this.#state.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.#state.updatedAt.getTime());
  }

  get removedAt(): Date | null {
    return this.#state.removedAt === null ? null : new Date(this.#state.removedAt.getTime());
  }

  get isRemoved(): boolean {
    return this.#state.removedAt !== null;
  }

  snapshot(): DeliveryPersonSnapshot {
    return {
      ...this.#state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      removedAt: this.removedAt,
    };
  }

  /**
   * Candidato à otimização de atribuição, ou `null` se inativo/removido. Se
   * está ou não em uma entrega é fato do Ordering e é filtrado pela aplicação.
   */
  toDispatchCandidate(): DispatchCandidate | null {
    if (!this.#state.isActive || this.isRemoved) return null;
    return DispatchCandidate.create({ deliveryPersonId: this.id, location: this.#state.location });
  }

  updateDetails(changes: DeliveryPersonDetailsChanges, now: Date): void {
    this.ensureNotRemoved();

    const next: DeliveryPersonDetails = { ...this.#state };
    const changedFields: DeliveryPersonDetailField[] = [];

    if (changes.name !== undefined && hasChanged(next.name, changes.name)) {
      next.name = changes.name;
      changedFields.push('name');
    }
    if (changes.phone !== undefined && hasChanged(next.phone, changes.phone)) {
      next.phone = changes.phone;
      changedFields.push('phone');
    }
    if (changes.vehicleType !== undefined && hasChanged(next.vehicleType, changes.vehicleType)) {
      next.vehicleType = changes.vehicleType;
      changedFields.push('vehicleType');
    }

    if (changedFields.length === 0) return;

    this.#state = { ...this.#state, ...next, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new DeliveryPersonUpdated(this.id, now, { changedFields }));
  }

  activate(now: Date): void {
    this.changeActivation(true, now);
  }

  deactivate(now: Date): void {
    this.changeActivation(false, now);
  }

  /** Atualiza a localização atual; `null` indica posição desconhecida. */
  relocate(location: GeoPoint | null, now: Date): void {
    this.ensureNotRemoved();
    if (!hasChanged(this.#state.location, location)) return;

    this.#state = { ...this.#state, location, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(
      new DeliveryPersonRelocated(this.id, now, {
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      }),
    );
  }

  remove({ hasDeliveryInProgress, now }: RemoveDeliveryPersonParams): void {
    this.ensureNotRemoved();
    if (hasDeliveryInProgress) throw new DeliveryPersonInUseError(this.id);

    this.#state = {
      ...this.#state,
      removedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    };
    this.addDomainEvent(new DeliveryPersonRemoved(this.id, now));
  }

  private changeActivation(isActive: boolean, now: Date): void {
    this.ensureNotRemoved();
    if (this.#state.isActive === isActive) return;

    this.#state = { ...this.#state, isActive, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new DeliveryPersonActivationChanged(this.id, now, { isActive }));
  }

  private ensureNotRemoved(): void {
    if (this.isRemoved) throw new DeliveryPersonAlreadyRemovedError(this.id);
  }
}

function hasChanged<T extends ValueObject<object>>(current: T | null, next: T | null): boolean {
  if (current === null || next === null) return current !== next;
  return !current.equals(next);
}
