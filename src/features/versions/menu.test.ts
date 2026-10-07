import { describe, expect, it, vi } from 'vitest';

import type * as Music from '@core/music';

import type { VersionsRequest } from './contract';

/**
 * El menú y los motivos del juez que lleva cada salida, con un menú fijo.
 *
 * Qué salidas hay y qué dice de ellas el juez lo decide el dominio, y lo está
 * afinando otra mano; lo que se defiende aquí es cómo se eligen los motivos que se
 * le enseñan al modelo: los que se oyen antes que la aritmética, los que
 * distinguen a una salida de las demás, uno por enlace y solo los que se sostienen.
 */

const salidasPosibles = vi.fn();

vi.mock('@core/music', async (original) => ({
  ...(await original<typeof Music>()),
  salidasPosibles: (...args: unknown[]) => salidasPosibles(...args),
}));

const {
  lasTresMejores,
  lineaDeSalida,
  MAX_CARACTERES_DEL_MENU,
  MAX_OPCIONES_DEL_MENU,
  menuDe,
  PEOR_DE_VERDAD,
  salidasDe,
  soloExplica,
} = await import('./menu');

const PETICION: VersionsRequest = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: [
    { degree: 'I', beats: 4 },
    { degree: 'IV', beats: 4 },
  ],
};

function salida(nombre: string, criterios?: Music.Criterio[]): Music.SalidaPosible {
  return {
    path: 'rearmonizar',
    nombre,
    que: `Hace ${nombre}.`,
    colores: ['oscurece', 'abierto'],
    secciones: [{ name: 'Lo tuyo', yours: false, steps: [] }],
    ...(criterios === undefined ? {} : { encaje: { puntos: 80, descarte: null, criterios } }),
  };
}

const c = (id: Music.CriterioId, valor: number, motivo: string): Music.Criterio => ({
  id,
  valor,
  motivo,
});

