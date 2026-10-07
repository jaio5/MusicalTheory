/**
 * El examen ciego: **el menú que construye el dominio contra 61 casos escritos sin
 * mirar el generador ni los otros dos corpus**, con el criterio de verificación
 * (`corpus-ciego.ts`, `exigir`).
 *
 * **La nota mínima y la lista de abajo son las de hoy, y se suben a mano.** Este
 * corpus encontró fallos que se están arreglando —en el juez y en el generador— y
 * un examen que no se pudiera tener en verde mientras tanto no sirve; uno que no
 * se suba cuando mejora, tampoco. La cifra que importa es la del informe, por
 * familias.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CORPUS_CIEGO,
  examenesCiegos,
  FAMILIAS_CIEGAS,
  type CasoCiego,
  type ExamenCiego,
} from './corpus-ciego';
import { claveDe, notaDe, PRIMERAS } from './corpus-de-salidas';
import { exigir, informeExigente, type NotaExigente } from './corpus-de-verificacion';
import { salidasPosibles } from './paths';
import { degreesFor } from './progressions';

/**
 * La nota por debajo de la cual el examen falla, de 0 a 1: expectativas cumplidas
 * entre todas.
 *
 * Medida el 4 de octubre de 2026 a las 23:32, con dos arreglos a medias: 1163 de
 * 1218 (0,955) y 52 de 85 menús enteros; el volcado con que juzgó el arreglista,
 * de antes de esos arreglos, daba 1073 de 1218 y 18 menús. **El 5 de octubre a las
 * 00:40, después de arreglar por sus causas lo que encontró** —la llegada que se
 * sostiene, lo que sigue a un pre o a un puente, la cadencia propia de lo que llega
 * por su color, la mezcla con el menor, el idioma funcional y el de dominantes, la
 * ii° del menor armónico, la duda, el color que no se cambia por otro de otra casa—
 * y de corregir con su argumento siete expectativas que contradecían a otras: **1216
 * de 1216 y los 85 menús enteros**. Se sube a mano cada vez que algo mejora: un
 * trinquete que nadie sube no sujeta nada.
 *
 * **El 5 de octubre de 2026 a las 11:16, con los seis estilos nuevos**, los trece
 * casos de funk, country, reggae, bolero y cine se examinan además con el suyo
 * (`suEstilo`): **1407 de 1407 y los 98 menús enteros**. Para que entraran se
 * arregló por su causa lo que salió en los tres de country —el préstamo que el
 * country no toca, ni siquiera el bVII; la cadena de secundarias, que es del jazz; y
 * el vii° tríada como cierre—, sin tocar ninguna expectativa.
 *
 * El 5 de octubre de 2026 a las 11:42, con los movimientos y las formas nuevas, sigue
 * en 98 de 98. Por el camino se cayeron dos —el semitono frigio en mayor, que es
 * prestado, y con séptima, que es el sustituto tritonal— y se arreglaron por esas
 * causas.
 *
 * **La cifra engorda con lo que nunca falla**: cada menú lleva los cinco de
 * `NUNCA` y otros tres de este corpus que casi siempre se cumplen. Lo que de
 * verdad sujeta es la lista de abajo.
 */
const NOTA_MINIMA = 1;

/**
 * Los menús enteros que **no pueden volver a fallar**: los 98 de la última medida
 * de arriba, todos. Una nota global deja que diez mejoras tapen una rotura; esto no.
 */
