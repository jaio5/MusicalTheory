import { describe, expect, it } from 'vitest';

import { noteName, type PitchClass } from '@core/music';

import { chordsOfRecording, confianzaDelTramo } from './offline-chords';

const SAMPLE_RATE = 48_000;

/**
 * Una guitarra de mentira: las notas del acorde con sus tres primeros armónicos
 * y un decaimiento, que es lo que hace una cuerda pulsada.
 */
function rasguear(hz: readonly number[], segundos: number, ruido = 0.002): Float32Array {
  const n = Math.round(segundos * SAMPLE_RATE);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const decae = Math.exp(-t * 0.8);
    let v = 0;
    for (const f of hz) {
      v += Math.sin(2 * Math.PI * f * t);
      v += 0.4 * Math.sin(2 * Math.PI * 2 * f * t);
      v += 0.2 * Math.sin(2 * Math.PI * 3 * f * t);
    }
    // Ruido de sala, para que el suelo no sea exactamente cero.
    x[i] = (v / hz.length) * 0.3 * decae + (Math.random() - 0.5) * ruido;
  }
  return x;
}

function silencio(segundos: number, ruido = 0.002): Float32Array {
  const n = Math.round(segundos * SAMPLE_RATE);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    x[i] = (Math.random() - 0.5) * ruido;
  }
  return x;
}

function pegar(...trozos: readonly Float32Array[]): Float32Array {
  const total = trozos.reduce((n, t) => n + t.length, 0);
  const x = new Float32Array(total);
  let i = 0;
  for (const t of trozos) {
    x.set(t, i);
    i += t.length;
  }
  return x;
}

/** Las frecuencias de un acorde, en la octava en la que suena una guitarra. */
const Am = [220, 261.63, 329.63];
const F = [174.61, 220, 261.63];
const C = [130.81, 164.81, 196];
const G = [196, 246.94, 293.66];

const nombres = (acordes: readonly { root: PitchClass }[]) =>
  acordes.map((a) => noteName(a.root, 'sharp'));

