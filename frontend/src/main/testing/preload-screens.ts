import { beforeAll } from 'vitest';

/**
 * As telas são `lazy` (um chunk por rota). Num teste de integração, o primeiro
 * acesso a uma delas faz o Vite transformar a página na hora, o que, com a
 * suíte toda em paralelo, pode passar do tempo de espera do `findBy` (a tela
 * fica em "Carregando a tela"). Carregar as páginas antes de cada arquivo faz
 * o tempo de espera medir o comportamento, não a compilação.
 */
const screens = import.meta.glob('../../*/presentation/pages/*/*-page.tsx');

beforeAll(async () => {
  await Promise.all(Object.values(screens).map((load) => load()));
}, 60_000);
