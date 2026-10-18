/** Estado da conexão em tempo real, mostrado no topo do painel. */
export type LiveStatus =
  /** Sem sessão: nada a fazer até o login. */
  | 'idle'
  | 'connecting'
  /** Autenticado no gateway e recebendo eventos. */
  | 'live'
  /** Caiu; nova tentativa agendada. */
  | 'reconnecting'
  /** O perfil não tem permissão para o canal de pedidos. */
  | 'forbidden'
  /** O gateway recusou de um jeito que tentar de novo não resolve. */
  | 'unavailable';
