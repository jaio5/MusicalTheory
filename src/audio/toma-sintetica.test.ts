import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureProgression,
  frequencyToMidi,
  transcribirPunteo,
  type CapturedChord,
  type FotogramaDeTono,
  type LeadNote,
} from '@core/music';

import { AutocorrelationPitchEngine } from './autocorrelation-pitch-engine';
import { ChromaChordEngine } from './chord-engine';
import {
  EntradaGrabada,
  puntear,
  rasguear,
  sumarClic,
  type ClicDePrueba,
  type NotaTocada,
} from './guitarra-sintetica';
import { CORTE_DEL_ANALISIS_HZ } from './web-audio-input';

/**
 * **Una toma entera, con el clic sonando encima, escuchada por los motores de
 * verdad.**
 *
 * Es la medida que decidió cómo suena el clic y qué se le pone delante al
 * análisis, fijada para que no se pierda. Una guitarra sintética toca algo
 * conocido, el clic se suma a su volumen de fuga —0,6: un portátil con la
 * guitarra delante—, y el motor de tono y el de acordes lo escuchan análisis a
 * análisis como escuchan el micro. Lo que sale se compara con lo que se tocó.
 *
 * Las mismas tomas se midieron en Chromium con el micro falso, con el mismo
 * resultado; las cifras están en `docs/AUDIO-PITCH.md`.
 */

afterEach(() => {
  vi.useRealTimers();
});

const BPM = 90;
/** Segundos antes del compás uno: los dos compases de cuenta y un poco más. */
const ANTES = 5.6;
const COMPAS_UNO = ANTES * 1000;

/**
 * El punteo de la prueba: corcheas, negras, un silencio, una nota larga que
 * cruza la barra, semicorcheas, tres iguales re-atacadas y un Sol grave.
 */
const PUNTEO: readonly NotaTocada[] = (
  [
    [0, 0.5, 60],
    [0.5, 0.5, 62],
    [1, 0.5, 64],
    [1.5, 0.5, 65],
    [2, 1, 67],
    [3, 1, 69],
    [4, 0.5, 71],
    [4.5, 0.5, 72],
    [6, 1, 76],
    [7, 3, 74],
    [10, 0.25, 67],
    [10.25, 0.25, 69],
    [10.5, 0.25, 67],
    [10.75, 0.25, 65],
    [11, 1, 64],
    [12, 1, 64],
    [13, 1, 64],
    [14, 2, 62],
    [16, 1, 55],
    [17, 3, 60],
  ] as const
).map(([start, length, midi]) => ({ start, length, midi }));

/** Cada análisis del motor de tono sobre la señal, como los apunta la toma. */
function analizarTono(senal: Float32Array, pasoBajo: number | null): FotogramaDeTono[] {
  vi.useFakeTimers();
  let reloj = 0;
  const entrada = new EntradaGrabada(senal, () => reloj, pasoBajo);
  const motor = new AutocorrelationPitchEngine({ now: () => reloj });
  const fotogramas: FotogramaDeTono[] = [];
  motor.subscribeFrames((fotograma) =>
    fotogramas.push({
      at: fotograma.at,
      midi: fotograma.frequency === null ? null : frequencyToMidi(fotograma.frequency),
      clarity: fotograma.clarity,
      rms: fotograma.rms,
    }),
  );
  void motor.start(entrada);
  while (reloj < senal.length / 48) {
    reloj += 5;
    vi.advanceTimersByTime(5);
  }
  motor.stop();
  return fotogramas;
}

/** Lo que el motor de acordes va diciendo, como lo apunta la sesión. */
function analizarAcordes(senal: Float32Array, maxHz?: number): CapturedChord[] {
  vi.useFakeTimers();
  let reloj = 0;
  const entrada = new EntradaGrabada(senal, () => reloj, CORTE_DEL_ANALISIS_HZ);
  const motor = new ChromaChordEngine(maxHz === undefined ? {} : { maxHz });
  const oidos: CapturedChord[] = [];
  motor.subscribe((acorde) => {
    if (acorde !== null) {
      oidos.push({
        root: acorde.best.root,
        notes: acorde.best.notes,
        at: reloj,
        score: acorde.best.score,
        margin: acorde.margin,
        alternatives: acorde.alternatives,
      });
    }
  });
  void motor.start(entrada);
  while (reloj < senal.length / 48) {
    reloj += 5;
    vi.advanceTimersByTime(5);
  }
  motor.stop();
  return oidos;
}

/** Cuántas notas coinciden en altura, en ataque y en largo, y cuántas sobran. */
function comparar(notas: readonly LeadNote[]) {
  const usadas = new Set<number>();
  let altura = 0;
  let ataque = 0;
  let largo = 0;
  for (const verdad of PUNTEO) {
    const indice = notas.findIndex(
      (nota, i) => !usadas.has(i) && Math.abs(nota.start - verdad.start) <= 0.5,
    );
    if (indice === -1) {
      continue;
    }
    usadas.add(indice);
    const nota = notas[indice]!;
    altura += 60 + nota.offset === verdad.midi ? 1 : 0;
    ataque += nota.start === verdad.start ? 1 : 0;
    largo += nota.length === verdad.length ? 1 : 0;
  }
  return { altura, ataque, largo, fantasmas: notas.length - usadas.size };
}