describe('los motivos de cada salida', () => {
  it('lo que se oye antes que la aritmética, del más fuerte al más flojo', () => {
    salidasPosibles.mockReturnValue([
      salida('una', [
        c('novedad', 1, 'Cambia un solo compás.'),
        c('cadencia', 0.6, 'IV I en el 2: plagal.'),
        c('estilo', 0.9, 'IV I, la plagal del gospel.'),
      ]),
      salida('otra', []),
    ]);

    expect(menuDe(PETICION)[0]!.motivos).toEqual([
      'IV I, la plagal del gospel.',
      'IV I en el 2: plagal.',
    ]);
  });

  it('lo que no llega a medio punto, o no dice nada, no es una razón', () => {
    salidasPosibles.mockReturnValue([
      salida('una', [
        c('sintaxis', 0.04, 'V IV: vuelve sin resolver.'),
        c('cadencia', 0.8, ''),
        c('frase', 0.5, '4 compases.'),
      ]),
      salida('otra'),
    ]);

    expect(menuDe(PETICION)[0]!.motivos).toEqual(['4 compases.']);
  });

  it('lo que tienen todas no distingue a ninguna, salvo que sea la única', () => {
    const comun = c('ritmo-armonico', 1, 'Los acordes nuevos duran 4 pulsos.');
    salidasPosibles.mockReturnValue([
      salida('una', [comun, c('bajo', 0.7, 'IV I: el bajo baja una quinta.')]),
      salida('otra', [comun]),
    ]);
    expect(menuDe(PETICION)[0]!.motivos).toEqual(['IV I: el bajo baja una quinta.']);

    salidasPosibles.mockReturnValue([salida('sola', [comun])]);
    expect(menuDe(PETICION)[0]!.motivos).toEqual(['Los acordes nuevos duran 4 pulsos.']);
  });

  // Lo vio el corpus final: «A doble tiempo» salía con el porqué vacío, porque lo
  // único que el juez decía de ella lo decía también de las otras dos.
  it('una salida sin nada suyo se cuenta con lo que comparte, antes que sin porqué', () => {
    const comun = c('papel', 1, 'El estribillo empieza en i y cierra fuerte.');
    const otraComun = c('sintaxis', 0.8, 'VII i: cierra sin sensible.');
    salidasPosibles.mockReturnValue([
      salida('una', [comun, otraComun, c('cadencia', 0.9, 'VII i en el 4: cierra sin sensible.')]),
      salida('otra', [otraComun, comun, c('ritmo-armonico', 0.2, 'Corre más que lo tuyo.')]),
    ]);
    const [una, otra] = menuDe(PETICION);
    expect(una!.motivos).toEqual(['VII i en el 4: cierra sin sensible.']);
    expect(otra!.motivos).toEqual(['El estribillo empieza en i y cierra fuerte.']);
    // Lo que no se sostiene no entra ni así: pasa al siguiente, y sin ninguno, nada.
    expect(menuDe(PETICION, (motivo) => !motivo.includes('estribillo'))[1]!.motivos).toEqual([
      'VII i: cierra sin sensible.',
    ]);
    expect(menuDe(PETICION, (motivo) => motivo.includes('en el 4'))[1]!.motivos).toEqual([]);
  });

  it('un enlace contado dos veces es una razón, no dos', () => {
    salidasPosibles.mockReturnValue([
      salida('una', [
        c('notas-comunes', 1, 'V/vi vi en el 2: llega a lo que preparaba.'),
        c('sintaxis', 0.9, 'V/vi vi: V/vi llega a lo que preparaba.'),
        c('estilo', 0.6, 'La secundaria que levanta.'),
      ]),
      salida('otra'),
    ]);

    expect(menuDe(PETICION)[0]!.motivos).toEqual([
      'V/vi vi en el 2: llega a lo que preparaba.',
      'La secundaria que levanta.',
    ]);
  });

  /**
   * Filtrar solo quita, y después de elegir: la línea nunca crece, y el sitio que
   * se midió sin filtro vale con él.
   */
  it('con `sostiene`, solo los que pasan, sin traer otros en su lugar', () => {
    salidasPosibles.mockReturnValue([
      salida('una', [
        c('cadencia', 1, 'Vuelve por V I: resuelve en la tónica.'),
        c('estilo', 0.9, 'El eje del pop.'),
        c('sintaxis', 0.8, 'vi IV: baja a la subdominante.'),
      ]),
      salida('otra'),
    ]);

    const menu = menuDe(PETICION, (motivo) => !motivo.includes('tónica'));

    expect(menu[0]!.motivos).toEqual(['El eje del pop.']);
  });
  /**
   * Una línea sin porqué se quedaba con el de la de al lado: el modelo le prestaba
   * los motivos de la siguiente y nombraba acordes que no tenía.
   */
  it('si no pasa ninguno de los dos mejores, el siguiente que pase; y si ninguno, nada', () => {
    salidasPosibles.mockReturnValue([
      salida('una', [
        c('cadencia', 1, 'Vuelve por V I: resuelve en la tónica.'),
        c('sintaxis', 0.9, 'V I: la dominante resuelve en la tónica.'),
        c('bajo', 0.7, 'IV V: el bajo sube un tono.'),
        c('frase', 0.6, '8 compases.'),
      ]),
      salida('otra'),
    ]);

    expect(menuDe(PETICION, (motivo) => !motivo.includes('tónica'))[0]!.motivos).toEqual([
      'IV V: el bajo sube un tono.',
    ]);
    expect(menuDe(PETICION, () => false)[0]!.motivos).toEqual([]);
  });
});

/** La misma petición, con algo pedido: el modelo elige del menú entero. */
const CON_DIRECTRICES: VersionsRequest = { ...PETICION, directrices: 'más triste' };

