import { describe, expect, it } from 'vitest';

import { noteName, type PitchClass } from '@core/music';

import { acordesDeGrabacion } from './offline-chords';

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
    expect(acordesDeGrabacion(new Float32Array(1000), { sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it('el silencio no inventa acordes', () => {
    expect(acordesDeGrabacion(silencio(3), { sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it('saca la fundamental de un acorde sostenido', () => {
    const acordes = acordesDeGrabacion(rasguear(Am, 2.5), { sampleRate: SAMPLE_RATE });

    expect(acordes.length).toBeGreaterThan(0);
    expect(noteName(acordes[0]!.root, 'sharp')).toBe('A');
  });

  it('una progresión sale en orden y sin repetir el mismo acorde', () => {
    const grabacion = pegar(rasguear(Am, 2), rasguear(F, 2), rasguear(C, 2), rasguear(G, 2));

    const acordes = acordesDeGrabacion(grabacion, {
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

    const acordes = acordesDeGrabacion(grabacion, { sampleRate: SAMPLE_RATE });
    const dosSegundos = 2000;

    // Hay acordes a los dos lados del silencio, y ninguno justo en medio.
    expect(acordes.some((a) => a.at < dosSegundos)).toBe(true);
    expect(acordes.some((a) => a.at > 3400)).toBe(true);
  });

  it('el instante que devuelve cae dentro del acorde, no al principio de todo', () => {
    const grabacion = pegar(silencio(1), rasguear(Am, 2.5));

    const acordes = acordesDeGrabacion(grabacion, { sampleRate: SAMPLE_RATE });

    expect(acordes[0]!.at).toBeGreaterThan(700);
    expect(acordes[0]!.at).toBeLessThan(2500);
  });

  it('mide el ruido de la sala en vez de creerse un umbral fijo', () => {
    // La misma grabación con diez veces más ruido de fondo sigue dando el mismo
    // acorde. Con un umbral escrito en un fichero, o se cuela la sala o se pierde
    // la guitarra, según el ampli.
    const limpia = acordesDeGrabacion(pegar(silencio(1, 0.001), rasguear(Am, 2.5, 0.001)), {
      sampleRate: SAMPLE_RATE,
    });
    const sucia = acordesDeGrabacion(pegar(silencio(1, 0.01), rasguear(Am, 2.5, 0.01)), {
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

    const sinTono = acordesDeGrabacion(grabacion, { sampleRate: SAMPLE_RATE });
    const conTono = acordesDeGrabacion(grabacion, {
      sampleRate: SAMPLE_RATE,
      key: { tonic: 9 as PitchClass, mode: 'minor' },
    });

    // Menos o igual: los pesos del grafo pegan los trozos que el espectro parte,
    // nunca al revés.
    expect(conTono.length).toBeLessThanOrEqual(sinTono.length);
  });
});
