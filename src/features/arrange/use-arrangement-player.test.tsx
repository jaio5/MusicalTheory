// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { writtenBlock, type Arrangement } from '@core/music';
import type { ProgressionPlayer, ScheduledStep } from '@audio/progression-player';

import { useArrangementPlayer } from './use-arrangement-player';

/**
 * Oír el montaje, y saber por qué bloque va.
 *
 * El reproductor de verdad abre un `AudioContext`, que en jsdom no existe, así
 * que aquí entra uno de mentira que guarda lo que le mandan y deja disparar los
 * avisos de paso a mano. Lo que se fija es lo que decide este enganche: cuándo
 * suena, cuándo se calla, y **qué bloque se enciende** con cada paso.
 */
class ReproductorFalso implements ProgressionPlayer {
  pasos: readonly ScheduledStep[] = [];
  avisar: ((index: number | null) => void) | undefined;
  parado = 0;

  async play(steps: readonly ScheduledStep[], onStep?: (index: number | null) => void) {
    this.pasos = steps;
    this.avisar = onStep;
  }
  stop() {
    this.parado += 1;
  }
  async dispose() {}
}

/** Dos partes de dos acordes, que es lo mínimo para distinguir una de otra. */
const MONTAJE: Arrangement = {
  parts: [
    {
      id: 'estrofa',
      name: 'Estrofa',
      blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'IV', 4)],
      notes: [],
      bars: 2,
    },
    {
      id: 'estribillo',
      name: 'Estribillo',
      blocks: [writtenBlock('c', 'V', 4), writtenBlock('d', 'vi', 4)],
      notes: [],
      bars: 2,
    },
  ],
};

function montar(arrangement: Arrangement = MONTAJE, tonica: number | null = 0) {
  const player = new ReproductorFalso();
  const vista = renderHook(() =>
    useArrangementPlayer(arrangement, tonica as never, 'major', 100, true, () => player),
  );
  return { player, vista };
}

