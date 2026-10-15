import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidLocalDateError extends InvalidValueError {
  readonly code = 'INVALID_DATE';

  constructor(field: string, raw: string) {
    super(field, `A data '${raw}' deve ser válida e estar no formato YYYY-MM-DD`);
  }
}
