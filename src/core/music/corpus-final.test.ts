/**
 * El examen final: **el menú que construye el dominio contra 50 casos corrientes
 * escritos sin mirar el generador ni los otros tres corpus**, con el criterio del
 * ciego (`corpus-final.ts`, `exigir`).
 *
 * **La nota mínima y la lista de abajo se suben a mano**, como en el ciego: un
 * trinquete que nadie sube no sujeta nada.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { claveDe, notaDe, PRIMERAS } from './corpus-de-salidas';
import { exigir, informeExigente, type NotaExigente } from './corpus-de-verificacion';
import { CORPUS_FINAL, examenesFinales, FAMILIAS_FINALES, type ExamenFinal } from './corpus-final';
import { salidasPosibles } from './paths';
import { degreesFor } from './progressions';

/**
 * La nota por debajo de la cual el examen falla, de 0 a 1: expectativas cumplidas
 * entre todas.
 *
 * **La cifra ciega, antes de arreglar nada**: medida el 5 de octubre de 2026 a las
 * 00:59, con el corpus recién traducido y sin tocar el generador ni el juez, **693 de
 * 724 (0,96) y 36 de 50 menús enteros**. Y con las cinco mentiras nuevas en
 * `diceAlgoFalso` —el nombre y el motivo que no dicen la misma parte, las quintas con
 * tercera, la dominante sin sensible, «en el N» contando acordes y «1 notas»—, todavía
 * sin arreglar: **621 de 724 (0,86) y 8 de 50**. Esa es la honesta: el juicio a mano
 * del arreglista había dado 72 % bien, 18 % aceptable y 10 % mal.
 *
 * El 5 de octubre a las 02:30, **después de arreglar por sus causas** —una sola tabla
 * de qué parte se añade, las quintas sin tercera, el blues a medias que se completa,
 * el compás 1 que es la predominante, la bajada armonizada sobre su bajo, el ritmo
 * armónico lento, lo dudoso que no sostiene la cadencia, el punteo al elegir— y de
 * corregir con su argumento cuatro expectativas (las dice `corpus-final.ts`): **718 de
 * 724 y 46 de 50**. Los cuatro que faltan no son de esas causas: el cambio rápido del
 * blues retocado, la subdominante que el vals pide delante del V y el estribillo que
 * el arreglista quiere cerrado en la primera.
 *
 * **El 5 de octubre de 2026 a las 11:16, con los seis estilos nuevos**, los cuatro
 * casos de rumba y de andaluza —que son flamenco y se escribieron sin estilo porque
 * no existía— se examinan además con el suyo (`suEstilo`): **778 de 784 y 50 de 54**,
 * los cuatro nuevos enteros y los mismos cuatro de antes sin pasar. Para que entrara
 * la rumba en mayor se arregló por su causa —el bII del flamenco es el del menor—,
 * sin tocar ninguna expectativa.
 *
 * **El 5 de octubre de 2026 a las 11:42, con los movimientos y las formas nuevas**
 * —la predominante delante de la dominante, el cambio rápido del blues, el semitono
 * frigio, la dominante partida en su ii, el periodo y la AABA que se completan y el
 * reposo frigio que `seguir` acepta—: **783 de 784 y 53 de 54**. Entran tres de los
 * cuatro de antes —el cambio rápido de los dos blues y la subdominante del vals—,
 * y para los dos blues hizo falta además que doblar un coro entero no se ofrezca. Sin
 * tocar ninguna expectativa. Queda el estribillo que el arreglista quiere cerrado en
 * la primera.
 */
const NOTA_MINIMA = 0.99;

/** Los menús enteros que **no pueden volver a fallar**: los 53 de la última medida de arriba. */
const YA_NO_PUEDEN_FALLAR: readonly string[] = [
  'MC01:continuar',
  'MC03:continuar',
  'MC04:continuar',
  'MC05:continuar',
  'MC06:continuar',
  'MC07:continuar',
  'MC08:continuar',
  'MC09:continuar',
  'MC09/flamenco:continuar',
  'MC10:continuar',
  'MC11:continuar',
  'MC12:continuar',
  'MC13:continuar',
  'MR01:retocar',
  'MR02:retocar',
  'MR03:retocar',
  'MR04:retocar',
  'MR05:retocar',
  'MR06:retocar',
  'MR07:retocar',
  'MR08:retocar',
  'MR09:retocar',
  'MR10:retocar',
  'MR11:retocar',
  'MR12:retocar',
  'mC01:continuar',
  'mC01/flamenco:continuar',
  'mC02:continuar',
  'mC03:continuar',
  'mC04:continuar',
  'mC05:continuar',
  'mC06:continuar',
  'mC07:continuar',
  'mC08:continuar',
  'mC09:continuar',
  'mC10:continuar',
  'mC11:continuar',
  'mC12:continuar',
  'mR01:retocar',
  'mR02:retocar',
  'mR02/flamenco:retocar',
  'mR03:retocar',
  'mR04:retocar',
  'mR05:retocar',
  'mR06:retocar',
  'mR07:retocar',
  'mR08:retocar',
  'mR09:retocar',
  'mR10:retocar',
  'mR11:retocar',
  'mR11/flamenco:retocar',
  'mR12:retocar',
  'mR13:retocar',
];

