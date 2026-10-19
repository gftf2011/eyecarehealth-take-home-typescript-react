import { Navigate, type RouteObject } from 'react-router';

import { PRODUCTS_PATH, productsRoute } from '../../catalog/presentation';
import {
  ASSIGNMENT_PATH,
  DELIVERY_PERSONS_PATH,
  assignmentRoute,
  deliveryPersonsRoute,
} from '../../delivery/presentation';
import { RequireSession, loginRoute } from '../../identity/presentation';
import { ORDERS_PATH, ordersRoute } from '../../ordering/presentation';
import { REPORTS_PATH, reportsRoute } from '../../reporting/presentation';
import type { NavigationItem } from '../../shared-kernel/presentation';
import { AppShell } from '../layout/app-shell/app-shell';
import { NotFoundPage } from '../layout/not-found-page/not-found-page';

/** Menu do painel: cada contexto acrescenta as suas telas aqui. */
export const NAVIGATION: readonly NavigationItem[] = [
  { path: ORDERS_PATH, label: 'Pedidos', permission: 'orders:read' },
  { path: PRODUCTS_PATH, label: 'Produtos', permission: 'products:read' },
  { path: ASSIGNMENT_PATH, label: 'Atribuição', permission: 'orders:write' },
  { path: DELIVERY_PERSONS_PATH, label: 'Entregadores', permission: 'delivery-persons:read' },
  { path: REPORTS_PATH, label: 'Relatórios', permission: 'reports:read' },
];

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
        { index: true, element: <Navigate to={ORDERS_PATH} replace /> },
        ordersRoute(),
        productsRoute(),
        assignmentRoute(),
        deliveryPersonsRoute(),
        reportsRoute(),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}
