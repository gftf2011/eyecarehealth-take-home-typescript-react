import type { RouteObject } from 'react-router';

import { RequireSession, loginRoute } from '../../identity/presentation';
import type { NavigationItem } from '../../shared-kernel/presentation';
import { AppShell } from '../layout/app-shell/app-shell';
import { HomePage } from '../layout/home-page/home-page';
import { NotFoundPage } from '../layout/not-found-page/not-found-page';

/** Menu do painel: cada contexto acrescenta as suas telas aqui. */
export const NAVIGATION: readonly NavigationItem[] = [];

/** Árvore de rotas: o login é público; todo o resto exige sessão. */
export function createRoutes(): RouteObject[] {
  return [
    loginRoute(),
    {
      element: (
        <RequireSession>
          <AppShell navigation={NAVIGATION} />
        </RequireSession>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}
