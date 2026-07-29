/**
 * Cuánto cuesta el análisis en el hilo principal.
 *
 * [adr/0003](../../docs/adr/0003-analisis-en-el-hilo-principal.md) dejó el
 * análisis en el hilo principal y escribió que antes de mover nada había que
 * medir. Esto mide, y además fija el resultado: si alguien cambia el algoritmo
 * y el coste se dispara, este test lo dice.
 *
 * Los topes son deliberadamente holgados —un orden de magnitud sobre lo
 * medido— porque un test de tiempo en una máquina compartida que aprieta de
 * más falla por el ruido del vecino, no por el código. Lo que vigila es una
 * regresión algorítmica, no un 10 % arriba o abajo.
 *
 * Los números de referencia, y el porqué de dejarlo donde está, en el ADR.
 */

import { describe, expect, it } from 'vitest';

import { bestChord } from '@core/music';

import { detectPitch, signalRms } from './autocorrelation';
import { chromaFromSpectrum } from './chroma';

const SAMPLE_RATE = 48_000;
const FRAME_SIZE = 2048;
const SPECTRUM_SIZE = 8192;
const BINS = SPECTRUM_SIZE / 2;

/** Cadencia real de cada motor, de sus opciones por defecto. */
const PITCH_PER_SECOND = 20;
const CHORD_PER_SECOND = 10;

/** Una cuerda pulsada: fundamental y armónicos que caen, como suena de verdad. */
function guitarFrame(fundamental: number): Float32Array {
  const samples = new Float32Array(FRAME_SIZE);
  const partials = [1, 0.5, 0.32, 0.18, 0.11, 0.07];
  for (let i = 0; i < FRAME_SIZE; i += 1) {
    const t = i / SAMPLE_RATE;
    let value = 0;
    for (let h = 0; h < partials.length; h += 1) {
      value += partials[h]! * Math.sin(2 * Math.PI * fundamental * (h + 1) * t);
    }
    samples[i] = value * 0.25;
  }
  return samples;
}

/** Espectro en dB con un pico por parcial, sobre un suelo de ruido. */
function spectrumOf(frequencies: readonly number[], partialsPerNote: number): Float32Array {
  const binHz = SAMPLE_RATE / SPECTRUM_SIZE;
  const spectrum = new Float32Array(BINS);
  for (let bin = 0; bin < BINS; bin += 1) {
    spectrum[bin] = -110 + Math.sin(bin * 12.9898) * 3;
  }
  for (const frequency of frequencies) {
    for (let h = 1; h <= partialsPerNote; h += 1) {
      const bin = Math.round((frequency * h) / binHz);
      if (bin < 1 || bin >= BINS - 1) continue;
      const level = -12 - 8 * Math.log2(h);
      spectrum[bin - 1] = Math.max(spectrum[bin - 1]!, level - 14);
      spectrum[bin] = Math.max(spectrum[bin]!, level);
      spectrum[bin + 1] = Math.max(spectrum[bin + 1]!, level - 14);
    }
  }
  return spectrum;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Milisegundos por pasada: calienta, repite en rondas y se queda con la mediana. */
function msPerRun(runs: number, fn: () => void): number {
  for (let i = 0; i < 40; i += 1) fn();
  const rounds: number[] = [];
  for (let round = 0; round < 7; round += 1) {
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) fn();
    rounds.push((performance.now() - start) / runs);
  }
  return median(rounds);
}

const PITCH_OPTIONS = {
  sampleRate: SAMPLE_RATE,
  minFrequency: 70,
  maxFrequency: 1400,
  rmsThreshold: 0.006,
  clarityThreshold: 0.9,
};
const CHROMA_OPTIONS = { sampleRate: SAMPLE_RATE, fftSize: SPECTRUM_SIZE };

describe('coste del analisis en el hilo principal', () => {
  // E2 es el peor caso: el periodo más largo obliga al desplazamiento mayor.
  const frame = guitarFrame(82.41);
  // C mayor en posición abierta, y el mismo acorde con distorsión: más
  // parciales y más picos, que es lo que encarece el descuento de armónicos.
  const clean = spectrumOf([130.81, 164.81, 196.0, 261.63, 329.63], 6);
  const dirty = spectrumOf([130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25], 12);

  it('el motor de tono se mantiene por debajo de un milisegundo por analisis', () => {
    const ms = msPerRun(60, () => detectPitch(frame, PITCH_OPTIONS));
    expect(ms).toBeLessThan(8);
  });

  it('el motor de acordes cuesta mucho menos que el de tono', () => {
    const chroma = msPerRun(200, () => chromaFromSpectrum(dirty, CHROMA_OPTIONS));
    const vector = chromaFromSpectrum(clean, CHROMA_OPTIONS);
    const match = msPerRun(400, () => bestChord(vector, { minScore: 0.78 }));
    const pitch = msPerRun(60, () => detectPitch(frame, PITCH_OPTIONS));

    // Medido: el acorde sale unas quince veces más barato que el tono, aun con
    // el espectro sucio. Añadirlo no cambió el orden de magnitud del análisis,
    // que es justo lo que había que comprobar.
    expect(chroma + match).toBeLessThan(pitch);
  });

  it('los dos motores juntos no llegan al cinco por ciento del hilo', () => {
    const pitch =
      msPerRun(60, () => detectPitch(frame, PITCH_OPTIONS)) + msPerRun(400, () => signalRms(frame));
    const vector = chromaFromSpectrum(clean, CHROMA_OPTIONS);
    const chord =
      msPerRun(200, () => chromaFromSpectrum(dirty, CHROMA_OPTIONS)) +
      msPerRun(400, () => bestChord(vector, { minScore: 0.78 }));

    const msPerSecond = PITCH_PER_SECOND * pitch + CHORD_PER_SECOND * chord;
    expect(msPerSecond).toBeLessThan(50);
  });

  it('una rafaga de los dos a la vez cabe de sobra en un fotograma', () => {
    const burst =
      msPerRun(60, () => detectPitch(frame, PITCH_OPTIONS)) +
      msPerRun(200, () => chromaFromSpectrum(dirty, CHROMA_OPTIONS));

    // 16,7 ms es el fotograma a 60 fps. Si un análisis se lo come entero, la
    // aguja da tirones y hay que sacar el cálculo del hilo.
    expect(burst).toBeLessThan(16.7);
  });
});
