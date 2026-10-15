import { describe, expect, it } from 'vitest';

import { GeoLocation, InvalidGeoLocationError } from '../../index';

describe('GeoLocation', () => {
  it.each([
    [-23.5505, -46.6333],
    [90, 180],
    [-90, -180],
  ])('aceita (%d, %d)', (latitude, longitude) => {
    const location = GeoLocation.create(latitude, longitude);
    expect([location.latitude, location.longitude]).toEqual([latitude, longitude]);
  });

  it.each([
    [90.1, 0, 'latitude'],
    [Number.NaN, 0, 'latitude'],
    [0, -180.5, 'longitude'],
    [0, Number.POSITIVE_INFINITY, 'longitude'],
  ])('rejeita (%d, %d) apontando o campo %s', (latitude, longitude, field) => {
    expect(() => GeoLocation.create(latitude, longitude)).toThrow(
      expect.objectContaining({ field }),
    );
    expect(() => GeoLocation.create(latitude, longitude)).toThrow(InvalidGeoLocationError);
  });
});
