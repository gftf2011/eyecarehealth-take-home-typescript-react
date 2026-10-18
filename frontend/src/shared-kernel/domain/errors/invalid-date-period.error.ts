import { InvalidValueError } from './domain-error';

export class InvalidDatePeriodError extends InvalidValueError {
  readonly code = 'INVALID_DATE_PERIOD';

  constructor() {
    super('endDate', 'A data fim deve ser igual ou posterior à data início');
  }
}
