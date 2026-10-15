import { describe, expect, it } from 'vitest';

import { InvalidVehicleTypeError, VehicleType } from '../../index';

describe('VehicleType', () => {
  it.each(['bicycle', 'motorcycle', 'car'])('aceita %s', (raw) => {
    expect(VehicleType.create(raw).value).toBe(raw);
  });

  it.each(['truck', 'Car', ''])('rejeita %j', (raw) => {
    expect(() => VehicleType.create(raw)).toThrow(InvalidVehicleTypeError);
  });
});
