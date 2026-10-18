import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';

import { UserMenu } from '../../../identity/presentation';
import { Spinner, cx, usePermissions, type NavigationItem } from '../../../shared-kernel/presentation';
import styles from './app-shell.module.css';

/** Moldura das telas autenticadas: marca, menu filtrado pelo perfil e usuário logado. */
export function AppShell({ navigation }: { readonly navigation: readonly NavigationItem[] }) {
  const permissions = usePermissions();
  const visible = navigation.filter((item) => permissions.includes(item.permission));

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
        {/* As telas são carregadas sob demanda (um chunk por rota). */}
        <Suspense
          fallback={
            <div className={styles.loading}>
              <Spinner label="Carregando a tela" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
