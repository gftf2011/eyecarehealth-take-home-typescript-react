import { InvalidValueError } from '../../../../shared-kernel/domain';

/** Coordenada fora da faixa, ou só uma das duas (o campo diz qual). */
export class InvalidLocationError extends InvalidValueError {
  readonly code = 'INVALID_LOCATION';

  constructor(field: 'currentLatitude' | 'currentLongitude', message: string) {
    super(field, message);
  }
}
