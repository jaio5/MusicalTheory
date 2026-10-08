import { describe, expect, it } from 'vitest';

import { writtenBlock, type Arrangement } from './arrangement';
import {
  escribirCopia,
  FORMATO_DE_LA_COPIA,
  leerCopia,
  nombreDeLaCopia,
  VERSION_DE_LA_COPIA,
  type CopiaDeLaCancion,
} from './copia-de-la-cancion';
import { DEFAULT_BEATS_PER_BAR, DEFAULT_BPM, MAX_BPM } from './tempo';

const MONTAJE: Arrangement = {
  parts: [
    {
      id: 'p1',
      name: 'Estrofa',
      blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'V', 4)],
      notes: [],
      bars: 2,
    },
  ],
};

const COPIA: CopiaDeLaCancion = {
  tonic: 7,
  mode: 'major',
  bpm: 96,
  beatsPerBar: 3,
  arrangement: MONTAJE,
};

/** Lo escrito, tocado a mano: como lo dejaría alguien en un editor de texto. */
function tocada(cambios: Record<string, unknown>): string {
  return JSON.stringify({ ...JSON.parse(escribirCopia(COPIA)), ...cambios });
}

describe('la copia de la canción', () => {
  it('lo escrito se vuelve a abrir igual', () => {
    expect(leerCopia(escribirCopia(COPIA))).toEqual(COPIA);
  });

  it('dice qué es y de qué versión, para no abrir un JSON cualquiera', () => {
    const escrito = JSON.parse(escribirCopia(COPIA)) as Record<string, unknown>;
    expect(escrito['formato']).toBe(FORMATO_DE_LA_COPIA);
    expect(escrito['version']).toBe(VERSION_DE_LA_COPIA);
  });

  it('lo que no es JSON, ni un objeto, no se abre', () => {
    expect(leerCopia('esto no es')).toBeNull();
    expect(leerCopia('[1, 2]')).toBeNull();
    expect(leerCopia('null')).toBeNull();
  });

  it('otro formato, otra versión o sin tonalidad no se abre', () => {
    expect(leerCopia(tocada({ formato: 'otra-cosa' }))).toBeNull();
    expect(leerCopia(tocada({ version: 2 }))).toBeNull();
    expect(leerCopia(tocada({ tonic: 12 }))).toBeNull();
    expect(leerCopia(tocada({ tonic: 'G' }))).toBeNull();
    expect(leerCopia(tocada({ mode: 'dorian' }))).toBeNull();
  });

  it('sin partes no hay canción que abrir', () => {
    expect(leerCopia(tocada({ arrangement: { parts: [] } }))).toBeNull();
    expect(leerCopia(tocada({ arrangement: 'nada' }))).toBeNull();
  });

  it('un tempo o un compás raros no la rechazan: se arreglan', () => {
    const fuera = leerCopia(tocada({ bpm: 9000, beatsPerBar: 7 }));
    expect(fuera?.bpm).toBe(MAX_BPM);
    expect(fuera?.beatsPerBar).toBe(DEFAULT_BEATS_PER_BAR);

    const sinNumero = leerCopia(tocada({ bpm: 'rápido' }));
    expect(sinNumero?.bpm).toBe(DEFAULT_BPM);
  });

  // Una copia hostil se guardaba en el navegador y tumbaba componer en cada
  // recarga: el filtro de la copia es el de lo guardado, y los dos la paran.
  it('una nota de un billón de pulsos o dos partes con el mismo identificador no pasan', () => {
    const parte = MONTAJE.parts[0]!;
    const hostil = {
      parts: [
        { ...parte, notes: [{ id: 'n', offset: 0, start: 1e12, length: 1 }] },
        { ...parte, name: 'Otra' },
      ],
    };

    const leida = leerCopia(tocada({ arrangement: hostil }));

    expect(leida?.arrangement.parts[0]?.notes).toEqual([]);
    expect(leida?.arrangement.parts.map((part) => part.id)).toEqual(['p1', 'p1~2']);
  });

  it('el nombre del fichero sigue la regla del MIDI', () => {
    expect(nombreDeLaCopia('Canción del sábado')).toBe('cancion-del-sabado.caos.json');
    expect(nombreDeLaCopia('')).toBe('cancion.caos.json');
  });
});
