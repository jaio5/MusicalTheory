/**
 * Seguir un blues: completarlo si va a medias, cerrarlo y otro coro.
 *
 * Aparte de `seguir.ts` porque un blues se cuenta por su forma de doce y no por
 * frases de cuatro, y lo que vale para una cosa rompe la otra.
 */
import type { DegreeSymbol } from '../progressions';
import { CIERRE, comoLlega, prioridadDe, type Borrador } from './borrador';
import { especieNueva, paso, tuyo } from './especies';
import type { Idioma } from './idioma';
import { bluesAMedias } from './juez/forma';
import type { PasoPosible, PathStep } from './tipos';
import { canFollow } from './validar';

/**
 * Un blues que acaba en el giro del final se cierra con la tónica en el compás 13:
 * el compás fuerte que abre el coro siguiente, que es donde acaba un blues.
 */
export function llegadaDelBlues(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const ultimo = original.at(-1)!.degree;
  if (ultimo === id.tonica || !canFollow(id.mode, ultimo, id.tonica)) {
    return [];
  }
  const tonica = id.tonica;
  return [
    {
      path: 'seguir',
      partes: [
        {
          name: CIERRE.nombre,
          yours: false,
          steps: [paso(tonica, id.compas, null, especieNueva(id, tonica, null))],
        },
      ],
      nombre: `Acaba en la ${tonica} del 13`,
      loQueSeAnade: 'tuya',
      que: `Añade la llegada: de tu ${ultimo} a la ${tonica} en el compás 13, el que abriría otro coro, ${comoLlega(id, ultimo, id.especies.at(-1) ?? null)}.`,
      prioridad: prioridadDe(2.8),
      familia: 'resuelve',
    },
  ];
}

/** Si lo tuyo son los ocho primeros compases de un blues, compás a compás (`bluesAMedias`). */
export function esUnBluesAMedias(id: Idioma, original: readonly PathStep[]): boolean {
  return (
    original.every((paso) => paso.beats === id.compas) &&
    bluesAMedias(id.mode, (compas) => original[compas]?.degree, original.length, {
      ...(id.estilo === undefined || id.estilo === null ? {} : { estilo: id.estilo }),
      especies: id.especies,
    })
  );
}

/**
 * **Los cuatro compases que le faltan a un blues**: la dominante en el 9 —o lo que
 * la prepara—, la vuelta del 10 y la tónica del 11 y el 12.
 *
 * Con los ocho primeros de un blues, lo que salía eran frases de ocho llamadas
 * estribillo, y la canción acababa en un blues de dieciséis. Lo que hace cualquiera
 * es acabar el coro: el de Chicago (`V IV I I`), el de jazz (`ii V I I`) y el del
 * II7 delante del V; en menor, el `V iv i i`, el VI7 que baja al V y la ii°. Acaban
 * en la tónica porque seguir cierra en casa; el turnaround del 12 lo pone otro coro.
 */
export function completarElBlues(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const tonica = id.tonica;
  const formas: readonly (readonly [DegreeSymbol[], string, number])[] =
    id.mode === 'major'
      ? [
          [
            ['V', 'IV', tonica, tonica],
            'la dominante en el 9 y el IV en el 10, el de siempre',
            2.6,
          ],
          [
            ['ii', 'V', tonica, tonica],
            'ii V en el 9 y el 10, el giro del blues de jazz',
            2 + id.secundaria,
          ],
          [
            ['V/V', 'V', tonica, tonica],
            'el II7 en el 9, que prepara el V del 10',
            1.8 + id.secundaria,
          ],
        ]
      : [
          [
            ['V', 'iv', tonica, tonica],
            'la dominante en el 9 y el iv en el 10, el de siempre',
            2.6,
          ],
          [['VI', 'V', tonica, tonica], 'el VI7 en el 9, que baja medio tono al V del 10', 2.3],
          [
            ['ii°', 'V', tonica, tonica],
            'la ii° en el 9 y el V en el 10, la cadencia del menor',
            2,
          ],
        ];
  return formas
    .filter(([grados]) =>
      [original.at(-1)!.degree, ...grados].every(
        (grado, i, todos) => i === 0 || canFollow(id.mode, todos[i - 1]!, grado),
      ),
    )
    .map(([grados, como, valor]) => ({
      path: 'seguir' as const,
      partes: [
        {
          name: CIERRE.nombre,
          yours: false,
          steps: grados.map((grado) => paso(grado, id.compas, null, especieNueva(id, grado, null))),
        },
      ],
      loQueSeAnade: 'tuya' as const,
      nombre: `Acaba el blues: ${grados.join(' ')}`,
      que: `Completa los doce compases del blues: ${grados.join(' ')}, con ${como}, y cierra en la ${tonica}.`,
      prioridad: prioridadDe(valor),
      familia: `acaba-el-blues:${grados[0]}`,
    }));
}

