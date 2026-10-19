import { DeliveryPerson, type DeliveryPersonDetails, type DeliveryPersonListCriteria } from '../../domain';
import { buildDeliveryPerson } from '../../domain/delivery-person/testing/delivery-person.fixture';
import type { DeliveryPersonGateway } from '../ports/delivery-person-gateway';

/** Gateway em memória que registra o que recebeu (detalhes já validados). */
export class FakeDeliveryPersonGateway implements DeliveryPersonGateway {
  persons: DeliveryPerson[] = [buildDeliveryPerson()];
  readonly listCalls: DeliveryPersonListCriteria[] = [];
  readonly registered: DeliveryPersonDetails[] = [];
  readonly updates: { id: string; changes: Partial<DeliveryPersonDetails> }[] = [];
  readonly removed: string[] = [];
  failWith: Error | null = null;

  list(criteria: DeliveryPersonListCriteria): Promise<readonly DeliveryPerson[]> {
    this.listCalls.push(criteria);
    return Promise.resolve(this.persons);
  }

  register(details: DeliveryPersonDetails): Promise<DeliveryPerson> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.registered.push(details);
    return Promise.resolve(this.#restore('courier-new', details));
  }

  update(id: string, changes: Partial<DeliveryPersonDetails>): Promise<DeliveryPerson> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.updates.push({ id, changes });
    const current = buildDeliveryPerson({ id });
    return Promise.resolve(
      this.#restore(id, {
        name: changes.name ?? current.name,
        phone: changes.phone ?? current.phone,
        vehicleType: changes.vehicleType ?? current.vehicleType,
        isActive: changes.isActive ?? current.isActive,
        location: changes.location === undefined ? current.location : changes.location,
      }),
    );
  }

  remove(id: string): Promise<void> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.removed.push(id);
    return Promise.resolve();
  }

  #restore(id: string, details: DeliveryPersonDetails): DeliveryPerson {
    const now = new Date('2026-10-17T12:00:00Z');
    return DeliveryPerson.restore({ ...details, id, currentOrderId: null, createdAt: now, updatedAt: now });
  }
}
