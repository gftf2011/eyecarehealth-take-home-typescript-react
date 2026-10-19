import { describe, expect, it } from 'vitest';

import { GeoLocation, InvalidPhoneNumberError, PersonName } from '../../domain';
import { deliveryPersonBody } from '../../domain/delivery-person/testing/delivery-person.fixture';
import { deliveryPersonSchema, toDeliveryPerson, toDeliveryPersonRequestBody } from './delivery-person.mapper';

describe('Mapper de entregador', () => {
  it('corpo da API → agregado, com a entrega em andamento', () => {
    const person = toDeliveryPerson(
      deliveryPersonSchema.parse(deliveryPersonBody({ currentOrderId: 'order-9', currentLatitude: null, currentLongitude: null })),
    );

    expect(person.name.value).toBe('Carlos Santos');
    expect(person.location).toBeNull();
    expect(person.isOnDelivery).toBe(true);
  });

  it('dados fora das regras viram erro, não um entregador inválido na tela', () => {
    expect(() => toDeliveryPerson(deliveryPersonSchema.parse(deliveryPersonBody({ phone: '123' })))).toThrow(
      InvalidPhoneNumberError,
    );
  });

  it('corpo do PUT só com os campos presentes; localização nula apaga as duas coordenadas', () => {
    expect(toDeliveryPersonRequestBody({ name: PersonName.create('Ana Ferreira'), location: null })).toEqual({
      name: 'Ana Ferreira',
      currentLatitude: null,
      currentLongitude: null,
    });
    expect(toDeliveryPersonRequestBody({ location: GeoLocation.create(-23.5, -46.6) })).toEqual({
      currentLatitude: -23.5,
      currentLongitude: -46.6,
    });
    expect(toDeliveryPersonRequestBody({ isActive: false })).toEqual({ isActive: false });
  });
});
