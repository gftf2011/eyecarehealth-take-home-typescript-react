import { NavLink, Outlet } from 'react-router';

import { UserMenu, useCurrentSession } from '../../../identity/presentation';
import { cx, type NavigationItem } from '../../../shared-kernel/presentation';
import styles from './app-shell.module.css';

/** Moldura das telas autenticadas: marca, menu filtrado pelo perfil e usuário logado. */
export function AppShell({ navigation }: { readonly navigation: readonly NavigationItem[] }) {
  const session = useCurrentSession();
  const visible = navigation.filter((item) => session?.permissions.includes(item.permission));

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={cx(styles.brand)} aria-label="FastMeals — início">
          <span className={styles.logo} aria-hidden="true">
            FM
          </span>
          <span className={styles.brandName}>FastMeals</span>
        </NavLink>

        {visible.length === 0 ? null : (
          <nav className={styles.nav} aria-label="Principal">
            {visible.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cx(styles.link, isActive && styles.active)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <UserMenu />
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
