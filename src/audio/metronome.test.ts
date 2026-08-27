import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebAudioMetronome } from './metronome';
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
    expect(contexto.osciladores.length).toBeGreaterThan(0);
    expect(contexto.osciladores[0]!.empiezaEn).toBeCloseTo(0.1, 3);
    metronomo.stop();
  });

  it('el pulso cae donde dice la velocidad', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });

    await pasan(1000);

    const instantes = contexto.osciladores.map((o) => o.empiezaEn!);
    for (let i = 1; i < instantes.length; i += 1) {
      expect(instantes[i]! - instantes[i - 1]!).toBeCloseTo(0.5, 3);
    }
    metronomo.stop();
  });

  it('el primero del compas suena mas agudo y mas fuerte', async () => {
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 240, beatsPerBar: 4 });

    await pasan(1000);

    const [primero, segundo] = contexto.osciladores;
    expect(primero!.frequency.cambios[0]!.valor).toBe(1600);
    expect(segundo!.frequency.cambios[0]!.valor).toBe(1000);
    expect(primero!.volumen).toBeGreaterThan(segundo!.volumen);
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
    const antes = contexto.osciladores.length;
    await pasan(2000);

    expect(metronomo.running).toBe(true);
    expect(contexto.osciladores.length).toBeGreaterThan(antes);
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
    const osciladores = contexto.osciladores.length;
    await pasan(2000);

    expect(metronomo.running).toBe(false);
    expect(pulsos.length).toBe(cuantos);
    expect(contexto.osciladores.length).toBe(osciladores);
  });

  it('arrancar dos veces no deja dos pulsos corriendo', async () => {
    // Pasaba al cambiar de pantalla y volver: dos temporizadores programando
    // clics en el mismo contexto, y el metrónomo sonaba a redoble.
    const metronomo = new WebAudioMetronome();
    await metronomo.start({ bpm: 120 });
    await metronomo.start({ bpm: 120 });
    await pasan(1000);

    const instantes = contexto.osciladores.map((o) => o.empiezaEn!);

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
