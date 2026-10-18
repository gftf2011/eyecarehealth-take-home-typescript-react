import { cx } from '../../../../shared-kernel/presentation';
import type { LiveStatus } from '../../../domain';
import { useLiveStatus } from '../../hooks/use-live-status';
import styles from './live-status-indicator.module.css';

const LABELS: Readonly<Record<Exclude<LiveStatus, 'idle'>, { text: string; hint: string }>> = {
  connecting: { text: 'Conectando…', hint: 'Conectando às atualizações em tempo real' },
  live: { text: 'Ao vivo', hint: 'Pedidos atualizam sozinhos, sem recarregar a página' },
  reconnecting: { text: 'Reconectando…', hint: 'A conexão caiu; tentando de novo. As telas recarregam ao voltar.' },
  forbidden: { text: 'Sem tempo real', hint: 'Seu perfil não recebe atualizações em tempo real' },
  unavailable: { text: 'Sem tempo real', hint: 'Atualizações em tempo real indisponíveis; recarregue a página' },
};

/** Selo "Ao vivo" no topo do painel; anuncia mudanças de estado ao leitor de tela. */
export function LiveStatusIndicator() {
  const status = useLiveStatus();
  if (status === 'idle') return null;
  const label = LABELS[status];
  return (
    <span
      className={cx(styles.indicator, styles[status])}
      role="status"
      // Em role="status" o nome acessível vem do autor, não do conteúdo.
      aria-label={`Tempo real: ${label.text}`}
      title={label.hint}
    >
      <span className={styles.dot} aria-hidden="true" />
      {label.text}
    </span>
  );
}
