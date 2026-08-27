import { describe, expect, it } from 'vitest';

import { canRecord, MAX_RECORDING_SECONDS } from './recorder';

/**
 * Si una entrada de audio sabe además guardar el sonido.
 *
 * Es un puerto aparte y no dos métodos más en `AudioInput` a propósito: no toda
 * entrada sabe grabar —los dobles de los tests no— y meterlo en la interfaz
 * grande obligaría a que todos fingieran saber hacerlo. Esta comprobación es lo
 * que permite tenerlo aparte sin que quien llama tenga que preguntar.
 */

describe('si esta entrada sabe grabar', () => {
  it('sabe la que tiene los dos metodos', () => {
    expect(canRecord({ startRecording: () => true, stopRecording: async () => null })).toBe(true);
  });

  it('no la que tiene solo uno', () => {
    // Media interfaz es peor que ninguna: se empezaría a grabar y no habría
    // forma de parar.
    expect(canRecord({ startRecording: () => true })).toBe(false);
    expect(canRecord({ stopRecording: async () => null })).toBe(false);
  });

  it('ni un doble de test, ni nada que no sea un objeto', () => {
    for (const cosa of [null, undefined, 'una cadena', 42, () => true, {}]) {
      expect(canRecord(cosa), String(cosa)).toBe(false);
    }
  });
});

describe('el tope de lo que se guarda', () => {
  it('son tres minutos, y no es una regla musical', () => {
    // A 48 kHz son 34 MB de números en memoria. Un trozo para componer son
    // treinta segundos; esto es el tope por si alguien deja el botón puesto.
    expect(MAX_RECORDING_SECONDS).toBe(180);
  });
});
