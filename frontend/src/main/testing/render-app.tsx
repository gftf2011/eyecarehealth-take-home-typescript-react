import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';

import type { SessionRenewalSchedulerOptions } from '../../identity/infra';
import { TEST_API_BASE_URL } from '../../shared-kernel/infra/testing/test-api';
import { App } from '../app/app';
import { createAppDependencies } from '../app/create-app-dependencies';
import { createRoutes } from '../router/create-routes';

/**
 * Sobe o painel inteiro como em `main.tsx` (mesma composição, mesmas rotas),
 * com roteador em memória e a API atendida pelo MSW.
 */
export function renderApp(
  options: { readonly path?: string; readonly renewal?: SessionRenewalSchedulerOptions } = {},
) {
  const dependencies = createAppDependencies({
    apiBaseUrl: TEST_API_BASE_URL,
    ...(options.renewal === undefined ? {} : { renewal: options.renewal }),
  });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [options.path ?? '/'] });
  const user = userEvent.setup();

  const view = render(<App dependencies={dependencies} router={router} />);
  void dependencies.identity.start();

  return {
    ...view,
    user,
    router,
    dependencies,
    unmount: () => {
      dependencies.identity.stop();
      view.unmount();
    },
  };
}
