// Las reglas de capas de ARCHITECTURE.md no se comprueban leyendo
// `eslint.config.mjs`: se comprueban pasándole a ESLint un fichero que las
// rompe y viendo que protesta. La diferencia importa. La guarda de «un feature
// no importa de otro» estuvo abierta mucho tiempo porque el patrón pedía dos
// tramos (`@features/*/*`) y el índice de un feature solo tiene uno, y ningún
// test miraba si la regla llegaba a dispararse.
//
// Queda fuera la regla 4 —el audio no sale del dispositivo—, que no es un
// import y por eso el mapa dice que es la única sin vigilar.
import { describe, expect, it, beforeAll } from 'vitest';
import { ESLint } from 'eslint';

let eslint: ESLint;

/**
 * Arrancar ESLint y **gastar el primer análisis aquí**, no en el primer test.
 *
 * Cargar la configuración de este proyecto —con la de Next dentro— y analizar el
 * primer fichero cuesta cerca de segundo y medio en una máquina libre. Con las
 * ciento ochenta y tantas hojas de tests corriendo a la vez puede costar bastante
 * más, y eso se llevó por delante al primer test con el plazo de cinco segundos
 * que traen todos por defecto: un test que falla según lo ocupado que esté el
 * equipo no vigila nada, solo hace ruido.
 *
 * Puesto aquí, con su plazo escrito, lo que se alarga es el arranque y los seis
 * tests miden lo suyo, que son unas decenas de milisegundos cada uno.
 */
beforeAll(async () => {
  eslint = new ESLint();
  await eslint.lintText('export const nada = 1;\n', { filePath: 'src/core/prueba.ts' });
}, 120_000);

/** Los avisos de capas que ESLint da a un fichero que no existe en el disco. */
async function capasDe(rutaFingida: string, codigo: string): Promise<readonly string[]> {
  const resultados = await eslint.lintText(`${codigo}\n`, { filePath: rutaFingida });
  return (resultados[0]?.messages ?? [])
    .filter((aviso) => aviso.ruleId === 'no-restricted-imports')
    .map((aviso) => aviso.message);
}

describe('las reglas de capas las vigila ESLint de verdad', () => {
  it('regla 1: core/ no importa de ninguna otra capa', async () => {
    const avisos = await capasDe(
      'src/core/music/prueba.ts',
      "import { workspace } from '@state/workspace';\nexport const x = workspace;",
    );
    expect(avisos.join(' ')).toContain('TypeScript puro');
  });

  it('regla 3: un feature no importa el índice de otro feature', async () => {
    const avisos = await capasDe(
      'src/features/arrange/prueba.ts',
      "import { Grabadora } from '@features/recorder';\nexport const x = Grabadora;",
    );
    expect(avisos.join(' ')).toContain('no importa de otro feature');
  });

  it('regla 3: tampoco un fichero suelto de otro feature', async () => {
    const avisos = await capasDe(
      'src/features/arrange/prueba.ts',
      "import { Grabadora } from '@features/recorder/Grabadora';\nexport const x = Grabadora;",
    );
    expect(avisos.join(' ')).toContain('no importa de otro feature');
  });

  it('regla 5: un componente no abre src/server/, ni por un fichero de dentro', async () => {
    const avisos = await capasDe(
      'src/ui/prueba.ts',
      "import { users } from '@server/db/schema';\nexport const x = users;",
    );
    expect(avisos.join(' ')).toContain('Solo app/ abre src/server/');
  });

  it('regla 5 al revés: el servidor no importa del navegador', async () => {
    const avisos = await capasDe(
      'src/server/prueba.ts',
      "import { Aviso } from '@ui/Aviso';\nexport const x = Aviso;",
    );
    expect(avisos.join(' ')).toContain('no importa del navegador');
  });

  it('y lo que sí está permitido pasa sin avisos', async () => {
    const avisos = await capasDe(
      'src/features/arrange/prueba.ts',
      "import { pitchClassFromName } from '@core/music';\nexport const x = pitchClassFromName;",
    );
    expect(avisos).toEqual([]);
  });
});