const YA_NO_PUEDEN_FALLAR: readonly string[] = [
  'funk-vamp-I7/sin-estilo:continuar',
  'funk-vamp-I7/blues:continuar',
  'funk-vamp-I7/funk:continuar',
  'funk-vamp-i7-menor/sin-estilo:continuar',
  'funk-vamp-i7-menor/jazz:continuar',
  'funk-vamp-i7-menor/funk:continuar',
  'funk-retocar-I7-IV7/sin-estilo:retocar',
  'funk-retocar-I7-IV7/blues:retocar',
  'funk-retocar-I7-IV7/funk:retocar',
  'rnb-Imaj7-vi7-ii7-V7/sin-estilo:continuar',
  'rnb-Imaj7-vi7-ii7-V7/jazz:continuar',
  'rnb-ii-V-I-IV/sin-estilo:continuar',
  'rnb-ii-V-I-IV/pop:continuar',
  'rnb-retocar-Imaj7-IVmaj7/sin-estilo:retocar',
  'rnb-retocar-Imaj7-IVmaj7/jazz:retocar',
  'rnb-menor-i7-iv7-VII7-III/sin-estilo:continuar',
  'rnb-menor-i7-iv7-VII7-III/jazz:continuar',
  'country-I-IV-I-V/sin-estilo:continuar',
  'country-I-IV-I-V/folk:continuar',
  'country-I-IV-I-V/country:continuar',
  'country-V-de-V/sin-estilo:continuar',
  'country-V-de-V/folk:continuar',
  'country-V-de-V/country:continuar',
  'country-retocar/sin-estilo:retocar',
  'country-retocar/folk:retocar',
  'country-retocar/country:retocar',
  'reggae-I-IV-2pulsos/sin-estilo:continuar',
  'reggae-I-IV-2pulsos/pop:continuar',
  'reggae-I-IV-2pulsos/reggae:continuar',
  'reggae-menor-i-VII/sin-estilo:continuar',
  'reggae-menor-i-VII/rock:continuar',
  'reggae-menor-i-VII/reggae:continuar',
  'reggae-retocar-I-V-vi-IV/sin-estilo:retocar',
  'reggae-retocar-I-V-vi-IV/pop:retocar',
  'reggae-retocar-I-V-vi-IV/reggae:retocar',
  'cantautor-I-iii-bIII-ii/sin-estilo:continuar',
  'cantautor-I-iii-bIII-ii/folk:continuar',
  'cantautor-I-Vvi-vi-VV/sin-estilo:continuar',
  'cantautor-I-Vvi-vi-VV/folk:continuar',
  'cantautor-IV-iv-I/sin-estilo:retocar',
  'cantautor-IV-iv-I/folk:retocar',
  'cantautor-menor-bajada/sin-estilo:continuar',
  'cantautor-menor-bajada/folk:continuar',
  'latin-i-iv-ii-V/sin-estilo:continuar',
  'latin-i-iv-ii-V/jazz:continuar',
  'bolero-i-i-Viv-iv/sin-estilo:continuar',
  'bolero-i-i-Viv-iv/jazz:continuar',
  'bolero-i-i-Viv-iv/bolero:continuar',
  'latin-retocar-i-ii-V-i/sin-estilo:retocar',
  'latin-retocar-i-ii-V-i/jazz:retocar',
  'cine-I-bVI-bVII-I/sin-estilo:continuar',
  'cine-I-bVI-bVII-I/rock:continuar',
  'cine-I-bVI-bVII-I/cine:continuar',
  'cine-I-iv-heroico/sin-estilo:continuar',
  'cine-I-iv-heroico/rock:continuar',
  'cine-I-iv-heroico/cine:continuar',
  'cine-menor-i-VI-III-VII/sin-estilo:retocar',
  'cine-menor-i-VI-III-VII/metal:retocar',
  'cine-menor-i-VI-III-VII/cine:retocar',
  'popm-i-VI-III-VII:continuar',
  'popm-estribillo-i-VII-VI-VII:continuar',
  'popm-retocar-VI-VII-i-i:retocar',
  'balada68-I-vi-IV-V:continuar',
  'vals-I-I-IV-I-V-V-I-I:continuar',
  'balada68-menor-retocar:retocar',
  'secundarias-cadena-jazz:continuar',
  'secundarias-retocar-I-vi-ii-V:retocar',
  'secundarias-menor-cadena:continuar',
  'relativa-mayor-a-vi:continuar',
  'relativa-menor-a-III:continuar',
  'relativa-retocar-vi-tonicizado:retocar',
  'estribillo-IV-V-iii-vi:continuar',
  'estribillo-IV-I-V-vi:continuar',
  'pre-ii-iii-IV-V:continuar',
  'pre-menor-iv-VI-V-V:continuar',
  'puente-vi-IV-vi-V:continuar',
  'puente-retocar-vi-iii-IV-V:retocar',
  'final-plagal-pop:continuar',
  'final-gospel-I7-IV-iv/sin-estilo:retocar',
  'final-gospel-I7-IV-iv/blues:retocar',
  'coda-pop:continuar',
  'coda-menor:continuar',
  'dudoso-todo-continuar:continuar',
  'dudoso-retocar:retocar',
  'punteo-terceras-mayor:retocar',
  'punteo-sensible-menor:retocar',
  'punteo-septimas-jazz:retocar',
  'punteo-continuar-tercera:continuar',
  'larga-16-pop:continuar',
  'larga-24-blues:continuar',
  'larga-31-rock:continuar',
  'larga-32-retocar:retocar',
  'limite-1-compas-I:continuar',
  'limite-1-compas-V:continuar',
  'limite-2-iguales-vi:continuar',
  'limite-fuera-bII:continuar',
  'limite-1-compas-i-retocar:retocar',
  'limite-V-iii-raro:continuar',
];

