import { describe, expect, it } from 'vitest';

import type { KeyMode } from '../keys';
import type { DegreeSymbol } from '../progressions';
import {
  andaluzaFrigia,
  centroFrigio,
  compasesDe,
  formasDe,
  pasosDelTramo,
  reposoFrigio,
  type AcordeDelCompas,
  type Compas,
} from './formas';

/**
 * Lo tuyo escrito como se lee: compases separados por `|` y, dentro de uno, los
 * acordes que lo reparten a partes iguales. `I vi | ii V` son dos compases de 4/4.
 */
function compases(texto: string, pulsos = 4): Compas[] {
  return texto.split('|').flatMap((trozo) => {
    const enEste = trozo.trim().split(/\s+/u) as DegreeSymbol[];
    // Un compás por grado si no hay barras: `I vi ii V` son cuatro compases.
    if (!texto.includes('|')) {
      return enEste.map((degree) => [{ degree, beats: pulsos }]);
    }
    return [enEste.map((degree) => ({ degree, beats: pulsos / enEste.length }))];
  });
}

function formas(mode: KeyMode, texto: string) {
  return formasDe(mode, compases(texto));
}

describe('lo tuyo en compases', () => {
  it('un acorde de dos compases suena en los dos, y dos de medio comparten uno', () => {
    const pasos: AcordeDelCompas[] = [
      { degree: 'I', beats: 8 },
      { degree: 'ii', beats: 2 },
      { degree: 'V', beats: 2 },
    ];
    expect(compasesDe(pasos, 4)).toEqual([
      [{ degree: 'I', beats: 4 }],
      [{ degree: 'I', beats: 4 }],
      [
        { degree: 'ii', beats: 2 },
        { degree: 'V', beats: 2 },
      ],
    ]);
    // Uno que cruza la barra se parte por ella.
    expect(
      compasesDe(
        [
          { degree: 'I', beats: 3 },
          { degree: 'V', beats: 3 },
        ],
        2,
      ),
    ).toEqual([
      [{ degree: 'I', beats: 2 }],
      [
        { degree: 'I', beats: 1 },
        { degree: 'V', beats: 1 },
      ],
      [{ degree: 'V', beats: 2 }],
    ]);
  });

  it('sin compases enteros no hay secciones que contar', () => {
    expect(compasesDe([{ degree: 'I', beats: 6 }], 4)).toBeNull();
    expect(compasesDe([], 4)).toBeNull();
    expect(compasesDe([{ degree: 'I', beats: 4 }], 0)).toBeNull();
    expect(compasesDe([{ degree: 'I', beats: 4 }], 2.5)).toBeNull();
    expect(compasesDe([{ degree: 'I', beats: 1.5 }], 1)).toBeNull();
    expect(compasesDe([{ degree: 'I', beats: 0 }], 4)).toBeNull();
  });
});

describe('los pasos de un tramo', () => {
  const pasos = [
    { degree: 'I', beats: 4, especie: 'major7' },
    { degree: 'vi', beats: 4 },
    { degree: 'ii', beats: 2 },
    { degree: 'V', beats: 2 },
    { degree: 'I', beats: 8 },
  ] as const;

  it('son los tuyos tal cual, con lo que lleven', () => {
    expect(pasosDelTramo(pasos, 4, { desde: 0, compases: 2 })).toEqual([pasos[0], pasos[1]]);
    expect(pasosDelTramo(pasos, 4, { desde: 2, compases: 1 })).toEqual([pasos[2], pasos[3]]);
    expect(pasosDelTramo(pasos, 4, { desde: 3, compases: 2 })).toEqual([pasos[4]]);
  });

  it('nulo si un acorde cruza el borde o el tramo se sale de lo tuyo', () => {
    expect(pasosDelTramo(pasos, 4, { desde: 3, compases: 1 })).toBeNull();
    expect(pasosDelTramo(pasos, 4, { desde: 4, compases: 2 })).toBeNull();
    expect(pasosDelTramo(pasos, 4, { desde: 5, compases: 1 })).toBeNull();
    expect(pasosDelTramo(pasos, 2, { desde: 0, compases: 1 })).toBeNull();
  });
});

