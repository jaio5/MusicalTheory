import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CON_BASE } from '../../../vitest.con-base';

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));

/** Lo que importa quien levanta base; buscar la llamada se encontraría a sí mismo. */
const IMPORTA_LA_BASE = /import \{[^}]*\blevantarBaseDePrueba\b[^}]*\} from/;

/** Los ficheros de test de `src/` que levantan base, con su ruta desde la raíz. */
function losQueLevantanBase(): string[] {
  return readdirSync(join(RAIZ, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((fichero) => /\.test\.tsx?$/.test(fichero))
    .map((fichero) => join(RAIZ, 'src', fichero))
    .filter((ruta) => IMPORTA_LA_BASE.test(readFileSync(ruta, 'utf8')))
    .map((ruta) => relative(RAIZ, ruta).split('\\').join('/'))
    .sort();
}

describe('la lista de los tests con base', () => {
  /**
   * Un fichero que levanta base y no está en la lista pasa con PGlite y nunca
   * contra Postgres, que es lo que le pasó a `auth.reloj.test.ts` mientras se
   * elegían con un `grep` (`vitest.con-base.ts`).
   */
  it('es la de los ficheros que la levantan, ni uno más ni uno menos', () => {
    expect([...CON_BASE].sort()).toEqual(losQueLevantanBase());
  });
});
