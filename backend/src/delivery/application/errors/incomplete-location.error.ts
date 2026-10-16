import { InvalidValueError } from '../../../shared-kernel/domain';

/** Uma coordenada sem a outra: a localização é um ponto, as duas vêm juntas. */
export class IncompleteLocationError extends InvalidValueError {
  readonly code = 'INCOMPLETE_LOCATION';

  constructor(missingField: 'currentLatitude' | 'currentLongitude') {
    super(missingField, 'Informe latitude e longitude juntas (ou as duas nulas para apagar a localização)');
  }
}