/** Dónde queda el informe: fuera del repositorio por defecto, como el de los otros dos. */
const INFORME = process.env['INFORME_CIEGO'] ?? join(tmpdir(), 'examen-ciego.txt');

// --- El corpus, que es un dato y se comprueba como tal --------------------------------

describe('el corpus ciego', () => {
  const examenes = examenesCiegos();

  it('tiene los 61 casos del arreglista, sin repetir, y sus 98 menús', () => {
    expect(CORPUS_CIEGO).toHaveLength(61);
    expect(new Set(CORPUS_CIEGO.map((caso) => caso.id)).size).toBe(61);
    expect(examenes).toHaveLength(98);
    expect(new Set(examenes.map(({ caso, kind }) => `${caso.id}:${kind}`)).size).toBe(98);
  });

  it('reparte los casos entre todas las familias', () => {
    for (const familia of FAMILIAS_CIEGAS) {
      expect(
        CORPUS_CIEGO.some((caso) => caso.familia === familia),
        familia,
      ).toBe(true);
    }
  });

  it('solo usa grados que existen en su modo, con todo alineado compás a compás', () => {
    for (const caso of CORPUS_CIEGO) {
      const validos = degreesFor(caso.mode);
      for (const paso of caso.compases) {
        expect(validos, caso.id).toContain(paso.degree);
        expect(paso.beats, caso.id).toBeGreaterThan(0);
      }
      for (const alineado of [
        caso.contexto.especies,
        caso.contexto.dudosos,
        caso.contexto.melodia,
      ]) {
        if (alineado !== undefined) {
          expect(alineado, caso.id).toHaveLength(caso.compases.length);
        }
      }
      // El estilo va aparte, para poder examinar el caso sin él.
      expect(caso.contexto.estilo, caso.id).toBeUndefined();
    }
  });

  it('un estilo de verdad va siempre con el más cercano, y con el suyo si styles.ts lo tiene', () => {
    const conEstiloReal = CORPUS_CIEGO.filter((caso) => caso.estiloReal !== undefined);
    const conElSuyo = conEstiloReal.filter((caso) => caso.suEstilo !== undefined);
    for (const caso of conEstiloReal) {
      expect(caso.estilo, caso.id).toBeDefined();
      const suyos = examenes.filter(({ caso: examinado }) =>
        examinado.id.startsWith(`${caso.id}/`),
      );
      expect(suyos.map(({ caso: examinado }) => examinado.contexto.estilo)).toEqual([
        undefined,
        caso.estilo,
        ...(caso.suEstilo === undefined ? [] : [caso.suEstilo]),
      ]);
    }
    // Los que tenían estilo de verdad y ya está en styles.ts: funk, country, reggae,
    // bolero y cine. El suyo es el que dice `estiloReal`, no otro.
    expect(conElSuyo).toHaveLength(13);
    for (const caso of conElSuyo) {
      expect(caso.suEstilo, caso.id).toBe(caso.estiloReal);
    }
    expect(CORPUS_CIEGO.length + conEstiloReal.length + conElSuyo.length).toBe(examenes.length);
  });

  it('lo que el arreglista tachó y solo es error en el estilo de verdad, se pide solo con él', () => {
    const conDelSuyo = CORPUS_CIEGO.filter((caso) => caso.delSuyo !== undefined);
    expect(conDelSuyo.length).toBeGreaterThan(0);
    for (const caso of conDelSuyo) {
      const [sin, cercano, suyo] = examenes.filter(({ caso: examinado }) =>
        examinado.id.startsWith(`${caso.id}/`),
      );
      const espera = (examen: ExamenCiego) => examen.caso[examen.kind]!.noDebe;
      expect(espera(sin!), caso.id).not.toEqual(expect.arrayContaining([...caso.delSuyo!]));
      expect(espera(cercano!), caso.id).not.toEqual(expect.arrayContaining([...caso.delSuyo!]));
      expect(espera(suyo!).slice(0, caso.delSuyo!.length), caso.id).toEqual(caso.delSuyo);
    }
  });

  it('espera algo de cada caso, y solo de la petición para la que se escribió', () => {
    for (const { caso, kind } of examenes) {
      const espera = caso[kind]!;
      expect(espera.debe.length, caso.id).toBeGreaterThan(0);
      expect(espera.noDebe.length, caso.id).toBeGreaterThan(0);
      if (kind === 'retocar') {
        expect(caso.continuar, caso.id).toEqual({ debe: [], noDebe: [] });
      } else {
        expect(caso.retocar, caso.id).toBeUndefined();
      }
    }
  });

  it('los límite piden un menú con salidas, y pedir menos de tres se explica', () => {
    for (const caso of CORPUS_CIEGO) {
      const { razonables } = caso.espera;
      if (caso.familia === 'limite') {
        expect(razonables, caso.id).toBeDefined();
      }
      const { cuantas = PRIMERAS, porque } = razonables ?? {};
      expect(cuantas >= PRIMERAS || porque !== undefined, caso.id).toBe(true);
    }
  });

  it('lo que solo es error sabiendo el estilo se pide con él, y sin él no', () => {
    const conDelEstilo = CORPUS_CIEGO.filter((caso) => caso.delEstilo !== undefined);
    expect(conDelEstilo.length).toBeGreaterThan(0);
    for (const caso of conDelEstilo) {
      const [sin, con] = examenes.filter(({ caso: examinado }) =>
        examinado.id.startsWith(`${caso.id}/`),
      );
      const delCaso = caso.delEstilo!;
      expect(sin!.caso.continuar.noDebe, caso.id).toEqual(caso.espera.noDebe);
      expect(con!.caso.continuar.noDebe, caso.id).toEqual([...delCaso, ...caso.espera.noDebe]);
    }
  });

  it('a un caso sin estilo de verdad lo examina una vez, con su estilo si lo tiene', () => {
    const sinEstilo: CasoCiego = { ...CORPUS_CIEGO[0]!, id: 'prueba' };
    delete (sinEstilo as { estilo?: unknown }).estilo;
    delete (sinEstilo as { estiloReal?: unknown }).estiloReal;
    const [solo] = examenesCiegos([sinEstilo]);
    expect(solo!.caso.id).toBe('prueba');
    expect(solo!.caso.contexto.estilo).toBeUndefined();
  });
});

