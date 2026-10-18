import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';

import { productionFiles } from './testing/project-structure';

/**
 * Clean Architecture dentro de cada contexto (e do shared kernel), como na
 * API: as dependências só apontam para dentro.
 *
 *   main (composition root) → presentation → application → domain
 *                           → infra        ↗
 *
 * `main` monta tudo; nada depende dele. `infra` implementa os ports da
 * `application` (HTTP, sessão, travas); `presentation` (React) só conversa
 * com a `application` e o `domain`.
 */
const LAYER_RULES: readonly (readonly [layer: string, forbidden: readonly string[]])[] = [
  ['domain', ['application', 'infra', 'presentation', 'main']],
  ['application', ['infra', 'presentation', 'main']],
  ['infra', ['presentation', 'main']],
  ['presentation', ['infra', 'main']],
];

const CASES = LAYER_RULES.flatMap(([layer, forbidden]) => forbidden.map((target) => [layer, target] as const));

describe('Arquitetura em camadas', () => {
  it.each(CASES)('%s não depende de %s', async (layer, target) => {
    const rule = productionFiles(`src/*/${layer}/**`)
      .shouldNot()
      .dependOnFiles()
      .inPath(`src/*/${target}/**`);

    await expect(rule).toPassAsync();
  });

  it.each(['domain', 'application', 'infra', 'presentation'])(
    '%s não depende da composição em src/main',
    async (layer) => {
      const rule = productionFiles(`src/*/${layer}/**`).shouldNot().dependOnFiles().inPath('src/main/**');

      await expect(rule).toPassAsync();
    },
  );

  it('não há dependências circulares', async () => {
    const rule = projectFiles().inFolder('src/**').should().haveNoCycles();

    await expect(rule).toPassAsync();
  });
});
