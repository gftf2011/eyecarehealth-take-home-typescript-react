import { UnavailableError } from '../../../shared-kernel/domain';

/** O celular não informou a posição: sem permissão, sem sinal ou sem suporte no navegador. */
export class LocationUnavailableError extends UnavailableError {
  readonly code = 'LOCATION_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}
