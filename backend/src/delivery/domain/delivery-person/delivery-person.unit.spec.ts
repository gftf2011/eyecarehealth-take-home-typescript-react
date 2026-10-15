import { describe, expect, it } from 'vitest';

import {
  DeliveryPerson,
  DeliveryPersonActivationChanged,
  DeliveryPersonAlreadyRemovedError,
  DeliveryPersonInUseError,
  DeliveryPersonRegistered,
  DeliveryPersonRelocated,
  DeliveryPersonRemoved,
  DeliveryPersonUpdated,
  GeoPoint,
  PersonName,
  PhoneNumber,
  VehicleType,
} from '../index';
import {
  buildDeliveryPerson,
  buildRegisterParams,
  LATER,
  REGISTERED_AT,
} from './testing/delivery-person.fixture';

describe('DeliveryPerson', () => {
  describe('register', () => {
    it('nasce ativo, com timestamps e evento DeliveryPersonRegistered', () => {
      const deliveryPerson = DeliveryPerson.register(buildRegisterParams());

      expect(deliveryPerson.isActive).toBe(true);
      expect(deliveryPerson.createdAt).toEqual(REGISTERED_AT);
      expect(deliveryPerson.removedAt).toBeNull();

      const events = deliveryPerson.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DeliveryPersonRegistered);
      expect(events[0]?.payload).toEqual({
        name: 'Carlos Santos',
        vehicleType: 'motorcycle',
        isActive: true,
      });
    });

    it('aceita cadastro inativo e sem localização', () => {
      const deliveryPerson = DeliveryPerson.register(
        buildRegisterParams({ isActive: false, location: null }),
      );

      expect(deliveryPerson.isActive).toBe(false);
      expect(deliveryPerson.location).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('reidrata o estado sem emitir eventos', () => {
      const original = buildDeliveryPerson();

      const restored = DeliveryPerson.reconstitute(original.id, original.snapshot());

      expect(restored.equals(original)).toBe(true);
      expect(restored.snapshot()).toEqual(original.snapshot());
      expect(restored.domainEvents).toHaveLength(0);
    });
  });

  describe('updateDetails', () => {
    it('aplica só os campos alterados e emite DeliveryPersonUpdated', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.updateDetails(
        {
          name: PersonName.create('Carlos Santos'),
          phone: PhoneNumber.create('(11) 90000-0000'),
          vehicleType: VehicleType.create('car'),
        },
        LATER,
      );

      expect(deliveryPerson.phone.value).toBe('(11) 90000-0000');
      expect(deliveryPerson.vehicleType.value).toBe('car');
      expect(deliveryPerson.updatedAt).toEqual(LATER);
      const [event] = deliveryPerson.pullDomainEvents();
      expect(event).toBeInstanceOf(DeliveryPersonUpdated);
      expect(event?.payload).toEqual({ changedFields: ['phone', 'vehicleType'] });
    });

    it('é no-op quando nada muda', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.updateDetails({ name: PersonName.create('Carlos Santos') }, LATER);

      expect(deliveryPerson.updatedAt).toEqual(REGISTERED_AT);
      expect(deliveryPerson.domainEvents).toHaveLength(0);
    });
  });

  describe('ativação', () => {
    it('desativa e reativa emitindo DeliveryPersonActivationChanged', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.deactivate(LATER);
      deliveryPerson.activate(LATER);

      const events = deliveryPerson.pullDomainEvents();
      expect(events.every((event) => event instanceof DeliveryPersonActivationChanged)).toBe(true);
      expect(events.map((event) => event.payload)).toEqual([{ isActive: false }, { isActive: true }]);
    });

    it('é idempotente', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.activate(LATER);

      expect(deliveryPerson.domainEvents).toHaveLength(0);
    });
  });

  describe('relocate', () => {
    it('atualiza a localização e emite DeliveryPersonRelocated', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.relocate(GeoPoint.create(-23.563, -46.6544), LATER);

      expect(deliveryPerson.location?.latitude).toBe(-23.563);
      const [event] = deliveryPerson.pullDomainEvents();
      expect(event).toBeInstanceOf(DeliveryPersonRelocated);
      expect(event?.payload).toEqual({ latitude: -23.563, longitude: -46.6544 });
    });

    it('aceita limpar a localização (posição desconhecida)', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.relocate(null, LATER);

      expect(deliveryPerson.location).toBeNull();
      expect(deliveryPerson.pullDomainEvents()[0]?.payload).toEqual({
        latitude: null,
        longitude: null,
      });
    });

    it('é no-op para a mesma posição', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.relocate(GeoPoint.create(-23.5489, -46.6388), LATER);

      expect(deliveryPerson.domainEvents).toHaveLength(0);
    });
  });

  describe('toDispatchCandidate', () => {
    it('vira candidato quando ativo, levando a localização', () => {
      const deliveryPerson = buildDeliveryPerson();

      const candidate = deliveryPerson.toDispatchCandidate();

      expect(candidate?.deliveryPersonId.equals(deliveryPerson.id)).toBe(true);
      expect(candidate?.location?.equals(deliveryPerson.location)).toBe(true);
    });

    it('não é candidato quando inativo ou removido', () => {
      const inactive = buildDeliveryPerson({ isActive: false });
      const removed = buildDeliveryPerson();
      removed.remove({ hasDeliveryInProgress: false, now: LATER });

      expect(inactive.toDispatchCandidate()).toBeNull();
      expect(removed.toDispatchCandidate()).toBeNull();
    });
  });

  describe('remove', () => {
    it('faz soft delete e emite DeliveryPersonRemoved', () => {
      const deliveryPerson = buildDeliveryPerson();

      deliveryPerson.remove({ hasDeliveryInProgress: false, now: LATER });

      expect(deliveryPerson.isRemoved).toBe(true);
      expect(deliveryPerson.removedAt).toEqual(LATER);
      expect(deliveryPerson.pullDomainEvents()[0]).toBeInstanceOf(DeliveryPersonRemoved);
    });

    it('não remove entregador com entrega em andamento', () => {
      const deliveryPerson = buildDeliveryPerson();

      expect(() => deliveryPerson.remove({ hasDeliveryInProgress: true, now: LATER })).toThrow(
        DeliveryPersonInUseError,
      );
      expect(deliveryPerson.isRemoved).toBe(false);
    });

    it.each([
      ['updateDetails', (d: DeliveryPerson) => d.updateDetails({ vehicleType: VehicleType.create('car') }, LATER)],
      ['deactivate', (d: DeliveryPerson) => d.deactivate(LATER)],
      ['relocate', (d: DeliveryPerson) => d.relocate(null, LATER)],
      ['remove', (d: DeliveryPerson) => d.remove({ hasDeliveryInProgress: false, now: LATER })],
    ])('entregador removido rejeita %s', (_operation, act) => {
      const deliveryPerson = buildDeliveryPerson();
      deliveryPerson.remove({ hasDeliveryInProgress: false, now: LATER });
      deliveryPerson.pullDomainEvents();

      expect(() => act(deliveryPerson)).toThrow(DeliveryPersonAlreadyRemovedError);
      expect(deliveryPerson.domainEvents).toHaveLength(0);
    });
  });
});
