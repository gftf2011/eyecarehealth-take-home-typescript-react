import { describe, expect, it } from 'vitest';

import { productionFiles } from './testing/project-structure';

/**
 * Regras de segurança do enunciado que dá para verificar no código: tokens
 * nunca em storage do navegador (o access token fica em memória e o refresh
 * token num cookie httpOnly) e nenhum HTML cru renderizado.
 */
describe('Segurança', () => {
  it('nada é guardado em localStorage/sessionStorage/IndexedDB', async () => {
    const rule = productionFiles('src/**')
      .should()
      .adhereTo(
        (file) => !/\b(localStorage|sessionStorage|indexedDB)\s*[.[]/.test(file.content),
        'Tokens e dados de sessão não vão para storage do navegador',
      );

    await expect(rule).toPassAsync();
  });

  it('nenhum componente renderiza HTML cru (XSS)', async () => {
    const rule = productionFiles('src/**')
      .should()
      .adhereTo(
        (file) => !/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(file.content),
        'Sem dangerouslySetInnerHTML nem innerHTML',
      );

    await expect(rule).toPassAsync();
  });

  it('nenhum código lê document.cookie (o refresh token é httpOnly)', async () => {
    const rule = productionFiles('src/**')
      .should()
      .adhereTo((file) => !/document\.cookie/.test(file.content), 'Cookies de sessão são do navegador');

    await expect(rule).toPassAsync();
  });
});