describe('Escuchar el montaje', () => {
  it('empieza callado', () => {
    const { vista } = montar();

    expect(vista.result.current.playing).toBe(false);
    expect(vista.result.current.currentBlockId).toBeNull();
  });

  // Sin tonalidad no hay acordes que resolver, así que no hay nada que sonar.
  it('sin tonalidad no suena', () => {
    const { player, vista } = montar(MONTAJE, null);

    act(() => vista.result.current.toggle(null));

    expect(vista.result.current.playing).toBe(false);
    expect(player.pasos).toHaveLength(0);
  });

  it('una cancion en blanco tampoco', () => {
    const { vista } = montar({ parts: [] });

    act(() => vista.result.current.toggle(null));

    expect(vista.result.current.playing).toBe(false);
  });

  it('suena el montaje entero y enciende el primer bloque', () => {
    const { player, vista } = montar();

    act(() => vista.result.current.toggle(null));

    expect(vista.result.current.playing).toBe(true);
    expect(vista.result.current.playingPartId).toBeNull();
    expect(vista.result.current.currentBlockId).toBe('a');
    expect(player.pasos.length).toBeGreaterThan(0);
  });

  it('o una parte suelta, y se dice cual', () => {
    const { vista } = montar();

    act(() => vista.result.current.toggle('estribillo'));

    expect(vista.result.current.playingPartId).toBe('estribillo');
    expect(vista.result.current.currentBlockId).toBe('c');
  });

  /**
   * El mismo botón para sonar y para callar: escuchando dos partes seguidas, lo
   * que se quiere hacer con la que suena es cortarla.
   */
  it('volver a pulsar lo mismo lo calla', () => {
    const { player, vista } = montar();
    act(() => vista.result.current.toggle('estrofa'));

    act(() => vista.result.current.toggle('estrofa'));

    expect(vista.result.current.playing).toBe(false);
    expect(player.parado).toBeGreaterThan(0);
  });

  // Y pulsar otra distinta cambia de parte en vez de callarse.
  it('pulsar otra parte cambia de parte', () => {
    const { vista } = montar();
    act(() => vista.result.current.toggle('estrofa'));

    act(() => vista.result.current.toggle('estribillo'));

    expect(vista.result.current.playing).toBe(true);
    expect(vista.result.current.playingPartId).toBe('estribillo');
  });

  /**
   * Una parte de solo punteo suena sin encender ningún bloque, porque no hay
   * ninguno: el cabezal se queda apagado y eso es lo correcto, no un fallo.
   */
  it('una parte sin acordes suena sin encender nada', () => {
    const soloPunteo: Arrangement = {
      parts: [
        {
          id: 'solo',
          name: 'Solo',
          blocks: [],
          notes: [
            { id: 'n1', start: 0, length: 1, midi: 60 },
            { id: 'n2', start: 1, length: 1, midi: 62 },
          ],
          bars: 1,
        },
      ],
    };
    const { vista } = montar(soloPunteo);

    act(() => vista.result.current.toggle(null));

    expect(vista.result.current.playing).toBe(true);
    expect(vista.result.current.currentBlockId).toBeNull();
  });

  it('el bloque encendido sigue a los pasos', () => {
    const { player, vista } = montar();
    act(() => vista.result.current.toggle('estrofa'));

    act(() => player.avisar?.(1));

    expect(vista.result.current.currentBlockId).toBe('b');
  });

  /**
   * Cuando lo que suena es una nota del punteo, el dueño del paso es nulo y el
   * bloque encendido **no cambia**: apagarlo haría parpadear el cabezal en cada
   * corchea.
   */
  it('una nota del punteo no apaga el bloque que suena', () => {
    const conPunteo: Arrangement = {
      parts: [
        {
          ...MONTAJE.parts[0]!,
          notes: [{ id: 'n1', start: 0, length: 1, midi: 60 }],
        },
      ],
    };
    const { player, vista } = montar(conPunteo);
    act(() => vista.result.current.toggle(null));
    const antes = vista.result.current.currentBlockId;

    const paso = player.pasos.findIndex((_, i) => i > 0);
    act(() => player.avisar?.(paso));

    expect(vista.result.current.currentBlockId).not.toBeNull();
    expect(typeof antes).toBe('string');
  });

  // Y un paso que no existe tampoco lo apaga: el reproductor y la lista de
  // dueños salen juntos de `soundOf`, pero si algún día se descuadran, lo que se
  // ve es el bloque anterior encendido y no el cabezal apagándose sin motivo.
  it('un paso fuera de la lista deja el bloque como estaba', () => {
    const { player, vista } = montar();
    act(() => vista.result.current.toggle('estrofa'));
    const antes = vista.result.current.currentBlockId;

    act(() => player.avisar?.(999));

    expect(vista.result.current.currentBlockId).toBe(antes);
  });

  it('al terminar se apaga todo', () => {
    const { player, vista } = montar();
    act(() => vista.result.current.toggle(null));

    act(() => player.avisar?.(null));

    expect(vista.result.current.playing).toBe(false);
    expect(vista.result.current.playingPartId).toBeNull();
    expect(vista.result.current.currentBlockId).toBeNull();
  });

  it('y se puede cortar desde fuera', () => {
    const { player, vista } = montar();
    act(() => vista.result.current.toggle(null));

    act(() => vista.result.current.stop());

    expect(vista.result.current.playing).toBe(false);
    expect(player.parado).toBeGreaterThan(0);
  });

  // Sin punteo suena solo el acompañamiento, que es lo que pide el ensayo.
  it('se puede pedir sin punteo', () => {
    const player = new ReproductorFalso();
    const vista = renderHook(() =>
      useArrangementPlayer(MONTAJE, 0 as never, 'major', 100, false, () => player),
    );

    act(() => vista.result.current.toggle(null));

    expect(vista.result.current.playing).toBe(true);
  });
});
