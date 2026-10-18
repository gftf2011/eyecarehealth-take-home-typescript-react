import '../shared-kernel/presentation/theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';

import { App } from './app/app';
import { createAppDependencies } from './app/create-app-dependencies';
import { loadAppConfig } from './config/app-config';
import { createRoutes } from './router/create-routes';

const root = document.getElementById('root');
if (root === null) throw new Error('Elemento #root não encontrado no index.html');

const dependencies = createAppDependencies(loadAppConfig());
const router = createBrowserRouter(createRoutes());

createRoot(root).render(
  <StrictMode>
    <App dependencies={dependencies} router={router} />
  </StrictMode>,
);

void dependencies.identity.start();
void dependencies.realtime.connection.start();
