import { describe, expect, it } from 'vitest';

import type { TimedEvent } from './playback';

import { ficheroMidi, nombreDeFichero } from './midi';

/** Lee un número de varios bytes, que es como se comprueba un fichero binario. */
function numero(bytes: Uint8Array, desde: number, largo: number): number {
  let valor = 0;
  for (let i = 0; i < largo; i += 1) valor = valor * 256 + bytes[desde + i]!;
  return valor;
}

function texto(bytes: Uint8Array, desde: number, largo: number): string {
  return String.fromCodePoint(...bytes.slice(desde, desde + largo));
}

const OPCIONES = { nombre: 'Mi canción', bpm: 120, beatsPerBar: 4 };

describe('El fichero MIDI de una canción', () => {
  it('empieza por una cabecera de formato 0 con una pista', () => {
    const fichero = ficheroMidi([], OPCIONES);

    expect(texto(fichero, 0, 4)).toBe('MThd');
    expect(numero(fichero, 4, 4)).toBe(6);
    // Formato 0, una pista, 480 pulsos por negra.
    expect(numero(fichero, 8, 2)).toBe(0);
    expect(numero(fichero, 10, 2)).toBe(1);
    expect(numero(fichero, 12, 2)).toBe(480);
    expect(texto(fichero, 14, 4)).toBe('MTrk');
    // Y el largo que declara es el que tiene.
    expect(numero(fichero, 18, 4)).toBe(fichero.length - 22);
  });

  it('guarda el tempo en microsegundos por negra', () => {
    const fichero = ficheroMidi([], { ...OPCIONES, bpm: 120 });

    // 60.000.000 / 120 = 500.000, que es el medio segundo por negra de siempre.
    const i = fichero.indexOf(0x51);
    expect(numero(fichero, i + 2, 3)).toBe(500_000);
  });

  it('guarda el compás que tenga la canción', () => {
    const fichero = ficheroMidi([], { ...OPCIONES, beatsPerBar: 3 });

    const i = fichero.indexOf(0x58);
    // Tres por negra: el denominador va como potencia de dos.
    expect([...fichero.slice(i + 2, i + 6)]).toEqual([3, 2, 24, 8]);
  });

  it('escribe un acorde como tres notas que entran a la vez y salen juntas', () => {
    const acorde: TimedEvent = { startBeat: 0, beats: 4, midis: [60, 64, 67] };

    const fichero = ficheroMidi([acorde], OPCIONES);

    // Tres encendidos y tres apagados.
    expect([...fichero].filter((b) => b === 0x90)).toHaveLength(3);
    expect([...fichero].filter((b) => b === 0x80)).toHaveLength(3);
  });

  /**
   * **Lo que rompe si el orden es el otro.** Dos bloques seguidos con la misma
   * nota comparten el instante de la frontera: encendiendo primero, el apagado
   * del anterior mata al que acaba de entrar y se pierde un acorde.
   */
  it('apaga antes de encender cuando dos bloques comparten la frontera', () => {
    const eventos: readonly TimedEvent[] = [
      { startBeat: 0, beats: 2, midis: [60] },
      { startBeat: 2, beats: 2, midis: [60] },
    ];

    const fichero = ficheroMidi(eventos, OPCIONES);

    const ordenes = [...fichero].filter((b) => b === 0x90 || b === 0x80);
    expect(ordenes).toEqual([0x90, 0x80, 0x90, 0x80]);
  });

  it('una nota que redondea a cero dura un pulso de reloj, no cero', () => {
    const fichero = ficheroMidi([{ startBeat: 0, beats: 0.0001, midis: [60] }], OPCIONES);

    // Si durase cero, el encendido y el apagado caerían en el mismo tick y no
    // sonaría nada en ningún secuenciador.
    const apagado = fichero.lastIndexOf(0x80);
    expect(fichero[apagado - 1]).toBe(1);
  });

  it('acaba con el final de pista', () => {
    const fichero = ficheroMidi([], OPCIONES);

    expect([...fichero.slice(-3)]).toEqual([0xff, 0x2f, 0x00]);
  });

  it('recorta un nombre larguísimo y se queda sin lo que no es ASCII', () => {
    const fichero = ficheroMidi([], { ...OPCIONES, nombre: 'á'.repeat(200) + 'x'.repeat(200) });

    const i = fichero.indexOf(0x03);
    expect(fichero[i + 1]).toBe(127);
  });

  /** Una espera larga necesita más de un byte, que es de lo que va el formato. */
  it('escribe esperas largas en varios bytes', () => {
    const fichero = ficheroMidi([{ startBeat: 100, beats: 1, midis: [60] }], OPCIONES);

    // 100 pulsos son 48.000 ticks, que no caben en un byte ni en dos.
    const encendido = fichero.indexOf(0x90);
    expect(fichero[encendido - 1]! & 0x80).toBe(0);
    expect(fichero[encendido - 2]! & 0x80).toBe(0x80);
  });
});

describe('El nombre del fichero', () => {
  it('quita acentos, espacios y lo que Windows no deja', () => {
    expect(nombreDeFichero('Canción: la buena / v2')).toBe('cancion-la-buena-v2.mid');
  });

  it('sin título usable, se llama cancion', () => {
    expect(nombreDeFichero('¿¡!?')).toBe('cancion.mid');
  });
});
