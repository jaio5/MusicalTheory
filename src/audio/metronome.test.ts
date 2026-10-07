import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectPitch } from './autocorrelation';
import { CORTE_DEL_CLIC_HZ, muestrasDelClic, WebAudioMetronome } from './metronome';
import { ponerAudioFalso, quitarAudioFalso, type ContextoDeAudioFalso } from './para-tests';

/**
 * El metrónomo, mirado por dentro del reloj.
 *
 * Lo que hay que fijar es que **el pulso no lo lleva un temporizador de
 * JavaScript**: el hilo se atasca con cualquier cosa —y aquí hay dos motores de
 * análisis corriendo— y el clic llegaría tarde. El temporizador solo mira por
 * delante; los golpes van programados contra el reloj del audio.
 *
 * Se ve en que al mover el reloj del audio y disparar el temporizador aparecen
 * clics **ya colocados en su instante futuro**, y no uno por vuelta.
 */

let contexto: ContextoDeAudioFalso;

beforeEach(() => {
  vi.useFakeTimers();
  contexto = ponerAudioFalso();
});

afterEach(() => {
  vi.useRealTimers();
  quitarAudioFalso();
});

/** Deja pasar el tiempo en los dos relojes a la vez, que es lo que pasa de verdad. */
async function pasan(ms: number) {
  contexto.avanzar(ms / 1000);
  await vi.advanceTimersByTimeAsync(ms);
}

describe('llevar el pulso', () => {
  it('sin contexto de audio no revienta, simplemente no suena', async () => {
    quitarAudioFalso();
    const metronomo = new WebAudioMetronome();

    await metronomo.start({ bpm: 100 });

    expect(metronomo.running).toBe(false);
  });

  it('los clics se programan por delante, no uno por vuelta del temporizador', async () => {
    // Una sola vuelta del temporizador —25 ms— programa los 150 ms siguientes.
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });

    await pasan(25);

    // A 120 el pulso cae cada medio segundo; el primero va a 0,1 s.
    expect(contexto.fuentes.length).toBeGreaterThan(0);
    expect(contexto.fuentes[0]!.empiezaEn).toBeCloseTo(0.1, 3);
    metronomo.stop();
  });

  it('el pulso cae donde dice la velocidad', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });

    await pasan(1000);

    const instantes = contexto.fuentes.map((o) => o.empiezaEn!);
    for (let i = 1; i < instantes.length; i += 1) {
      expect(instantes[i]! - instantes[i - 1]!).toBeCloseTo(0.5, 3);
    }
    metronomo.stop();
  });

  it('el primero del compas suena mas fuerte', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 240, beatsPerBar: 4 });

    await pasan(1000);

    const [primero, segundo] = contexto.fuentes;
    // El mismo timbre —el mismo ruido— y otro golpe: más largo y más fuerte.
    expect(primero!.buffer!.length).toBeGreaterThan(segundo!.buffer!.length);
    expect(primero!.pico).toBeGreaterThan(segundo!.pico);
    metronomo.stop();
  });

  it('avisa a la pantalla con el numero dentro del compas', async () => {
    // Este aviso sí va por temporizador: que la luz llegue un fotograma tarde no
    // importa; que el clic llegue tarde, sí.
    const pulsos: number[] = [];
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 240, beatsPerBar: 3, onBeat: (b) => pulsos.push(b) });

    await pasan(1500);

    expect(pulsos.slice(0, 6)).toEqual([0, 1, 2, 0, 1, 2]);
    metronomo.stop();
  });

  it('el compas de un solo pulso es el minimo', async () => {
    const pulsos: number[] = [];
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 240, beatsPerBar: 0, onBeat: (b) => pulsos.push(b) });

    await pasan(1000);

    expect(new Set(pulsos)).toEqual(new Set([0]));
    metronomo.stop();
  });
});

describe('cambiar de velocidad', () => {
  it('no corta el pulso', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 60 });
    await pasan(500);

    metronomo.setBpm(120);
    const antes = contexto.fuentes.length;
    await pasan(2000);

    expect(metronomo.running).toBe(true);
    expect(contexto.fuentes.length).toBeGreaterThan(antes);
    metronomo.stop();
  });

  it('una velocidad imposible se acota en vez de romper el bucle', async () => {
    // Un bpm de cero dividiría entre cero y el bucle de programación no
    // terminaría nunca: se colgaría la pestaña.
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 0 });

    await pasan(1000);

    expect(metronomo.running).toBe(true);
    metronomo.stop();
  });
});

describe('parar', () => {
  it('deja de sonar y deja de avisar', async () => {
    const pulsos: number[] = [];
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120, onBeat: (b) => pulsos.push(b) });
    await pasan(200);

    metronomo.stop();
    const cuantos = pulsos.length;
    const osciladores = contexto.fuentes.length;
    await pasan(2000);

    expect(metronomo.running).toBe(false);
    expect(pulsos.length).toBe(cuantos);
    expect(contexto.fuentes.length).toBe(osciladores);
  });

  it('arrancar dos veces no deja dos pulsos corriendo', async () => {
    // Pasaba al cambiar de pantalla y volver: dos temporizadores programando
    // clics en el mismo contexto, y el metrónomo sonaba a redoble.
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });
    await metronomo.start({ bpm: 120 });
    await pasan(1000);

    const instantes = contexto.fuentes.map((o) => o.empiezaEn!);

    expect(new Set(instantes).size).toBe(instantes.length);
    metronomo.stop();
  });

  it('soltarlo cierra el contexto, y hacerlo dos veces no lo cierra dos', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });

    await metronomo.dispose();
    await metronomo.dispose();

    expect(contexto.cierres).toBe(1);
    expect(metronomo.running).toBe(false);
  });
});