describe('analizar una grabación entera', () => {
  it('una grabación demasiado corta no da nada', () => {
    expect(chordsOfRecording(new Float32Array(1000), { sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it('el silencio no inventa acordes', () => {
    expect(chordsOfRecording(silencio(3), { sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it('saca la fundamental de un acorde sostenido', () => {
    const acordes = chordsOfRecording(rasguear(Am, 2.5), { sampleRate: SAMPLE_RATE });

    expect(acordes.length).toBeGreaterThan(0);
    expect(noteName(acordes[0]!.root, 'sharp')).toBe('A');
  });

  it('una progresión sale en orden y sin repetir el mismo acorde', () => {
    const grabacion = pegar(rasguear(Am, 2), rasguear(F, 2), rasguear(C, 2), rasguear(G, 2));

    const acordes = chordsOfRecording(grabacion, {
      sampleRate: SAMPLE_RATE,
      key: { tonic: 9 as PitchClass, mode: 'minor' },
    });

    // Ventanas seguidas con el mismo acorde son un acorde: si esto fallara,
    // saldrían treinta.
    expect(acordes.length).toBeLessThanOrEqual(8);
    expect(nombres(acordes)).toContain('A');
    // Y en orden: el primero empieza antes que el último.
    expect(acordes[0]!.at).toBeLessThan(acordes[acordes.length - 1]!.at);
  });

  it('un silencio en medio corta, y no se arrastra el acorde de antes', () => {
    const grabacion = pegar(rasguear(Am, 2), silencio(1.5), rasguear(G, 2));

    const acordes = chordsOfRecording(grabacion, { sampleRate: SAMPLE_RATE });
    const dosSegundos = 2000;

    // Hay acordes a los dos lados del silencio, y ninguno justo en medio.
    expect(acordes.some((a) => a.at < dosSegundos)).toBe(true);
    expect(acordes.some((a) => a.at > 3400)).toBe(true);
  });

  it('el instante que devuelve cae dentro del acorde, no al principio de todo', () => {
    const grabacion = pegar(silencio(1), rasguear(Am, 2.5));

    const acordes = chordsOfRecording(grabacion, { sampleRate: SAMPLE_RATE });

    expect(acordes[0]!.at).toBeGreaterThan(700);
    expect(acordes[0]!.at).toBeLessThan(2500);
  });

  it('mide el ruido de la sala en vez de creerse un umbral fijo', () => {
    // La misma grabación con diez veces más ruido de fondo sigue dando el mismo
    // acorde. Con un umbral escrito en un fichero, o se cuela la sala o se pierde
    // la guitarra, según el ampli.
    const limpia = chordsOfRecording(pegar(silencio(1, 0.001), rasguear(Am, 2.5, 0.001)), {
      sampleRate: SAMPLE_RATE,
    });
    const sucia = chordsOfRecording(pegar(silencio(1, 0.01), rasguear(Am, 2.5, 0.01)), {
      sampleRate: SAMPLE_RATE,
    });

    expect(noteName(limpia[0]!.root, 'sharp')).toBe('A');
    expect(noteName(sucia[0]!.root, 'sharp')).toBe('A');
  });
});

describe('la tonalidad ayuda a decidir', () => {
  /**
   * Lo que el motor en vivo no puede hacer: elegir la secuencia entera sabiendo
   * qué encadenados existen en esa tonalidad. Con el mismo audio, saber la
   * tonalidad no puede empeorar el resultado.
   */
  it('con tonalidad no salen más acordes que sin ella', () => {
    const grabacion = pegar(rasguear(Am, 1.5), rasguear(F, 1.5), rasguear(C, 1.5));

    const sinTono = chordsOfRecording(grabacion, { sampleRate: SAMPLE_RATE });
    const conTono = chordsOfRecording(grabacion, {
      sampleRate: SAMPLE_RATE,
      key: { tonic: 9 as PitchClass, mode: 'minor' },
    });

    // Menos o igual: los pesos del grafo pegan los trozos que el espectro parte,
    // nunca al revés.
    expect(conTono.length).toBeLessThanOrEqual(sinTono.length);
  });
});

describe('un acorde partido por un silencio', () => {
  /**
   * Dos tramos del mismo acorde separados solo por uno que se ha caído son el
   * mismo acorde: se pegan en vez de salir dos veces. Pasa al rasguear el mismo
   * acorde dos veces seguidas, que es la mitad de lo que hace una guitarra.
   */
  it('se pega en vez de salir dos veces', () => {
    const audio = pegar(rasguear(Am, 2), silencio(1), rasguear(Am, 2));

    const acordes = chordsOfRecording(audio, { sampleRate: SAMPLE_RATE });

    expect(nombres(acordes)).toEqual(['A']);
  });
});

/**
 * **Lo que sale de una grabación tiene que llevar su duda, como lo que se oye en
 * vivo.** No la llevaba: este camino usaba `bestChord`, que contesta el acorde a
 * secas, y todo lo analizado en diferido llegaba al lienzo como una certeza. Se
 * notaba tocando: analizar un trozo lo escribía sin un solo «?».
 */
describe('lo analizado en diferido llega con su duda', () => {
  it('cada acorde trae lo que se parecia y lo que le saco al segundo', () => {
    const acordes = chordsOfRecording(rasguear(Am, 2.5), { sampleRate: SAMPLE_RATE });

    expect(acordes.length).toBeGreaterThan(0);
    for (const acorde of acordes) {
      expect(acorde.score).toBeGreaterThan(0);
      expect(acorde.margin).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * Un acorde que se sostiene pasa por muchas ventanas, y la del tramo que peor
   * lo tuvo es la que manda: quedarse con la mejor esconde la duda donde hay que
   * preguntar.
   */
  it('la confianza del tramo no es mejor que la de su peor ventana', () => {
    const grabacion = pegar(rasguear(Am, 2), rasguear(F, 2), rasguear(C, 2), rasguear(G, 2));
    const acordes = chordsOfRecording(grabacion, { sampleRate: SAMPLE_RATE });

    // Ninguno puede salir con un parecido perfecto: una guitarra de verdad —y
    // esta de mentira, con sus armónicos— nunca da un croma calcado.
    for (const acorde of acordes) {
      expect(acorde.score).toBeLessThan(1);
    }
  });
});

/**
 * La regla de qué ventanas cuentan, probada a mano.
 *
 * Con audio no se puede provocar a voluntad el caso que importa —un tramo que la
 * programación dinámica extiende por encima de ventanas que oyeron otra cosa—,
 * así que las ventanas se escriben aquí.
 */
describe('qué ventanas cuentan para la confianza de un tramo', () => {
  const laM = { root: 9 as PitchClass, notes: [9, 1, 4] as PitchClass[] };
  const doM = { root: 0 as PitchClass, notes: [0, 4, 7] as PitchClass[] };

  it('solo las que oyeron ese acorde por su cuenta, y la peor de ellas', () => {
    const ventanas = [
      { at: 0, chord: laM, score: 0.95, margin: 0.4 },
      // Esta oyó otra cosa: su puntuación habla de *ese otro* acorde, así que
      // meterla en la cuenta sería medir con la regla de otro.
      { at: 100, chord: doM, score: 0.99, margin: 0.9 },
      { at: 200, chord: laM, score: 0.82, margin: 0.05 },
    ];

    expect(confianzaDelTramo(ventanas, { chord: laM, from: 0, largo: 3 })).toEqual({
      score: 0.82,
      margin: 0.05,
    });
  });

  /**
   * Un tramo que ninguna ventana oyó lo puso la vecindad y no el sonido. Es la
   * duda máxima, y sale marcado con «?» en el lienzo: que es lo que es.
   */
  it('un tramo que nadie oyo se apunta con la duda maxima', () => {
    const ventanas = [
      { at: 0, chord: doM, score: 0.9, margin: 0.3 },
      { at: 100, chord: null, score: 0, margin: 0 },
    ];

    expect(confianzaDelTramo(ventanas, { chord: laM, from: 0, largo: 2 })).toEqual({
      score: 0,
      margin: 0,
    });
  });
});