describe('el periodo', () => {
  it('una frase que se queda abierta es un antecedente: le falta el consecuente', () => {
    expect(formas('major', 'I vi IV V')).toEqual([
      {
        forma: 'periodo',
        compasesPorSeccion: 4,
        secciones: ['antecedente'],
        paralelo: true,
        falta: {
          que: 'consecuente',
          compases: 4,
          repite: { desde: 0, compases: 2 },
          acaba: 'en-la-tonica',
          noEmpiezaComo: null,
          vuelveA: null,
        },
      },
    ]);
    // En menor igual, y con ocho compases el consecuente es de ocho.
    expect(formas('minor', 'i iv V V')[0]!.falta!.que).toBe('consecuente');
    const deOcho = formas('major', 'I I vi vi IV IV ii V');
    expect(deOcho).toHaveLength(1);
    expect(deOcho[0]!.compasesPorSeccion).toBe(8);
    expect(deOcho[0]!.falta!.repite).toEqual({ desde: 0, compases: 4 });
  });

  it('una frase que ya cierra no pide consecuente', () => {
    expect(formas('major', 'I vi V I')).toEqual([]);
    expect(formas('minor', 'i iv V i')).toEqual([]);
  });

  it('antecedente abierto y consecuente que cierra con la misma cabeza: paralelo y entero', () => {
    const [periodo, aaba] = formas('major', 'I IV V V I IV V I');
    expect(periodo).toEqual({
      forma: 'periodo',
      compasesPorSeccion: 4,
      secciones: ['antecedente', 'consecuente'],
      paralelo: true,
      falta: null,
    });
    // Y también son las dos A de una AABA: le falta la B, que no empieza como ellas
    // y vuelve a su primer acorde.
    expect(aaba).toEqual({
      forma: 'aaba',
      compasesPorSeccion: 4,
      secciones: ['a', 'a'],
      paralelo: true,
      falta: {
        que: 'b',
        compases: 4,
        repite: null,
        acaba: 'abierta',
        noEmpiezaComo: { desde: 0, compases: 2 },
        vuelveA: 'I',
      },
    });
  });

  it('con otra cabeza es un periodo contrastante, y no unas A', () => {
    expect(formas('major', 'I IV V V vi ii V I')).toEqual([
      {
        forma: 'periodo',
        compasesPorSeccion: 4,
        secciones: ['antecedente', 'consecuente'],
        paralelo: false,
        falta: null,
      },
    ]);
  });

  it('llegar a la tónica desde el vi no es cerrar', () => {
    const encontradas = formas('major', 'I IV V V I IV vi I');
    expect(encontradas.map((forma) => forma.forma)).toEqual(['aaba']);
  });

  it('un compás con dos acordes cuenta como se toca', () => {
    const encontradas = formas('major', 'I | vi | ii V | V | I | vi | ii V | I');
    expect(encontradas[0]).toMatchObject({ forma: 'periodo', paralelo: true, falta: null });
  });
});

describe('la AABA', () => {
  it('dos A que acaban abiertas: falta la B, no hay periodo', () => {
    expect(formas('major', 'I vi ii V I vi ii V')).toEqual([
      expect.objectContaining({ forma: 'aaba', secciones: ['a', 'a'] }),
    ]);
  });

  it('A A B: falta la última A, y repite la A que ya cierra', () => {
    // La segunda A cierra: la última es ella otra vez.
    const [aab] = formas('major', 'I vi ii V I vi V I IV IV ii V');
    expect(aab).toEqual({
      forma: 'aaba',
      compasesPorSeccion: 4,
      secciones: ['a', 'a', 'b'],
      paralelo: true,
      falta: {
        que: 'ultima-a',
        compases: 4,
        repite: { desde: 4, compases: 4 },
        acaba: 'en-la-tonica',
        noEmpiezaComo: null,
        vuelveA: null,
      },
    });
    // Si solo cierra la primera, la primera.
    expect(formas('major', 'I IV V I I IV V V vi vi ii V')[0]!.falta!.repite).toEqual({
      desde: 0,
      compases: 4,
    });
    // Y si no cierra ninguna, su cabeza y un final en casa.
    expect(formas('major', 'I vi ii V I vi ii V IV IV ii V')[0]!.falta).toMatchObject({
      repite: { desde: 0, compases: 2 },
      acaba: 'en-la-tonica',
    });
  });

  it('A A B A entera, de cuatro y de ocho', () => {
    expect(formas('major', 'I vi ii V I vi V I IV IV ii V I vi V I')).toEqual([
      {
        forma: 'aaba',
        compasesPorSeccion: 4,
        secciones: ['a', 'a', 'b', 'a'],
        paralelo: true,
        falta: null,
      },
    ]);
    // La de los estándares: treinta y dos compases, A de ocho.
    // Una A de ocho que no es una de cuatro dos veces: si lo fuera, serían dos A.
    const a = 'I vi ii V iii V/ii ii V';
    const a2 = 'I vi ii V ii V I I';
    const b = 'V/vi V/vi vi vi V/V V/V V V';
    expect(formas('major', `${a} ${a2} ${b} ${a2}`)).toEqual([
      expect.objectContaining({ compasesPorSeccion: 8, secciones: ['a', 'a', 'b', 'a'] }),
    ]);
  });

  it('en menor igual', () => {
    expect(formas('minor', 'i iv V i i iv V i VI VI ii° V')[0]).toMatchObject({
      forma: 'aaba',
      secciones: ['a', 'a', 'b'],
    });
  });

  it('una B que empieza como la A no contrasta, y una última A con otra cabeza no vuelve', () => {
    expect(formas('major', 'I vi ii V I vi V I I IV ii V')).toEqual([]);
    expect(formas('major', 'I vi ii V I vi V I IV IV ii V vi vi V I')).toEqual([]);
    // Ni hay B si las dos primeras no son la misma A.
    expect(formas('major', 'I vi ii V IV vi V I IV IV ii V')).toEqual([]);
  });
});

