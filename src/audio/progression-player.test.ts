import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { midiToFrequency, type ScheduledStep } from '@core/music';

import { ponerAudioFalso, quitarAudioFalso, type ContextoDeAudioFalso } from './para-tests';
import { WebAudioProgressionPlayer } from './progression-player';

/**
 * Oír una progresión.
 *
 * Lo que hay que fijar es que **todo se programa de una vez contra el reloj del
 * audio**: una sola llamada deja colocados los tres acordes en sus instantes, sin
 * temporizadores encadenados que acumulen el retraso de cada uno. Con dos motores
 * de análisis corriendo, una progresión encadenada con `setTimeout` se arrastra.
 *
 * Lo otro que se ve aquí y no oyéndolo es el reparto del volumen: tres notas al
 * mismo volumen que una suenan tres veces más fuerte, y un acorde de cinco satura.
 */

const PROGRESION: ScheduledStep[] = [
  { index: 0, startMs: 0, durationMs: 1000, midis: [60, 64, 67] },
  { index: 1, startMs: 1000, durationMs: 1000, midis: [65, 69, 72] },
  { index: 2, startMs: 2000, durationMs: 1000, midis: [67, 71, 74] },
];

let contexto: ContextoDeAudioFalso;

beforeEach(() => {
  vi.useFakeTimers();
  contexto = ponerAudioFalso();
});

afterEach(() => {
  vi.useRealTimers();
  quitarAudioFalso();
});

describe('programar la progresion', () => {
  it('sin contexto de audio no revienta', async () => {
    quitarAudioFalso();

    await expect(new WebAudioProgressionPlayer().play(PROGRESION)).resolves.toBeUndefined();
  });

  it('una progresion vacia no crea nada', async () => {
    await new WebAudioProgressionPlayer().play([]);

    expect(contexto.osciladores).toHaveLength(0);
  });

  it('todo queda programado en una sola pasada', async () => {
    // Nueve notas colocadas antes de que pase un solo milisegundo del reloj de
    // JavaScript: eso es lo que no puede hacer una cadena de `setTimeout`.
    await new WebAudioProgressionPlayer().play(PROGRESION);

    expect(contexto.osciladores).toHaveLength(9);
    expect(contexto.osciladores.every((o) => o.empiezaEn !== null)).toBe(true);
  });

  it('cada acorde entra en su instante', async () => {
    await new WebAudioProgressionPlayer().play(PROGRESION);

    const entradas = [...new Set(contexto.osciladores.map((o) => o.empiezaEn))];

    expect(entradas).toEqual([0, 1, 2]);
  });

  it('cada nota suena a su frecuencia', async () => {
    await new WebAudioProgressionPlayer().play(PROGRESION);

    const primeras = contexto.osciladores.slice(0, 3).map((o) => o.frequency.cambios[0]!.valor);

    expect(primeras).toEqual([60, 64, 67].map(midiToFrequency));
  });

  it('el volumen se reparte entre las notas del acorde', async () => {
    // Fijo, un acorde de cinco satura.
    await new WebAudioProgressionPlayer().play([
      { index: 0, startMs: 0, durationMs: 1000, midis: [60] },
      { index: 1, startMs: 1000, durationMs: 1000, midis: [60, 64, 67, 71] },
    ]);

    const sola = contexto.osciladores[0]!.volumen;
    const enAcorde = contexto.osciladores[1]!.volumen;

    expect(enAcorde).toBeCloseTo(sola / 4, 5);
  });

  it('un acorde sin notas no divide entre cero', async () => {
    await new WebAudioProgressionPlayer().play([
      { index: 0, startMs: 0, durationMs: 500, midis: [] },
    ]);

    expect(contexto.osciladores).toHaveLength(0);
  });

  it('cada acorde acaba un poco antes que el siguiente', async () => {
    // Sin ese hueco, el final de un acorde y el principio del siguiente se
    // solapan y suena a barrido.
    await new WebAudioProgressionPlayer().play(PROGRESION);

    expect(contexto.osciladores[0]!.acabaEn!).toBeLessThan(1);
    expect(contexto.osciladores[0]!.acabaEn!).toBeGreaterThan(0.8);
  });

  it('un acorde cortisimo dura al menos lo que su envolvente', async () => {
    // Con menos, la nota se apagaría antes de haber llegado a su volumen.
    await new WebAudioProgressionPlayer().play([
      { index: 0, startMs: 0, durationMs: 10, midis: [60] },
    ]);

    expect(contexto.osciladores[0]!.acabaEn!).toBeGreaterThanOrEqual(0.09);
  });

  it('el contexto dormido se despierta', async () => {
    contexto.state = 'suspended';

    await new WebAudioProgressionPlayer().play(PROGRESION);

    expect(contexto.reanudaciones).toBe(1);
  });
});

describe('avisar a la pantalla', () => {
  it('dice qué acorde va sonando, y nulo al terminar', async () => {
    // Este aviso sí va con temporizador: si llega un fotograma tarde no se nota,
    // y usar el reloj del audio obligaría a un bucle de sondeo todo el rato.
    const pasos: (number | null)[] = [];
    await new WebAudioProgressionPlayer().play(PROGRESION, (i) => pasos.push(i));

    await vi.advanceTimersByTimeAsync(3000);

    expect(pasos).toEqual([0, 1, 2, null]);
  });

  it('sin quien escuche, tampoco falla', async () => {
    // El temporizador del final corre igual, y sin `onStep` no tiene a quien
    // avisar: lo que no puede es reventar dentro de un temporizador suelto.
    await new WebAudioProgressionPlayer().play(PROGRESION);

    await vi.advanceTimersByTimeAsync(3000);

    expect(contexto.osciladores).toHaveLength(9);
  });
});

describe('cortar', () => {
  it('para las notas que quedaban y deja de avisar', async () => {
    const pasos: (number | null)[] = [];
    const reproductor = new WebAudioProgressionPlayer();
    await reproductor.play(PROGRESION, (i) => pasos.push(i));

    reproductor.stop();
    await vi.advanceTimersByTimeAsync(3000);

    expect(pasos).toEqual([]);
    expect(contexto.osciladores.every((o) => o.cortes === 1)).toBe(true);
  });

  it('una nota que ya se apago sola no es un error al cortarla', async () => {
    const reproductor = new WebAudioProgressionPlayer();
    await reproductor.play(PROGRESION);
    contexto.osciladores[0]!.terminado = true;

    expect(() => reproductor.stop()).not.toThrow();
  });

  it('poner otra progresion corta la anterior', async () => {
    const reproductor = new WebAudioProgressionPlayer();
    await reproductor.play(PROGRESION);

    await reproductor.play([{ index: 0, startMs: 0, durationMs: 500, midis: [60] }]);

    expect(contexto.osciladores.slice(0, 9).every((o) => o.cortes === 1)).toBe(true);
  });

  it('al acabar del todo se olvida de las notas', async () => {
    // Si no, cortar después intentaría parar osciladores que ya se apagaron.
    const reproductor = new WebAudioProgressionPlayer();
    await reproductor.play(PROGRESION);

    await vi.advanceTimersByTimeAsync(3000);
    reproductor.stop();

    expect(contexto.osciladores.every((o) => o.cortes === 0)).toBe(true);
  });
});

describe('soltarlo', () => {
  it('cierra el contexto una sola vez', async () => {
    const reproductor = new WebAudioProgressionPlayer();
    await reproductor.play(PROGRESION);

    await reproductor.dispose();
    await reproductor.dispose();

    expect(contexto.cierres).toBe(1);
  });
});
