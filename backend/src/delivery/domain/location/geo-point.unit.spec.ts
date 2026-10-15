import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_KM, GeoPoint } from './geo-point';
import { InvalidGeoPointError } from './errors/invalid-geo-point.error';

/** Um grau ao longo de um meridiano: 2πR / 360. */
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;

describe('GeoPoint', () => {
  describe('create', () => {
    it.each([
      [-23.5489, -46.6388],
      [90, 180],
      [-90, -180],
    ])('aceita (%d, %d)', (latitude, longitude) => {
      const point = GeoPoint.create(latitude, longitude);
      expect([point.latitude, point.longitude]).toEqual([latitude, longitude]);
    });

    it.each([
      [91, 0, 'latitude'],
      [Number.NaN, 0, 'latitude'],
      [0, 180.01, 'longitude'],
      [0, Number.NEGATIVE_INFINITY, 'longitude'],
    ])('rejeita (%d, %d) no campo %s', (latitude, longitude, field) => {
      expect(() => GeoPoint.create(latitude, longitude)).toThrow(InvalidGeoPointError);
      expect(() => GeoPoint.create(latitude, longitude)).toThrow(
        expect.objectContaining({ field }),
      );
    });

    it('reporta o nome de campo informado', () => {
      expect(() =>
        GeoPoint.create(100, 0, { latitude: 'currentLatitude', longitude: 'currentLongitude' }),
      ).toThrow(expect.objectContaining({ field: 'currentLatitude' }));
    });
  });

  describe('distanceTo (Haversine)', () => {
    it('é zero para o mesmo ponto', () => {
      const point = GeoPoint.create(-23.5505, -46.6333);
      expect(point.distanceTo(point)).toBe(0);
    });

    it('mede 1° de latitude como ~111,19 km', () => {
      const distance = GeoPoint.create(0, 0).distanceTo(GeoPoint.create(1, 0));
      expect(distance).toBeCloseTo(KM_PER_DEGREE, 6);
      expect(distance).toBeCloseTo(111.19, 2);
    });

    it('mede 1° de longitude no equador como ~111,19 km', () => {
      expect(GeoPoint.create(0, 0).distanceTo(GeoPoint.create(0, 1))).toBeCloseTo(KM_PER_DEGREE, 6);
    });

    it('encolhe a longitude com a latitude (cos 60° = 0,5)', () => {
      const distance = GeoPoint.create(60, 0).distanceTo(GeoPoint.create(60, 0.001));
      expect(distance).toBeCloseTo(KM_PER_DEGREE * 0.001 * 0.5, 6);
    });

    it('mede pontos antípodas como meia circunferência (πR)', () => {
      expect(GeoPoint.create(0, 0).distanceTo(GeoPoint.create(0, 180))).toBeCloseTo(
        Math.PI * EARTH_RADIUS_KM,
        6,
      );
    });

    it('é simétrica', () => {
      const se = GeoPoint.create(-23.5505, -46.6333);
      const vilaMariana = GeoPoint.create(-23.5891, -46.6378);
      expect(se.distanceTo(vilaMariana)).toBeCloseTo(vilaMariana.distanceTo(se), 12);
      expect(se.distanceTo(vilaMariana)).toBeCloseTo(4.32, 2);
    });
  });
});