describe('lo que no es una forma', () => {
  it('ni lo quieto, ni un vaivén, ni lo que no cuadra', () => {
    expect(formas('major', 'I I I I')).toEqual([]);
    expect(formas('major', 'I IV I IV I IV I IV')).toEqual([]);
    expect(formas('major', 'I vi IV V I')).toEqual([]);
    // Cinco secciones de cuatro ya no son ninguna de las dos.
    expect(formas('major', 'I vi ii V '.repeat(5).trim())).toEqual([]);
  });

  it('una primera frase que cierra y una segunda distinta no son dos secciones', () => {
    // De cuatro en cuatro no hay nada; de ocho, es una frase larga que se queda
    // abierta: el antecedente de un periodo de dieciséis.
    expect(formas('major', 'I IV V I vi ii V V')).toEqual([
      expect.objectContaining({ compasesPorSeccion: 8, secciones: ['antecedente'] }),
    ]);
  });

  it('un blues de doce no se confunde con unas A: empiezan distinto', () => {
    expect(formas('major', 'I I I I IV IV I I V IV I I')).toEqual([]);
    expect(formas('major', 'I IV I I IV IV I I')).toEqual([]);
  });
});

describe('la andaluza que reposa en su V', () => {
  it('en La menor, Am G F E reposa en el Mi y llega por el Fa', () => {
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'V'])).toEqual({
      centro: 'V',
      semitono: 'VI',
    });
    // Con cada acorde dos compases, o dos vueltas, igual.
    expect(andaluzaFrigia('minor', ['i', 'i', 'VII', 'VII', 'VI', 'VI', 'V', 'V'])).not.toBeNull();
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'V', 'i', 'VII', 'VI', 'V'])).not.toBeNull();
    // Y la bajada antes y el semitono que vuelve a caer al final.
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'V', 'VI', 'V'])).not.toBeNull();
  });

  it('escrita en el mayor relativo, su centro es el V/vi', () => {
    expect(andaluzaFrigia('major', ['vi', 'V', 'IV', 'V/vi'])).toEqual({
      centro: 'V/vi',
      semitono: 'IV',
    });
  });

  it('lo que resuelve a la i, acaba en un acorde menor o no baja, no reposa en el V', () => {
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'V', 'i'])).toBeNull();
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'v'])).toBeNull();
    expect(andaluzaFrigia('minor', ['i', 'iv', 'VI', 'V'])).toBeNull();
    expect(andaluzaFrigia('minor', ['i', 'VII', 'VI', 'VII'])).toBeNull();
    expect(andaluzaFrigia('minor', ['VII', 'VI', 'V'])).toBeNull();
    expect(andaluzaFrigia('minor', ['i', 'VII', 'IV' as DegreeSymbol, 'V'])).toBeNull();
  });
});

describe('el reposo frigio, una regla para todos', () => {
  it('una andaluza reposa en su centro por su semitono; con flamenco, también desde el iv', () => {
    expect(centroFrigio('minor', undefined, ['i', 'VII', 'VI', 'V'])).toEqual({
      centro: 'V',
      llegan: ['VI'],
    });
    expect(centroFrigio('minor', 'flamenco', ['i', 'VII', 'VI', 'V'])).toEqual({
      centro: 'V',
      llegan: ['VI', 'iv'],
    });
    // Escrita en el mayor relativo, su centro es el V/vi y llega por el IV.
    expect(centroFrigio('major', 'flamenco', ['vi', 'V', 'IV', 'V/vi'])).toEqual({
      centro: 'V/vi',
      llegan: ['IV'],
    });
    // Un flamenco que no baja entero también reposa en el V.
    expect(centroFrigio('minor', 'flamenco', ['i', 'iv', 'V', 'i'])).toEqual({
      centro: 'V',
      llegan: ['VI', 'iv'],
    });
    expect(centroFrigio('minor', 'rock', ['i', 'iv', 'V', 'i'])).toBeNull();
  });

  it('la canción llega a ese reposo, o no', () => {
    const andaluza: DegreeSymbol[] = ['i', 'VII', 'VI', 'V'];
    expect(
      reposoFrigio('minor', undefined, andaluza, [...andaluza, 'i', 'III', 'VI', 'V', 'V']),
    ).toBe(7);
    expect(reposoFrigio('minor', undefined, andaluza, [...andaluza, 'i', 'iv', 'V'])).toBeNull();
    expect(reposoFrigio('minor', undefined, andaluza, [...andaluza, 'i'])).toBeNull();
    expect(reposoFrigio('minor', 'flamenco', ['i', 'iv'], ['i', 'iv', 'V'])).toBe(2);
    expect(reposoFrigio('minor', undefined, ['i', 'iv'], ['i', 'iv', 'V'])).toBeNull();
  });
});
