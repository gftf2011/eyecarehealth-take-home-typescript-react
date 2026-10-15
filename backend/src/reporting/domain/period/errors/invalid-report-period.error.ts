import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidReportPeriodError extends InvalidValueError {
  readonly code = 'INVALID_REPORT_PERIOD';

  constructor() {
    super('endDate', 'A data fim deve ser igual ou posterior à data início');
  }
}
