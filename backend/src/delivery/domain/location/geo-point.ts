import { ValueObject } from '../../../shared-kernel/domain/index.js';
import { InvalidGeoPointError } from './errors/invalid-geo-point.error.js';

/** Raio médio da Terra, em km. */
export const EARTH_RADIUS_KM = 6371;

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export type GeoPointFields = { latitude: string; longitude: string };

const DEFAULT_FIELDS: GeoPointFields = { latitude: 'latitude', longitude: 'longitude' };

/** Ponto geográfico em graus decimais (WGS-84). */
export class GeoPoint extends ValueObject<{ latitude: number; longitude: number }> {
  private constructor(latitude: number, longitude: number) {
    super({ latitude, longitude });
  }

  /**
   * @param fields nomes dos campos reportados no erro (ex.: `currentLatitude`
   *   para o entregador, `latitude` para o pedido).
   */
  static create(latitude: number, longitude: number, fields = DEFAULT_FIELDS): GeoPoint {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
      throw new InvalidGeoPointError(
        fields.latitude,
        `A latitude deve estar entre -${MAX_LATITUDE} e ${MAX_LATITUDE}`,
      );
    }
    if (!Number.isFinite(longitude) || Math.abs(longitude) > MAX_LONGITUDE) {
      throw new InvalidGeoPointError(
        fields.longitude,
        `A longitude deve estar entre -${MAX_LONGITUDE} e ${MAX_LONGITUDE}`,
      );
    }
    return new GeoPoint(latitude, longitude);
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  /**
   * Distância geodésica em km pela fórmula de Haversine:
   *   a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
   *   c = 2 · atan2(√a, √(1 − a))
   *   d = R · c
   */
  distanceTo(other: GeoPoint): number {
    const lat1 = toRadians(this.latitude);
    const lat2 = toRadians(other.latitude);
    const deltaLat = toRadians(other.latitude - this.latitude);
    const deltaLon = toRadians(other.longitude - this.longitude);

    const a =
      Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
