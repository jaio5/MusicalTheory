import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_TONE_MS, WebAudioReferenceTone } from './reference-tone';
import { ponerAudioFalso, quitarAudioFalso, type ContextoDeAudioFalso } from './para-tests';

/**
 * La nota de referencia con la que se compara de oído.
 *
 * Es un oscilador con envolvente y no una muestra, así que lo que se puede
 * comprobar sin oírlo es lo de siempre: que suena la frecuencia que se pidió,
 * que dura lo que se pidió y que **tiene envolvente**, que es lo que separa una
 * nota de un chasquido de altavoz roto.
 */

let contexto: ContextoDeAudioFalso;

beforeEach(() => {
  contexto = ponerAudioFalso();
});

afterEach(() => {
  quitarAudioFalso();
});

describe('sonar una nota', () => {
  it('sin contexto de audio no revienta', async () => {
    quitarAudioFalso();

    await expect(new WebAudioReferenceTone().play(440)).resolves.toBeUndefined();
  });

  it('suena la frecuencia que se pide', async () => {
    const tono = new WebAudioReferenceTone();

    await tono.play(440);

    expect(contexto.osciladores[0]!.frequency.cambios[0]!.valor).toBe(440);
  });

  it('la onda es triangular a proposito', async () => {
    // La senoide pura se pierde contra el ampli y la de sierra es demasiado
    // agresiva para tenerla sonando mientras se afina.
    const tono = new WebAudioReferenceTone();

    await tono.play(440);

    expect(contexto.osciladores[0]!.type).toBe('triangle');
  });

  it('dura lo que se le dice, y por defecto lo de siempre', async () => {
    const tono = new WebAudioReferenceTone();

    await tono.play(440, 500);
    await tono.play(440);

    expect(contexto.osciladores[0]!.acabaEn).toBeCloseTo(0.5, 3);
    expect(contexto.osciladores[1]!.acabaEn).toBeCloseTo(DEFAULT_TONE_MS / 1000, 3);
  });

  it('tiene envolvente: entra desde cero y se apaga hasta cero', async () => {
    // Sin esto, empezar y parar de golpe suena a chasquido.
    const tono = new WebAudioReferenceTone();

    await tono.play(440, 1000);

    const cambios = contexto.osciladores[0]!.salida!.gain.cambios;
    expect(cambios[0]).toMatchObject({ valor: 0, cuando: 0 });
    expect(cambios.at(-1)).toMatchObject({ valor: 0, cuando: 1 });
    expect(Math.max(...cambios.map((c) => c.valor))).toBeGreaterThan(0);
  });

  it('una nota nueva corta la anterior', async () => {
    const tono = new WebAudioReferenceTone();

    await tono.play(440);
    await tono.play(880);

    expect(contexto.osciladores[0]!.cortes).toBe(1);
  });

  it('el contexto dormido se despierta', async () => {
    contexto.state = 'suspended';

    await new WebAudioReferenceTone().play(440);

    expect(contexto.reanudaciones).toBe(1);
  });
});

describe('parar', () => {
  it('parar sin nada sonando no hace nada', () => {
    expect(() => new WebAudioReferenceTone().stop()).not.toThrow();
  });

  it('parar una nota que ya se apago sola no es un error', async () => {
    // Es una carrera normal entre el temporizador del oscilador y la pulsación
    // de quien está escuchando, y la de verdad lanza `InvalidStateError`.
    const tono = new WebAudioReferenceTone();
    await tono.play(440, 100);
    contexto.osciladores[0]!.terminado = true;

    expect(() => tono.stop()).not.toThrow();
  });

  it('cuando la nota se acaba sola, se olvida de ella', async () => {
    const tono = new WebAudioReferenceTone();
    await tono.play(440, 100);

    contexto.osciladores[0]!.terminarSola();
    tono.stop();

    // Si no se hubiera olvidado, `stop` intentaría cortarla, y una nota que ya
    // se apagó sola lanza al pararla.
    expect(contexto.osciladores[0]!.cortes).toBe(0);
  });
});

describe('soltarlo', () => {
  it('cierra el contexto una sola vez', async () => {
    const tono = new WebAudioReferenceTone();
    await tono.play(440);

    await tono.dispose();
    await tono.dispose();

    expect(contexto.cierres).toBe(1);
  });

  it('sin haber sonado nunca, tampoco revienta', async () => {
    await expect(new WebAudioReferenceTone().dispose()).resolves.toBeUndefined();
  });
});

describe('dos tonos seguidos', () => {
  /**
   * Al pedir otro tono, el que se está oyendo se para **y se le quita el aviso
   * de terminado**: si se le dejara puesto, el viejo apagaría al nuevo al llegar
   * a su final, y la nota de referencia se cortaría sola a mitad.
   */
  it('al viejo se le quita el aviso, y no apaga al nuevo', async () => {
    const tono = new WebAudioReferenceTone();

    await tono.play(440);
    const primero = contexto.osciladores.at(-1)!;
    await tono.play(880);
    const segundo = contexto.osciladores.at(-1)!;
    expect(segundo).not.toBe(primero);

    expect(primero.onended).toBeNull();
    expect(primero.cortes).toBe(1);

    // Y el segundo sigue puesto: pararlo ahora lo corta de verdad.
    await tono.dispose();
    expect(segundo.cortes).toBe(1);
  });

  /**
   * Y el que termina siendo el que está puesto se borra: si no, al parar se
   * intentaría cortar un oscilador ya apagado, que es lo que lanza
   * `InvalidStateError` en el navegador.
   */
  it('el que termina siendo el ultimo se borra solo', async () => {
    const tono = new WebAudioReferenceTone();
    await tono.play(440);
    const unico = contexto.osciladores.at(-1)!;

    unico.terminarSola();

    await expect(tono.dispose()).resolves.toBeUndefined();
    expect(unico.cortes).toBe(0);
  });
});
