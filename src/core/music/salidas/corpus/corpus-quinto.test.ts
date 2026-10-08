/**
 * El quinto examen: **el menú que construye el dominio contra 50 casos escritos sin
 * mirar el generador ni los cuatro corpus de antes**, con el criterio del ciego
 * (`corpus-quinto.ts`, `exigir`).
 *
 * **La nota mínima y la lista de abajo se suben a mano**, como en los otros: un
 * trinquete que nadie sube no sujeta nada.
 */

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { degreesFor } from '../../progressions';
import { salidasPosibles } from '../menu';
import { claveDe, notaDe, PRIMERAS } from './corpus-de-salidas';
import { exigir, informeExigente, type NotaExigente } from './corpus-de-verificacion';
import {
  CORPUS_QUINTO,
  examenesQuintos,
  FAMILIAS_QUINTAS,
  type ExamenQuinto,
} from './corpus-quinto';

/**
 * La nota por debajo de la cual el examen falla, de 0 a 1: expectativas cumplidas
 * entre todas.
 *
 * **La cifra honesta, antes de arreglar nada**: medida el 5 de octubre de 2026 a las
 * 12:14, con el corpus recién traducido y sin tocar el generador ni el juez, **714 de
 * 768 (0,93) y 22 de 50 menús enteros**. El arreglista había juzgado a mano 74 % bien,
 * 24 % aceptable y 2 % mal. Es la cifra de generalización: lo que viene después es
 * tras arreglar.
 *
 * El 5 de octubre de 2026 a las 13:05, **después de arreglar por sus causas** —el
 * papel que manda sobre el vamp, el consecuente y la B de la AABA con su nombre,
 * los motivos construidos con lo que suena en la canción y la regla general de
 * verdad (`lo-que-dice.ts`), los giros del vamp de funk, el relleno que no entra por
 * variedad ni la red con reparo, la cadencia a mitad de compás y la andaluza que no
 * cierra como un pop— y de corregir con su argumento tres expectativas (las dice
 * `corpus-quinto.ts`): **732 de 768 (0,95) y 27 de 50**. Lo que falta son, casi
 * todo, gustos del arreglista que ninguna de esas causas toca: el V/V sin preparar
 * arriba del menú, el iii en un pop con suspendidos, un menú de dos compases que
 * estira.
 */
const NOTA_MINIMA = 0.95;

/** Los menús enteros que **no pueden volver a fallar**: los 27 de la última medida de arriba. */
const YA_NO_PUEDEN_FALLAR: readonly string[] = [
  'M01:continuar',
  'M02:continuar',
  'M04:continuar',
  'M05:continuar',
  'M06:continuar',
  'M07:retocar',
  'M09:retocar',
  'M10:continuar',
  'M11:continuar',
  'M12:continuar',
  'M13:retocar',
  'M14:continuar',
  'M16:retocar',
  'M19:continuar',
  'M20:continuar',
  'M22:retocar',
  'm03:continuar',
  'm04:retocar',
  'm05:retocar',
  'm06:continuar',
  'm09:retocar',
  'm11:retocar',
  'm12:continuar',
  'm13:continuar',
  'm14:continuar',
  'm19:continuar',
  'm20:continuar',
];

/** Dónde queda el informe: fuera del repositorio por defecto, como el de los otros. */
const INFORME = process.env['INFORME_QUINTO'] ?? join(tmpdir(), 'examen-quinto.txt');

// --- El corpus, que es un dato y se comprueba como tal --------------------------------

describe('el corpus quinto', () => {
  const examenes = examenesQuintos();

  it('tiene los 50 casos del arreglista, sin repetir, y un menú cada uno', () => {
    expect(CORPUS_QUINTO).toHaveLength(50);
    expect(new Set(CORPUS_QUINTO.map((caso) => caso.id)).size).toBe(50);
    expect(examenes).toHaveLength(50);
  });

  it('mitad mayor y mitad menor, mitad para continuar y mitad para retocar', () => {
    expect(CORPUS_QUINTO.filter((caso) => caso.mode === 'major')).toHaveLength(25);
    expect(CORPUS_QUINTO.filter((caso) => caso.kind === 'continuar')).toHaveLength(25);
  });

  it('reparte los casos entre las familias del arreglista, y todas tienen alguno', () => {
    for (const familia of FAMILIAS_QUINTAS) {
      expect(
        CORPUS_QUINTO.some((caso) => caso.familia === familia),
        familia,
      ).toBe(true);
    }
  });

  it('solo usa grados que existen en su modo, con todo alineado compás a compás', () => {
    for (const caso of CORPUS_QUINTO) {
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
    for (const caso of CORPUS_QUINTO) {
      const { cuantas = PRIMERAS, porque } = caso.espera.razonables ?? {};
      expect(cuantas >= PRIMERAS || porque !== undefined, caso.id).toBe(true);
    }
  });
});

// --- El examen ---------------------------------------------------------------------

/** Cada menú, como lo construiría la ruta. */
function examinarTodo(examenes: readonly ExamenQuinto[]): NotaExigente[] {
  return examenes.map(({ caso, kind }) =>
    exigir(caso, kind, salidasPosibles(caso.mode, kind, caso.compases, caso.contexto))!,
  );
}

describe('el quinto examen', () => {
  const notas = examinarTodo(examenesQuintos());
  const nota = notaDe(notas);
  writeFileSync(
    INFORME,
    informeExigente(notas, [
      `Quinto examen de las salidas: ${CORPUS_QUINTO.length} casos y ${notas.length} menús, nota mínima ${NOTA_MINIMA}.`,
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

  it('examina los 50 menús', () => {
    expect(notas).toHaveLength(50);
  });
});
