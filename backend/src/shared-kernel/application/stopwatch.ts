/**
 * Cronômetro monotônico para medir duração (não sofre com ajustes do relógio
 * do sistema). Injetado para que os casos de uso sejam determinísticos em teste.
 */
export interface Stopwatch {
  /** Inicia a medição; a função devolvida informa os milissegundos decorridos. */
  start(): () => number;
}
