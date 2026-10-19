import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import {
  GeoLocation,
  InvalidLocationError,
  InvalidVehicleTypeError,
  PersonName,
  PhoneNumber,
  VehicleType,
  type DeliveryPersonDetails,
} from '../../domain';
import type { DeliveryPersonDto } from '../dtos/delivery-person.dto';

/**
 * Campos do formulário como o usuário digita (texto). Os nomes são os da
 * API, então um erro por campo vindo do servidor cai no campo certo.
 */
export type DeliveryPersonFormInput = {
  readonly name: string;
  /** `(XX) XXXXX-XXXX`. */
  readonly phone: string;
  readonly vehicleType: string;
  /** Graus decimais, com vírgula ou ponto. As duas vazias = sem localização. */
  readonly currentLatitude: string;
  readonly currentLongitude: string;
  readonly isActive: boolean;
};

export type DeliveryPersonFormField = Exclude<keyof DeliveryPersonFormInput, 'isActive'>;

export const EMPTY_DELIVERY_PERSON_FORM: DeliveryPersonFormInput = {
  name: '',
  phone: '',
  vehicleType: '',
  currentLatitude: '',
  currentLongitude: '',
  isActive: true,
};

type Coordinate = 'currentLatitude' | 'currentLongitude';

/** Valida todos os campos de uma vez com as regras da API (Value Objects). */
export function parseDeliveryPersonFormInput(input: DeliveryPersonFormInput): DeliveryPersonDetails {
  const validated = validateInput({
    name: () => PersonName.create(input.name),
    phone: () => PhoneNumber.create(input.phone),
    vehicleType: () => {
      if (input.vehicleType.trim() === '') throw new InvalidVehicleTypeError('Escolha o veículo');
      return VehicleType.create(input.vehicleType);
    },
    latitude: () => parseCoordinate(input, 'currentLatitude'),
    longitude: () => parseCoordinate(input, 'currentLongitude'),
  });

  const { latitude, longitude, ...details } = validated;
  return {
    ...details,
    isActive: input.isActive,
    location: latitude === null || longitude === null ? null : GeoLocation.create(latitude, longitude),
  };
}

/** Mensagens por campo para a validação em tempo real do formulário. */
export function deliveryPersonFormErrors(
  input: DeliveryPersonFormInput,
): Partial<Record<DeliveryPersonFormField, string>> {
  return collectFieldErrors(() => parseDeliveryPersonFormInput(input));
}

/** Preenche o formulário de edição a partir do entregador (coordenadas no formato brasileiro). */
export function deliveryPersonFormInputFrom(person: DeliveryPersonDto): DeliveryPersonFormInput {
  return {
    name: person.name,
    phone: person.phone,
    vehicleType: person.vehicleType,
    currentLatitude: person.latitude === null ? '' : String(person.latitude).replace('.', ','),
    currentLongitude: person.longitude === null ? '' : String(person.longitude).replace('.', ','),
    isActive: person.isActive,
  };
}

/** A coordenada sozinha: vazia só se a outra também estiver; número dentro da faixa. */
function parseCoordinate(input: DeliveryPersonFormInput, field: Coordinate): number | null {
  const other: Coordinate = field === 'currentLatitude' ? 'currentLongitude' : 'currentLatitude';
  const value = input[field].trim();
  if (value === '') {
    if (input[other].trim() === '') return null;
    throw new InvalidLocationError(
      field,
      field === 'currentLatitude' ? 'Informe a latitude junto com a longitude' : 'Informe a longitude junto com a latitude',
    );
  }
  if (!/^-?\d+([.,]\d+)?$/.test(value)) {
    throw new InvalidLocationError(field, 'Informe um número em graus decimais, como -23,5489');
  }
  const number = Number(value.replace(',', '.'));
  return field === 'currentLatitude' ? GeoLocation.checkLatitude(number) : GeoLocation.checkLongitude(number);
}
