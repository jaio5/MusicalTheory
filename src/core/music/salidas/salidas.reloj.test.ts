import { describe, expect, it } from 'vitest';

import { tarda } from '../../cronometro-para-tests';
import { salidasPosibles } from './menu';
import type { PathStep } from './tipos';

const TUYO: readonly PathStep[] = [
  { degree: 'i', beats: 4 },
  { degree: 'VI', beats: 4 },
  { degree: 'III', beats: 4 },
  { degree: 'VII', beats: 4 },
];

describe('las salidas de una canción larga', () => {
  // Se construyen dos veces por petición, al escribir el prompt y al validar: con
  // treinta y dos compases, las dos juntas en menos de medio segundo.
  it('con treinta y dos compases, continuar y retocar no tardan', () => {
    const larga = Array.from({ length: 32 }, (_, i) => TUYO[i % 4]!);
    expect(
      tarda(() => {
        salidasPosibles('minor', 'continuar', larga);
        salidasPosibles('minor', 'retocar', larga);
      }),
    ).toBeLessThan(500);
  });
});
