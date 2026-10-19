import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../shared-kernel/application';
import { toDeliveryPersonDto } from '../dtos/delivery-person.dto';
import { buildDeliveryPerson } from '../../domain/delivery-person/testing/delivery-person.fixture';
import {
  EMPTY_DELIVERY_PERSON_FORM,
  deliveryPersonFormErrors,
  deliveryPersonFormInputFrom,
  parseDeliveryPersonFormInput,
  type DeliveryPersonFormInput,
} from './delivery-person-form.input';

const VALID: DeliveryPersonFormInput = {
  name: ' Ana Ferreira ',
  phone: '(11) 98765-4321',
  vehicleType: 'bicycle',
  currentLatitude: '-23,5614',
  currentLongitude: '-46.6559',
  isActive: false,
};

describe('Formulário de entregador', () => {
  it('converte o que foi digitado nos Value Objects (vírgula ou ponto nas coordenadas)', () => {
    const details = parseDeliveryPersonFormInput(VALID);

    expect(details.name.value).toBe('Ana Ferreira');
    expect(details.vehicleType.value).toBe('bicycle');
    expect(details.isActive).toBe(false);
    expect(details.location).toMatchObject({ latitude: -23.5614, longitude: -46.6559 });
  });

  it('as duas coordenadas em branco significam sem localização', () => {
    expect(parseDeliveryPersonFormInput({ ...VALID, currentLatitude: ' ', currentLongitude: '' }).location).toBeNull();
  });

  it('mostra todos os erros de uma vez, cada um no seu campo', () => {
    expect(deliveryPersonFormErrors(EMPTY_DELIVERY_PERSON_FORM)).toEqual({
      name: 'O nome deve ter entre 3 e 100 caracteres',
      phone: 'O telefone deve estar no formato (XX) XXXXX-XXXX',
      vehicleType: 'Escolha o veículo',
    });
  });

  it.each([
    [{ currentLatitude: '-23,5' , currentLongitude: '' }, { currentLongitude: 'Informe a longitude junto com a latitude' }],
    [{ currentLatitude: '', currentLongitude: '-46,6' }, { currentLatitude: 'Informe a latitude junto com a longitude' }],
    [{ currentLatitude: 'abc', currentLongitude: '-46,6' }, { currentLatitude: 'Informe um número em graus decimais, como -23,5489' }],
    [{ currentLatitude: '91', currentLongitude: '200' }, {
      currentLatitude: 'A latitude deve estar entre -90 e 90',
      currentLongitude: 'A longitude deve estar entre -180 e 180',
    }],
  ])('localização %j → %j', (location, errors) => {
    expect(deliveryPersonFormErrors({ ...VALID, ...location })).toEqual(errors);
  });

  it('recusa o envio inválido com um único erro de validação', () => {
    expect(() => parseDeliveryPersonFormInput({ ...VALID, phone: '1199' })).toThrow(InputValidationError);
  });

  it('preenche a edição a partir do entregador, com vírgula decimal', () => {
    const dto = toDeliveryPersonDto(buildDeliveryPerson({ currentLatitude: -23.5489, currentLongitude: null }));

    expect(deliveryPersonFormInputFrom(dto)).toEqual({
      name: 'Carlos Santos',
      phone: '(11) 91234-5678',
      vehicleType: 'motorcycle',
      currentLatitude: '',
      currentLongitude: '',
      isActive: true,
    });
    const located = toDeliveryPersonDto(buildDeliveryPerson());
    expect(deliveryPersonFormInputFrom(located)).toMatchObject({ currentLatitude: '-23,5489', currentLongitude: '-46,6388' });
  });
});
