import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';

import { productionFiles } from './testing/project-structure';

/**
 * Clean Architecture dentro de cada contexto (e do shared kernel): as
 * dependências só apontam para dentro.
 *
 *   main (composition root) → presentation → application → domain
 *                           → infra        ↗
 *
 * `main` monta tudo; nada depende dele. `infra` implementa os ports da
 * `application`; `presentation` só conversa com a `application`.
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
    '%s não depende dos entrypoints de src/main',
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
