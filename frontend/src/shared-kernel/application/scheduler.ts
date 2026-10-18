/** Agenda uma tarefa para depois (injetado para a aplicação não depender de timers do navegador). */
export interface Scheduler {
  /** @returns função que cancela a tarefa, se ainda não rodou. */
  schedule(task: () => void, delayMs: number): () => void;
}
