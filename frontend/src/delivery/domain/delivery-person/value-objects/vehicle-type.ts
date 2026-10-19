import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidVehicleTypeError } from '../errors';

export const VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car'] as const;

export type VehicleTypeValue = (typeof VEHICLE_TYPES)[number];

export class VehicleType extends ValueObject<{ value: VehicleTypeValue }> {
  private constructor(value: VehicleTypeValue) {
    super({ value });
  }

  static create(raw: string): VehicleType {
    if (!VehicleType.isValid(raw)) {
      throw new InvalidVehicleTypeError(`O tipo de veículo deve ser um de: ${VEHICLE_TYPES.join(', ')}`);
    }
    return new VehicleType(raw);
  }

  static isValid(raw: string): raw is VehicleTypeValue {
    return (VEHICLE_TYPES as readonly string[]).includes(raw);
  }

  get value(): VehicleTypeValue {
    return this.props.value;
  }
}