/**
 * Otro coro de blues: la forma otra vez, que acaba en casa. Lo que sigue a un
 * blues es otro coro, no un puente ni una cadencia de dos compases.
 */
export function coros(id: Idioma, original: readonly PathStep[]): Borrador[] {
  // Un coro de doce más otro caben siempre: el tope es de treinta y dos.
  const tonica = id.tonica;
  const cuarto: DegreeSymbol = id.mode === 'major' ? 'IV' : 'iv';
  const grados = original.map((paso) => paso.degree);
  const cierra = [...grados];
  let como: string;
  if (cierra[11] !== tonica) {
    cierra[11] = tonica;
    como = `sin el giro del final: acaba en la ${tonica}`;
  } else {
    cierra[1] = cierra[1] === tonica ? cuarto : tonica;
    como = `${cierra[1] === cuarto ? 'con' : 'sin'} el cambio rápido al ${cuarto} en su compás 2, y acaba en la ${tonica}`;
  }
  // Las variantes salen de tu coro si ya acababa en casa, y si no, del que cierra:
  // tocar el compás 2 y el 9 a la vez sería otro blues, no otro coro del tuyo.
  const base = grados[11] === tonica ? grados : cierra;
  // Con el cambio rápido puesto o quitado.
  const conCambio = [...cierra];
  conCambio[1] = cierra[1] === tonica ? cuarto : tonica;
  // El 9 y el 10 preparando la dominante: el ii–V del blues de jazz, o el II7.
  const segundo: DegreeSymbol = id.mode === 'major' ? 'ii' : 'ii°';
  const deJazz = [...base];
  deJazz[8] = segundo;
  deJazz[9] = 'V';
  const conII7 = [...base];
  conII7[8] = 'V/V';
  conII7[9] = 'V';
  // Sin tocar los compases que hacen la forma (1, 5, 7 y 9): el 10 en V o en IV.
  const diez = [...base];
  diez[9] = base[9] === 'V' ? cuarto : 'V';
  // Y el VI7 en el 8, que **va a su ii**: `I VI7 | ii7 | V7`, el blues de jazz
  // entero. Antes el VI7 caía en el V del 9, y una dominante que no llega a lo que
  // prepara es una promesa rota, no un color.
  const conVI7 = [...base];
  if (id.mode === 'major') {
    conVI7[7] = 'V/ii';
    conVI7[8] = 'ii';
    conVI7[9] = 'V';
  }
  const montar = (nuevos: readonly DegreeSymbol[]): PasoPosible[] =>
    nuevos.map((degree, i) =>
      degree === grados[i]
        ? tuyo(id, original, i)
        : paso(degree, original[i]!.beats, null, especieNueva(id, degree, null)),
    );
  // Los compases se cuentan **dentro del coro nuevo** y se dice así —«en su compás
  // 9»—: «en el 9» de la canción entera es tu coro, que no cambia.
  const coro = (
    nuevos: readonly DegreeSymbol[],
    nombre: string,
    que: string,
    valor: number,
    familia: string,
  ): Borrador => ({
    path: 'seguir',
    partes: [{ name: 'Otro coro', yours: false, steps: montar(nuevos) }],
    loQueSeAnade: 'misma',
    nombre,
    que: `Añade otro coro de doce compases, ${que}.`,
    prioridad: prioridadDe(valor),
    familia,
  });
  const delBlues = id.estilo === 'blues' ? 0.5 : 0;
  const cambio = conCambio[1] === cuarto ? 'con' : 'sin';
  return [
    coro(cierra, 'Otro coro que cierra', como, 2.5 + delBlues, 'coro'),
    coro(
      conCambio,
      `Otro coro ${cambio} cambio rápido`,
      `${cambio} el cambio rápido al ${cuarto} en su compás 2, y acaba en la ${tonica}`,
      2.2 + delBlues,
      'coro-cambio',
    ),
    coro(
      deJazz,
      `Otro coro con ${segundo} V en su compás 9`,
      `con ${segundo} V en sus compases 9 y 10, el giro del blues de jazz, y acaba en la ${tonica}`,
      1.6 + id.secundaria + (id.estilo === 'jazz' ? 0.6 : 0),
      'coro-jazz',
    ),
    coro(
      conII7,
      'Otro coro con el II7 en su compás 9',
      `con el II7, la dominante de la dominante, en su compás 9, y acaba en la ${tonica}`,
      1.6 + id.secundaria,
      'coro-ii7',
    ),
    coro(
      diez,
      `Otro coro con el ${diez[9]} en su compás 10`,
      `con el ${diez[9]} en su compás 10, y acaba en la ${tonica}`,
      2,
      'coro-diez',
    ),
    coro(
      conVI7,
      'Otro coro con el VI7 en su compás 8',
      `con el VI7 en su compás 8, que lleva al ii del 9 y al V del 10, y acaba en la ${tonica}`,
      1.5 + id.secundaria,
      'coro-vi7',
    ),
  ];
}