/** Dónde queda el informe: fuera del repositorio por defecto, como el de los otros. */
const INFORME = process.env['INFORME_FINAL'] ?? join(tmpdir(), 'examen-final.txt');

// --- El corpus, que es un dato y se comprueba como tal --------------------------------

describe('el corpus final', () => {
  const examenes = examenesFinales();

  it('tiene los 50 casos del arreglista, sin repetir, y un menú cada uno, dos con su estilo', () => {
    expect(CORPUS_FINAL).toHaveLength(50);
    expect(new Set(CORPUS_FINAL.map((caso) => caso.id)).size).toBe(50);
    expect(examenes).toHaveLength(54);
    expect(new Set(examenes.map(({ caso }) => caso.id)).size).toBe(54);
  });

  it('lo que se escribió sin estilo porque no existía se examina también con el suyo', () => {
    // La rumba y la andaluza, que son flamenco: cuatro casos, y los cuatro sin estilo.
    const conElSuyo = CORPUS_FINAL.filter((caso) => caso.suEstilo !== undefined);
    expect(conElSuyo.map((caso) => caso.id)).toEqual(['MC09', 'mC01', 'mR02', 'mR11']);
    for (const caso of conElSuyo) {
      expect(caso.contexto.estilo, caso.id).toBeUndefined();
      const [sin, con] = examenes.filter(({ caso: examinado }) => examinado.id.startsWith(caso.id));
      expect(sin!.caso.id).toBe(caso.id);
      expect(con!.caso.id).toBe(`${caso.id}/${caso.suEstilo!}`);
      expect(con!.caso.contexto).toEqual({ ...caso.contexto, estilo: caso.suEstilo });
      // Lo que espera el arreglista es lo mismo: lo escribió pensando en esa música.
      expect(con!.caso[con!.kind]).toBe(sin!.caso[sin!.kind]);
    }
  });

  it('reparte los casos entre las cuatro familias, y cada una dice su modo y su petición', () => {
    for (const familia of FAMILIAS_FINALES) {
      const suyos = CORPUS_FINAL.filter((caso) => caso.familia === familia);
      expect(suyos.length, familia).toBeGreaterThan(10);
      for (const caso of suyos) {
        expect(familia, caso.id).toBe(`${caso.mode === 'major' ? 'mayor' : 'menor'}-${caso.kind}`);
      }
    }
  });

  it('solo usa grados que existen en su modo, con todo alineado compás a compás', () => {
    for (const caso of CORPUS_FINAL) {
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

  it('pedir menos de tres salidas razonables se explica', () => {
    for (const caso of CORPUS_FINAL) {
      const { cuantas = PRIMERAS, porque } = caso.espera.razonables ?? {};
      expect(cuantas >= PRIMERAS || porque !== undefined, caso.id).toBe(true);
    }
  });
});

// --- El examen ---------------------------------------------------------------------

/** Cada menú, como lo construiría la ruta. */
function examinarTodo(examenes: readonly ExamenFinal[]): NotaExigente[] {
  return examenes.map(({ caso, kind }) =>
    exigir(caso, kind, salidasPosibles(caso.mode, kind, caso.compases, caso.contexto))!,
  );
}

describe('el examen final', () => {
  const notas = examinarTodo(examenesFinales());
  const nota = notaDe(notas);
  writeFileSync(
    INFORME,
    informeExigente(notas, [
      `Examen final de las salidas: ${CORPUS_FINAL.length} casos y ${notas.length} menús, nota mínima ${NOTA_MINIMA}.`,
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

  it('examina los 54 menús', () => {
    expect(notas).toHaveLength(54);
  });
});
