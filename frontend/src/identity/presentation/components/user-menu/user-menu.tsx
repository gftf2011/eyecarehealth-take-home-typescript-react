import { Button } from '../../../../shared-kernel/presentation';
import { useCurrentSession } from '../../hooks/use-current-session';
import { useLogout } from '../../hooks/use-logout';
import styles from './user-menu.module.css';

/** Usuário logado (email e perfil) e o botão de sair, no topo do painel. */
export function UserMenu() {
  const session = useCurrentSession();
  const logout = useLogout();
  if (session === null) return null;

  return (
    <div className={styles.menu}>
      <div className={styles.identity}>
        <span className={styles.email}>{session.user.email}</span>
        <span className={styles.role}>{session.user.roleLabel}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={logout.isPending}
        onClick={() => logout.mutate()}
      >
        Sair
      </Button>
    </div>
  );
}
