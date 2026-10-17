import { describe, expect, it } from 'vitest';

import type { Repository } from '.';
import {
  SampleId,
  SampleLineId,
  type SampleAggregate,
  type SampleLine,
} from './testing/sample-aggregate';

/*
 * Guardas de compilação: `npm run typecheck` falha se alguma linha marcada com
 * @ts-expect-error passar a compilar.
 */

// @ts-expect-error Entidade interna (não raiz de agregado) não pode ter repositório.
export type SampleLineRepository = Repository<SampleLine>;

export function findSampleWithForeignId(samples: Repository<SampleAggregate>): void {
  // @ts-expect-error findById só aceita o ID do próprio agregado.
  void samples.findById(SampleLineId.generate());
  void samples.findById(SampleId.generate());
}

describe('Repository', () => {
  it('é restrito a raízes de agregado (garantido pelo typecheck)', () => {
    expect(typeof findSampleWithForeignId).toBe('function');
  });
});
