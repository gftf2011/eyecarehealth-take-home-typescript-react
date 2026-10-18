import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';

import type { SessionRenewalSchedulerOptions } from '../../identity/infra';
import type { RealtimeSocketFactory } from '../../realtime/application';
import { TEST_API_BASE_URL, TEST_REALTIME_URL } from '../../shared-kernel/infra/testing/test-api';
import { App } from '../app/app';
import { createAppDependencies } from '../app/create-app-dependencies';
import { createRoutes } from '../router/create-routes';

/** Socket que nunca abre: telas que não testam o tempo real não dependem dele. */
const inertSockets: RealtimeSocketFactory = {
  open: () => ({ send: () => undefined, close: () => undefined }),
};

/**
 * Sobe o painel inteiro como em `main.tsx` (mesma composição, mesmas rotas),
 * com roteador em memória e a API atendida pelo MSW. Com `realtime: true`, o
 * WebSocket de verdade é aberto (o MSW também o intercepta).
 */
export function renderApp(
  options: {
    readonly path?: string;
    readonly renewal?: SessionRenewalSchedulerOptions;
    readonly realtime?: boolean;
  } = {},
) {
  const dependencies = createAppDependencies({
    apiBaseUrl: TEST_API_BASE_URL,
    realtimeUrl: TEST_REALTIME_URL,
    ...(options.renewal === undefined ? {} : { renewal: options.renewal }),
    ...(options.realtime === true ? {} : { realtimeSockets: inertSockets }),
  });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [options.path ?? '/'] });
  const user = userEvent.setup();

  const view = render(<App dependencies={dependencies} router={router} />);
  void dependencies.identity.start();
  void dependencies.realtime.connection.start();

  return {
    ...view,
    user,
    router,
    dependencies,
    unmount: () => {
      dependencies.realtime.connection.stop();
      dependencies.identity.stop();
      view.unmount();
    },
  };
}
