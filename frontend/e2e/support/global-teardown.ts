import { compose, MANAGES_STACK } from './stack';

/** Derruba a stack de testes e apaga os volumes, a menos que `E2E_KEEP_STACK=1`. */
export default async function globalTeardown(): Promise<void> {
  if (!MANAGES_STACK) return;
  if (process.env['E2E_KEEP_STACK'] === '1') {
    console.info('Stack de testes mantida (E2E_KEEP_STACK=1): http://localhost:3100');
    return;
  }
  compose('down', '--volumes', '--remove-orphans');
}