describe('el contexto dormido', () => {
  it('se despierta al arrancar', async () => {
    // El sistema lo suspende por su cuenta —al bloquear la pantalla, al cambiar
    // de dispositivo de sonido— y entonces se programan clics que no suenan.
    contexto.state = 'suspended';
    const metronomo = new WebAudioMetronome();

    await metronomo.start({ bpm: 120 });

    expect(contexto.reanudaciones).toBe(1);
    metronomo.stop();
  });
});

describe('el volumen', () => {
  it('sale por una sola ganancia, y se mueve sin cortar el pulso', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120, volume: 0.5 });
    const [salida] = contexto.salidas;

    expect(salida!.gain.value).toBe(0.5);
    metronomo.setVolume(0);
    expect(salida!.gain.value).toBe(0);
    await pasan(1000);

    // Callado sigue llevando el pulso: la toma necesita saber dónde cae.
    expect(metronomo.running).toBe(true);
    expect(contexto.fuentes.length).toBeGreaterThan(1);
    metronomo.stop();
  });

  it('lo imposible se acota, y sin volumen se oye entero', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120, volume: 7 });
    expect(contexto.salidas[0]!.gain.value).toBe(1);
    metronomo.setVolume(Number.NaN);
    expect(contexto.salidas[0]!.gain.value).toBe(1);
    metronomo.setVolume(-1);
    expect(contexto.salidas[0]!.gain.value).toBe(0);
    metronomo.stop();
  });

  it('un golpe sin sonido dentro no pesa nada', () => {
    expect(contexto.createBufferSource().pico).toBe(0);
  });

  it('cambiar el volumen antes de arrancar no revienta', () => {
    expect(() => new WebAudioMetronome().setVolume(0.3)).not.toThrow();
  });

  it('volver a arrancar en el mismo contexto no rehace los golpes', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });
    await metronomo.start({ bpm: 120, volume: 0.2 });

    expect(contexto.salidas).toHaveLength(1);
    expect(contexto.salidas[0]!.gain.value).toBe(0.2);
    metronomo.stop();
  });
});

describe('cuándo suena cada golpe', () => {
  it('un navegador que no dice lo que tarda el altavoz cuenta cero', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    (contexto as { baseLatency?: number }).baseLatency = undefined;
    (contexto as { outputLatency?: number }).outputLatency = undefined;
    const instantes: number[] = [];
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120, onBeat: (_b, instante) => instantes.push(instante!) });

    await pasan(25);
    await pasan(100);

    expect(instantes[0]).toBeCloseTo(1075, 5);
    metronomo.stop();
    vi.restoreAllMocks();
  });

  it('el aviso lleva el instante del sonido, con lo que tarda el altavoz', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    contexto.baseLatency = 0.01;
    contexto.outputLatency = 0.04;
    const instantes: number[] = [];
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120, onBeat: (_b, instante) => instantes.push(instante!) });

    // La primera vuelta del temporizador, con el reloj del audio en 0,025 s,
    // programa el golpe de 0,1 s: suena dentro de 75 ms, más 50 de altavoz.
    await pasan(25);
    await pasan(100);

    expect(instantes[0]).toBeCloseTo(1125, 5);
    metronomo.stop();
    vi.restoreAllMocks();
  });
});

/**
 * **El golpe no tiene altura ni vive donde se mira.** Es lo que deja que suene
 * durante la toma: el motor de tono no le encuentra periodo y el croma no lo ve.
 */
describe('el golpe', () => {
  it('es siempre el mismo, para que la guitarra de los tests sume este', () => {
    expect(muestrasDelClic(48_000, true)).toEqual(muestrasDelClic(48_000, true));
  });

  it('el motor de tono no le encuentra nota, ni con el umbral en el suelo', () => {
    for (const fuerte of [true, false]) {
      const golpe = muestrasDelClic(48_000, fuerte);
      const bloque = new Float32Array(2048);
      bloque.set(golpe.subarray(0, 2048));
      const nota = detectPitch(bloque, {
        sampleRate: 48_000,
        minFrequency: 70,
        maxFrequency: 1400,
        rmsThreshold: 0,
        clarityThreshold: 0.75,
      });
      expect(nota, fuerte ? 'el fuerte' : 'el flojo').toBeNull();
    }
  });

  it('casi toda su energia cae por encima del corte', () => {
    const golpe = muestrasDelClic(48_000, true);
    // Lo que queda por debajo, medido con un paso bajo de un polo —que es blando y
    // deja pasar de más— a la mitad del corte: menos de una vigésima del total.
    let abajo = 0;
    let total = 0;
    let previo = 0;
    const a = Math.exp((-2 * Math.PI * (CORTE_DEL_CLIC_HZ / 2)) / 48_000);
    for (const valor of golpe) {
      previo = (1 - a) * valor + a * previo;
      abajo += previo * previo;
      total += valor * valor;
    }
    expect(abajo / total).toBeLessThan(0.05);
  });
});
