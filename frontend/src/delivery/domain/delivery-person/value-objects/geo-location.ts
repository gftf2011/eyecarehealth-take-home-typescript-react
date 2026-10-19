import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidLocationError } from '../errors';

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/** Posição atual do entregador em graus decimais (as duas coordenadas juntas). */
export class GeoLocation extends ValueObject<{ latitude: number; longitude: number }> {
  private constructor(latitude: number, longitude: number) {
    super({ latitude, longitude });
  }

  static create(latitude: number, longitude: number): GeoLocation {
    return new GeoLocation(GeoLocation.checkLatitude(latitude), GeoLocation.checkLongitude(longitude));
  }

  /** Valida só a latitude (o formulário mostra o erro de cada coordenada). */
  static checkLatitude(latitude: number): number {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
      throw new InvalidLocationError('currentLatitude', `A latitude deve estar entre -${MAX_LATITUDE} e ${MAX_LATITUDE}`);
    }
    return latitude;
  }

  static checkLongitude(longitude: number): number {
    if (!Number.isFinite(longitude) || Math.abs(longitude) > MAX_LONGITUDE) {
      throw new InvalidLocationError(
        'currentLongitude',
        `A longitude deve estar entre -${MAX_LONGITUDE} e ${MAX_LONGITUDE}`,
      );
    }
    return longitude;
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }
}
