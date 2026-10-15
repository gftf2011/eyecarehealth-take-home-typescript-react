import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidGeoLocationError } from '../errors';

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/** Coordenada geográfica do endereço de entrega, em graus decimais. */
export class GeoLocation extends ValueObject<{ latitude: number; longitude: number }> {
  private constructor(latitude: number, longitude: number) {
    super({ latitude, longitude });
  }

  static create(latitude: number, longitude: number): GeoLocation {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
      throw new InvalidGeoLocationError(
        'latitude',
        `A latitude deve estar entre -${MAX_LATITUDE} e ${MAX_LATITUDE}`,
      );
    }
    if (!Number.isFinite(longitude) || Math.abs(longitude) > MAX_LONGITUDE) {
      throw new InvalidGeoLocationError(
        'longitude',
        `A longitude deve estar entre -${MAX_LONGITUDE} e ${MAX_LONGITUDE}`,
      );
    }
    return new GeoLocation(latitude, longitude);
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }
}
