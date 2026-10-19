import { TemporarilyUnavailableError } from '../../../shared-kernel/domain';

/** Todos os workers do otimizador ocupados e a fila cheia: tentar de novo em instantes. */
export class DispatchPlannerBusyError extends TemporarilyUnavailableError {
  readonly code = 'OPTIMIZER_BUSY';

  constructor() {
    super('O otimizador está ocupado com outras sugestões. Tente novamente em instantes.');
  }
}