function tomaDePunteo(clic: ClicDePrueba, pasoBajo: number | null) {
  const toma = { bpm: BPM, antes: ANTES, pulsos: 20 };
  const senal = puntear(PUNTEO, toma);
  sumarClic(senal, toma, clic);
  const { notes } = transcribirPunteo(analizarTono(senal, pasoBajo), {
    tonic: 0,
    bpm: BPM,
    startedAt: COMPAS_UNO,
    endedAt: COMPAS_UNO + 20 * (60_000 / BPM) + 900,
  });
  return comparar(notes);
}

describe('la entrada grabada', () => {
  // Siempre está abierta: arrancar y parar no cambian nada, y no avisa de nada
  // porque su estado no cambia nunca.
  it('esta siempre abierta, y lee ceros antes del principio', async () => {
    const entrada = new EntradaGrabada(new Float32Array(10).fill(0.5), () => 0);
    await entrada.start();
    await entrada.stop();
    entrada.subscribe()();
    expect(entrada.state).toBe('running');
    const bloque = new Float32Array(4);
    entrada.readTimeDomain(bloque);
    expect(Array.from(bloque)).toEqual([0, 0, 0, 0]);
  });
});

describe('un punteo con el clic sonando encima', () => {
  it('con el golpe de ruido y el paso bajo de la entrada, sale entero', () => {
    expect(tomaDePunteo('ruido', CORTE_DEL_ANALISIS_HZ)).toEqual({
      altura: 20,
      ataque: 20,
      largo: 20,
      fantasmas: 0,
    });
  }, 30_000);

  /**
   * **Por qué el clic cambió de timbre.** La onda cuadrada de antes tiene periodo
   * dentro del rango del motor: mete un Si 5 en el silencio y parte las notas
   * largas en el pulso donde suena. Con el paso bajo delante, igual: a 1000 Hz
   * pasa entera.
   */
  it('con la onda cuadrada de antes, entran fantasmas y se parten las largas', () => {
    const viejo = tomaDePunteo('cuadrado', CORTE_DEL_ANALISIS_HZ);
    expect(viejo.fantasmas).toBeGreaterThanOrEqual(2);
    expect(viejo.largo).toBeLessThan(20);
  }, 30_000);

  /**
   * **Y sin el paso bajo, también**, porque el golpe no tiene altura y lo que
   * deja en el nivel no llega a la mitad del ataque de una nota: no la parte. El
   * paso bajo es la segunda red —le quita al clic veinte decibelios más—, y la
   * que cubre el caso que esta guitarra no prueba: un clic más fuerte que la
   * cuerda.
   */
  it('con el golpe de ruido y sin paso bajo, tambien sale entero', () => {
    expect(tomaDePunteo('ruido', null)).toEqual({
      altura: 20,
      ataque: 20,
      largo: 20,
      fantasmas: 0,
    });
  }, 30_000);
});

describe('una ritmica con el clic sonando encima', () => {
  const RITMICA = [
    { start: 0, beats: 4, midis: [48, 52, 55, 60, 64] }, // C
    { start: 4, beats: 4, midis: [45, 52, 57, 60, 64] }, // Am
    { start: 8, beats: 2, midis: [41, 48, 53, 57, 60, 65] }, // F
    { start: 10, beats: 2, midis: [43, 47, 50, 55, 59, 67] }, // G
    { start: 12, beats: 4, midis: [48, 52, 55, 60, 64] }, // C
  ];

  function tomaDeRitmica(maxHz?: number) {
    const toma = { bpm: BPM, antes: ANTES, pulsos: 16 };
    const senal = rasguear(RITMICA, toma);
    sumarClic(senal, toma, 'ruido');
    const fin = COMPAS_UNO + 16 * (60_000 / BPM);
    return captureProgression(analizarAcordes(senal, maxHz), {
      tonic: 0,
      mode: 'major',
      bpm: BPM,
      beatsPerBar: 4,
      startedAt: COMPAS_UNO,
      endedAt: fin + 900,
      sonoHasta: fin,
    }).steps.map((paso) => `${paso.degree}/${paso.beats}`);
  }

  /**
   * Cada cambio cae en su pulso, también el de mitad de compás, **y el La menor
   * se lee La menor**. Antes se leía Esus4 y luego C6 y se quedaba pegado al Do de
   * antes: el séptimo armónico del La grave, un Sol, no se descontaba, y el empate
   * entre `Am7` y `C6` —las mismas cuatro notas— lo ganaba el Do por salir antes
   * en el bucle. Ahora el armónico se mide en su serie y el empate lo decide el
   * bajo ([adr/0107](../../docs/adr/0107-los-armonicos-se-miden-en-su-serie.md)).
   */
  it('los cambios caen en su pulso, y el La menor se lee La menor', () => {
    expect(tomaDeRitmica()).toEqual(['I/4', 'vi/4', 'IV/2', 'V/2', 'I/4']);
  }, 30_000);

  /**
   * **Mirando hasta 2200 Hz, con el descuento de antes, los armónicos lo tapaban
   * todo** y no salía ni un acorde: por eso el motor mira hasta mil. Con el
   * descuento por la serie esta toma ya sale entera; el techo se queda por lo
   * medido en diferido, que es donde mirar arriba sigue costando aciertos.
   */
  it('mirando hasta 2200 Hz, el descuento por la serie aguanta', () => {
    expect(tomaDeRitmica(2200)).toEqual(['I/4', 'vi/4', 'IV/2', 'V/2', 'I/4']);
  }, 30_000);
});
