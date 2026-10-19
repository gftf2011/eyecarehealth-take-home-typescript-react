import { TemporarilyUnavailableError } from '../../../shared-kernel/domain';

/** O cálculo passou do tempo limite e foi interrompido. */
export class DispatchPlannerTimeoutError extends TemporarilyUnavailableError {
  readonly code = 'OPTIMIZER_TIMEOUT';

  constructor(timeoutMs: number) {
    super('A sugestão de atribuição demorou demais e foi interrompida. Tente novamente.', [{ timeoutMs }]);
  }
}
