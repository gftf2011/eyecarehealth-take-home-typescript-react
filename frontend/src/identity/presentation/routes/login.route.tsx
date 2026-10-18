import type { RouteObject } from 'react-router';

import { LoginPage } from '../pages/login-page/login-page';

/** `/login` — pública. */
export function loginRoute(): RouteObject {
  return { path: '/login', element: <LoginPage /> };
}
