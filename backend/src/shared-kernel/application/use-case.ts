/** Contrato comum dos casos de uso: uma operação de negócio com entrada e saída. */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
