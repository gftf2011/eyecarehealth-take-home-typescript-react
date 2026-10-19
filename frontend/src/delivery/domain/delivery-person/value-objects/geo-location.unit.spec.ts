import { describe, expect, it } from 'vitest';

import { InvalidLocationError } from '../errors';
import { GeoLocation } from './geo-location';

describe('GeoLocation', () => {
  it('aceita os extremos das faixas', () => {
    expect(GeoLocation.create(-90, 180)).toMatchObject({ latitude: -90, longitude: 180 });
  });

  it.each([
    [90.0001, 0, 'currentLatitude'],
    [Number.NaN, 0, 'currentLatitude'],
    [0, -180.5, 'currentLongitude'],
  ])('recusa (%s, %s) apontando %s', (latitude, longitude, field) => {
    expect(() => GeoLocation.create(latitude, longitude)).toThrow(InvalidLocationError);
    expect(() => GeoLocation.create(latitude, longitude)).toThrow(expect.objectContaining({ field }));
  });
});