describe('el menú', () => {
  it('con directrices, seis como mucho, y las mismas sin motivos para el contrato', () => {
    salidasPosibles.mockReturnValue(Array.from({ length: 9 }, (_, i) => salida(`s${i}`)));

    expect(soloExplica(CON_DIRECTRICES)).toBe(false);
    expect(salidasDe(CON_DIRECTRICES)).toHaveLength(MAX_OPCIONES_DEL_MENU);
    expect(salidasDe(CON_DIRECTRICES)).toEqual(menuDe(CON_DIRECTRICES).map((o) => o.salida));
  });

  /**
   * **Sin directrices el modelo no elige: explica.** Eligiendo entre seis sacaba
   * menos nota que el juez solo, porque se iba a una de la cuarta a la sexta; el
   * menú son entonces las tres mejores, numeradas del uno al tres.
   */
  it('sin directrices, las tres mejores, del uno al tres, y las mismas para el contrato', () => {
    salidasPosibles.mockReturnValue(MENU_VARIADO);
    const tuya = { ...PETICION, progression: TUYO };

    expect(soloExplica(tuya)).toBe(true);
    expect(salidasDe(tuya)).toEqual([MENU_VARIADO[0], MENU_VARIADO[2], MENU_VARIADO[3]]);
    expect(salidasDe(tuya)).toEqual(menuDe(tuya).map((o) => o.salida));
    // Con directrices, el menú entero por su orden.
    expect(salidasDe({ ...tuya, directrices: 'más triste' })).toEqual(MENU_VARIADO);
  });

  /** Los motivos, contra las seis: una salida se cuenta igual en los dos menús. */
  it('los motivos de las tres se escogen contra las seis', () => {
    const comun = c('ritmo-armonico', 1, 'Los acordes nuevos duran 4 pulsos.');
    const conMotivos = MENU_VARIADO.map((s, i) => ({
      ...s,
      encaje: {
        puntos: 80,
        descarte: null,
        // Lo tienen las tres mejores y no la segunda, que no entra: distingue.
        criterios: i === 1 ? [] : [comun],
      },
    }));
    salidasPosibles.mockReturnValue(conMotivos);

    expect(menuDe({ ...PETICION, progression: TUYO }).map((o) => o.motivos)).toEqual([
      ['Los acordes nuevos duran 4 pulsos.'],
      ['Los acordes nuevos duran 4 pulsos.'],
      ['Los acordes nuevos duran 4 pulsos.'],
    ]);
  });

  it('lo que no cabe en su sitio se corta por el final', () => {
    const larga = (i: number) =>
      salida(`s${i} ${'x'.repeat(180)}`, [
        c('estilo', 0.9, `${'e'.repeat(150)} ${i}.`),
        c('cadencia', 0.8, `${'k'.repeat(150)} ${i}.`),
      ]);
    salidasPosibles.mockReturnValue(Array.from({ length: 6 }, (_, i) => larga(i)));

    const menu = menuDe(CON_DIRECTRICES);
    const ocupa = menu.reduce(
      (total, { salida: s, motivos }, i) => total + lineaDeSalida(s, i + 1, motivos).length + 1,
      0,
    );

    expect(menu.length).toBeLessThan(6);
    expect(menu.map((o) => o.salida.nombre)).toEqual(
      Array.from({ length: menu.length }, (_, i) => larga(i).nombre),
    );
    expect(ocupa).toBeLessThanOrEqual(MAX_CARACTERES_DEL_MENU);
  });

  it('una línea sin motivos no lleva su «Por qué»', () => {
    expect(lineaDeSalida(salida('una'), 1)).toBe('1. rearmonizar: Hace una. [oscurece, abierto]');
    expect(lineaDeSalida(salida('una'), 2, ['Uno.', 'Dos.'])).toBe(
      '2. rearmonizar: Hace una. [oscurece, abierto] Por qué: Uno. Dos.',
    );
  });
});

const TUYO: VersionsRequest['progression'] = [
  { degree: 'I', beats: 4 },
  { degree: 'V', beats: 4 },
  { degree: 'vi', beats: 4 },
  { degree: 'IV', beats: 4 },
];

/** Una salida de retocar con estos grados, en una sola parte. */
function retoque(
  path: Music.PathId,
  nombre: string,
  grados: readonly Music.DegreeSymbol[],
  beats = 4,
): Music.SalidaPosible {
  return {
    path,
    nombre,
    que: `Lo que hace ${nombre}.`,
    colores: [],
    secciones: [
      {
        name: 'Lo tuyo',
        yours: false,
        steps: grados.map((degree) => ({ degree, beats, move: null })),
      },
    ],
  };
}

const MENU_VARIADO = [
  retoque('rearmonizar', 'Su relativo, en el 4', ['I', 'V', 'vi', 'ii']),
  // Lo que pone la de arriba está entero aquí: es la misma idea, más larga.
  retoque('rearmonizar', 'Su relativo, donde cabe', ['I', 'iii', 'vi', 'ii']),
  retoque('otro-final', 'Cierra en la tónica', ['I', 'V', 'IV', 'I']),
  // Otro camino con los mismos cambios no es la misma idea.
  retoque('estirar', 'A medio tiempo', ['I', 'V', 'vi', 'IV'], 8),
  retoque('rearmonizar', 'Su dominante delante, en el 2', ['I', 'V/vi', 'vi', 'IV']),
];

/**
 * Qué tres son las mejores, con un menú fijo.
 *
 * Lo que se defiende no depende de qué ordene el juez: que sean **tres ideas
 * distintas** por su orden y que una variante de otra ceda su sitio. Son las que
 * explica el modelo sin directrices y las que contesta el respaldo.
 */
