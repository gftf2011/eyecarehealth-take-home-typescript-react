import { compose, E2E_BASE_URL, MANAGES_STACK } from './stack';

/** Sobe a stack de testes do zero (banco novo com o seed) e espera tudo ficar saudável. */
export default async function globalSetup(): Promise<void> {
  if (!MANAGES_STACK) {
    console.info(`E2E contra a stack em ${E2E_BASE_URL}`);
    return;
  }
  console.info('Subindo a stack de testes (fastmeals-e2e)…');
  compose('down', '--volumes', '--remove-orphans');
  compose('up', '--build', '--detach', '--wait', 'frontend');
}
