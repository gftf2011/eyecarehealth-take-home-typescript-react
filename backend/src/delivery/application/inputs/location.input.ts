import { GeoPoint } from '../../domain';
import { IncompleteLocationError } from '../errors/incomplete-location.error';

const LOCATION_FIELDS = { latitude: 'currentLatitude', longitude: 'currentLongitude' };

/**
 * Interpreta a localização vinda do cliente:
 * - as duas ausentes (`undefined`): não altera;
 * - as duas `null`: posição desconhecida (apaga);
 * - os dois números: ponto validado pelo Value Object;
 * - qualquer mistura: erro, apontando a coordenada que falta.
 */
export function parseLocationInput(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): GeoPoint | null | undefined {
  if (latitude === undefined && longitude === undefined) return undefined;
  if (latitude === null && longitude === null) return null;
  if (typeof latitude !== 'number') throw new IncompleteLocationError('currentLatitude');
  if (typeof longitude !== 'number') throw new IncompleteLocationError('currentLongitude');
  return GeoPoint.create(latitude, longitude, LOCATION_FIELDS);
}
