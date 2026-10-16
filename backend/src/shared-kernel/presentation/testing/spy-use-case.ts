import type { UseCase } from '../../application';

/** Caso de uso falso que registra as entradas e devolve uma saída fixa. */
export class SpyUseCase<TInput, TOutput> implements UseCase<TInput, TOutput> {
  readonly inputs: TInput[] = [];

  constructor(private readonly output: TOutput) {}

  async execute(input: TInput): Promise<TOutput> {
    this.inputs.push(input);
    return this.output;
  }
}
