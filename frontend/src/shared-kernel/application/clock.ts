/** Fonte do "agora". Injetada para que os casos de uso sejam determinísticos em teste. */
export interface Clock {
  now(): Date;
}