describe('las tres mejores', () => {
  it('tres ideas distintas por su orden: la variante cede su sitio', () => {
    expect(lasTresMejores(MENU_VARIADO, TUYO)).toEqual([0, 2, 3]);
  });

  it('tres del mismo camino no, si hay otro: la tercera cede su sitio', () => {
    const relativo = retoque('rearmonizar', 'Su relativo, en el 3', ['I', 'V', 'IV', 'IV']);
    const menu = [MENU_VARIADO[0]!, MENU_VARIADO[4]!, relativo, MENU_VARIADO[3]!];

    expect(lasTresMejores(menu, TUYO).map((i) => menu[i]!.nombre)).toEqual([
      'Su relativo, en el 4',
      'Su dominante delante, en el 2',
      'A medio tiempo',
    ]);
  });

  it('si no hay tres ideas distintas, completa con las que quedan, en su orden', () => {
    expect(lasTresMejores(MENU_VARIADO.slice(0, 3), TUYO)).toEqual([0, 1, 2]);
  });

  /** Una salida con sus puntos del juez, sin motivos. */
  const conPuntos = (s: Music.SalidaPosible, puntos: number): Music.SalidaPosible => ({
    ...s,
    encaje: { puntos, descarte: null, criterios: [] },
  });

  // El corpus final: en una estrofa a dos compases por acorde, la única que
  // respetaba el ritmo era la tercera de su camino, y salía por un contraste peor.
  it('la tercera del mismo camino entra si lo de otro camino es claramente peor', () => {
    const relativo = retoque('rearmonizar', 'Su relativo, en el 3', ['I', 'V', 'IV', 'IV']);
    const menu = [
      conPuntos(MENU_VARIADO[0]!, 84),
      conPuntos(MENU_VARIADO[4]!, 83),
      conPuntos(relativo, 82),
      conPuntos(MENU_VARIADO[3]!, 82 - PEOR_DE_VERDAD - 1),
    ];
    expect(lasTresMejores(menu, TUYO).map((i) => menu[i]!.nombre)).toEqual([
      'Su relativo, en el 4',
      'Su dominante delante, en el 2',
      'Su relativo, en el 3',
    ]);
    // A la par, o sin puntos que comparar, manda la variedad, como siempre.
    const parejo = [...menu.slice(0, 3), conPuntos(MENU_VARIADO[2]!, 82 - PEOR_DE_VERDAD)];
    expect(lasTresMejores(parejo, TUYO).map((i) => parejo[i]!.nombre)).toContain(
      'Cierra en la tónica',
    );
    // Pero no a un relleno (`esRelleno`): los mismos acordes a otra velocidad solo
    // entran si no son peores. Cedían justo en el umbral (el quinto examen).
    const conRelleno = [...menu.slice(0, 3), conPuntos(MENU_VARIADO[3]!, 82 - PEOR_DE_VERDAD)];
    expect(lasTresMejores(conRelleno, TUYO)).toEqual([0, 1, 2]);
    const rellenoQueVale = [...menu.slice(0, 3), conPuntos(MENU_VARIADO[3]!, 82)];
    expect(lasTresMejores(rellenoQueVale, TUYO).map((i) => rellenoQueVale[i]!.nombre)).toContain(
      'A medio tiempo',
    );
    const sinPuntos = [menu[0]!, menu[1]!, relativo, MENU_VARIADO[3]!];
    expect(lasTresMejores(sinPuntos, TUYO).map((i) => sinPuntos[i]!.nombre)).toContain(
      'A medio tiempo',
    );
    const otraSinPuntos = [...menu.slice(0, 3), MENU_VARIADO[3]!];
    expect(lasTresMejores(otraSinPuntos, TUYO).map((i) => otraSinPuntos[i]!.nombre)).toContain(
      'A medio tiempo',
    );
    // Si no hay otro camino detrás, no hay a quién ceder.
    expect(lasTresMejores(menu.slice(0, 3), TUYO)).toEqual([0, 1, 2]);
  });

  it('con menos de tres, las que haya; con ninguna, ninguna', () => {
    expect(lasTresMejores(MENU_VARIADO.slice(0, 1), TUYO)).toEqual([0]);
    expect(lasTresMejores([], TUYO)).toEqual([]);
  });
});