// --- El examen ---------------------------------------------------------------------

/** Cada menú, como lo construiría la ruta. */
function examinarTodo(examenes: readonly ExamenCiego[]): NotaExigente[] {
  return examenes.map(({ caso, kind }) =>
    exigir(caso, kind, salidasPosibles(caso.mode, kind, caso.compases, caso.contexto))!,
  );
}

describe('el examen ciego', () => {
  const notas = examinarTodo(examenesCiegos());
  const nota = notaDe(notas);
  writeFileSync(
    INFORME,
    informeExigente(notas, [
      `Examen ciego de las salidas: ${CORPUS_CIEGO.length} casos y ${notas.length} menús, nota mínima ${NOTA_MINIMA}.`,
      `Debe: alguna de las ${PRIMERAS} primeras (con *). No debe: ninguna del menú.`,
      `Calidad: cada una de las ${PRIMERAS} primeras, sin noDebe y con lo aceptable.`,
      `Medido: ${new Date().toISOString()}.`,
      '',
    ]),
  );

  it(`no baja de la nota mínima (${NOTA_MINIMA}); el detalle, en el informe`, () => {
    expect(nota, `informe en ${INFORME}`).toBeGreaterThanOrEqual(NOTA_MINIMA);
  });

  it('no vuelve a suspender lo que ya aprobó', () => {
    for (const clave of YA_NO_PUEDEN_FALLAR) {
      const suya = notas.find((n) => claveDe(n) === clave);
      expect(suya, `${clave} no está en el corpus`).toBeDefined();
      expect(suya!.incumplidas, `${clave}; informe en ${INFORME}`).toEqual([]);
    }
  });

  it('examina los 98 menús', () => {
    expect(notas).toHaveLength(98);
  });
});
