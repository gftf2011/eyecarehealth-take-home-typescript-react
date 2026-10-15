import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidPreparationTimeError } from '../errors';

const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

export class PreparationTime extends ValueObject<{ minutes: number }> {
  private constructor(minutes: number) {
    super({ minutes });
  }

  static ofMinutes(minutes: number): PreparationTime {
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      throw new InvalidPreparationTimeError(
        `O tempo de preparo deve ser um inteiro entre ${MIN_MINUTES} e ${MAX_MINUTES} minutos`,
      );
    }
    return new PreparationTime(minutes);
  }

  get minutes(): number {
    return this.props.minutes;
  }
}
