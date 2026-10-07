// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PULSACION_LARGA_MS, useBlockDrag, type Medida } from './use-block-drag';

/**
 * Arrastrar un bloque de sitio, que es el gesto del lienzo.
 *
 * Se prueba el enganche y no la pantalla porque lo que hay que fijar es la
 * aritmética del gesto —cuándo arranca, en qué hueco cae, cuándo no cae en
 * ninguno—, y eso no se ve arrastrando un `<div>` en jsdom, donde ningún
 * elemento tiene tamaño: las medidas se las da quien dibuja, así que aquí se le
 * dan a mano y el gesto se resuelve contra ellas.
 *
 * La foto de abajo son dos partes, una encima de otra, con dos bloques cada una:
 *
 *   Estrofa   [ 0: 0–100 ] [ 1: 100–200 ]     y ∈ 0–50
 *   Estribillo[ 0: 0–100 ] [ 1: 100–200 ]     y ∈ 60–110
 */
const MEDIDAS: readonly Medida[] = [
  { partId: 'estrofa', index: 0, left: 0, right: 100, top: 0, bottom: 50 },
  { partId: 'estrofa', index: 1, left: 100, right: 200, top: 0, bottom: 50 },
  { partId: 'estribillo', index: 0, left: 0, right: 100, top: 60, bottom: 110 },
  { partId: 'estribillo', index: 1, left: 100, right: 200, top: 60, bottom: 110 },
];

function pulsar(boton = 0): React.PointerEvent {
  return { button: boton, clientX: 10, clientY: 10 } as React.PointerEvent;
}

/** La misma pulsación, con el dedo. */
function tocar(): React.PointerEvent {
  return { button: 0, clientX: 10, clientY: 10, pointerType: 'touch' } as React.PointerEvent;
}

/** Lo que el navegador manda antes de desplazar, y lo único que puede frenarlo. */
function barrido(cancelable = true): TouchEvent {
  return new TouchEvent('touchmove', { cancelable });
}

/** Un movimiento del puntero, de los que escucha la ventana. */
function mover(x: number, y: number): void {
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: x, clientY: y, cancelable: true }),
  );
}

function soltar(x: number, y: number, tipo = 'pointerup'): void {
  window.dispatchEvent(new PointerEvent(tipo, { clientX: x, clientY: y }));
}

function montar() {
  const onDrop = vi.fn();
  const vista = renderHook(() => useBlockDrag(() => MEDIDAS, onDrop));
  return { onDrop, vista };
}

describe('Arrastrar un bloque', () => {
  /**
   * Un bloque también se pulsa para oírlo, y un dedo nunca pulsa completamente
   * quieto: sin umbral, la mitad de las pulsaciones serían arrastres de dos
   * píxeles que no mueven nada y se comen el `click`.
   */
  it('no arranca hasta pasar el umbral de cuatro pixeles', () => {
    const { vista } = montar();

    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(12, 12));

    expect(vista.result.current.drag).toBeNull();

    act(() => mover(20, 20));

    expect(vista.result.current.drag?.blockId).toBe('a');
  });

  // Con el botón derecho se abre el menú del sistema, y el bloque se quedaría
  // pegado al puntero para siempre.
  it('el boton derecho no arrastra nada', () => {
    const { vista } = montar();

    act(() => vista.result.current.start(pulsar(2), 'a'));
    act(() => mover(80, 80));

    expect(vista.result.current.drag).toBeNull();
  });

  /**
   * Pasada la mitad de una caja, el bloque va **detrás** de ella. Es lo que hace
   * que soltar «encima de la derecha» de un bloque signifique lo que parece.
   */
  it('el hueco sale de la mitad de cada caja', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));

    act(() => mover(40, 25));
    expect(vista.result.current.drag?.target).toEqual({ partId: 'estrofa', index: 0 });

    act(() => mover(60, 25));
    expect(vista.result.current.drag?.target).toEqual({ partId: 'estrofa', index: 1 });

    act(() => mover(160, 25));
    expect(vista.result.current.drag?.target).toEqual({ partId: 'estrofa', index: 2 });
  });

  // La banda vertical es lo que separa una parte de otra.
  it('y la fila, de la banda vertical', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));

    act(() => mover(40, 80));

    expect(vista.result.current.drag?.target?.partId).toBe('estribillo');
  });

  it('fuera de toda banda no hay destino', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));

    act(() => mover(40, 300));

    expect(vista.result.current.drag?.target).toBeNull();
  });

  it('al soltar se avisa con el hueco, y se suelta el bloque', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(160, 80));

    act(() => soltar(160, 80));

    expect(onDrop).toHaveBeenCalledWith('a', 'estribillo', 2);
    expect(vista.result.current.drag).toBeNull();
  });

  // Soltar en el aire deja el bloque donde estaba, que también es una respuesta.
  it('soltar fuera no mueve nada', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(40, 300));

    act(() => soltar(40, 300));

    expect(onDrop).not.toHaveBeenCalled();
    expect(vista.result.current.drag).toBeNull();
  });

  // Una pulsación que no llegó a arrastrar no mueve nada al levantar el dedo.
  it('levantar el dedo sin haber arrastrado tampoco', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));

    act(() => soltar(11, 11));

    expect(onDrop).not.toHaveBeenCalled();
  });

  /**
   * `pointercancel` llega cuando el sistema se queda el gesto —el navegador
   * decide que es un desplazamiento, o entra una llamada—. Sin escucharlo, el
   * bloque se queda pegado al puntero y no hay manera de soltarlo.
   */
  it('si el sistema se queda el gesto, el bloque se suelta igual', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(160, 25));

    act(() => soltar(160, 25, 'pointercancel'));

    expect(vista.result.current.drag).toBeNull();
  });

  // Y no se queda nadie escuchando: tras soltar, mover el puntero no revive el
  // arrastre.
  it('al soltar se dejan de escuchar los movimientos', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(160, 25));
    act(() => soltar(160, 25));

    act(() => mover(40, 25));

    expect(vista.result.current.drag).toBeNull();
  });

  // Mientras se arrastra no se selecciona texto ni se desplaza la página.
  it('el movimiento se da por atendido, para que la pagina no se desplace', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(80, 25));

    const evento = new PointerEvent('pointermove', { clientX: 90, clientY: 25, cancelable: true });
    act(() => {
      window.dispatchEvent(evento);
    });

    expect(evento.defaultPrevented).toBe(true);
  });

  /**
   * **Moverse dentro del mismo hueco no cambia el estado.** Cada cambio de estado
   * repinta el lienzo entero, y el puntero manda veinte movimientos por segundo
   * que casi nunca cambian dónde caería el bloque.
   */
  it('moverse sin cambiar de hueco no cambia el estado', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(40, 25));
    const antes = vista.result.current.drag;

    act(() => mover(45, 30));

    expect(vista.result.current.drag).toBe(antes);
  });

  // El fantasma lo mueve el enganche, sin estado: al montarse se coloca donde
  // está el puntero y en cada movimiento se le cambia el `transform`.
  it('el fantasma sigue al puntero sin pasar por el estado', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(40, 25));

    const nodo = document.createElement('div');
    act(() => vista.result.current.fantasma(nodo));
    expect(nodo.style.transform).toBe('translate3d(40px, 25px, 0)');

    act(() => mover(45, 30));
    expect(nodo.style.transform).toBe('translate3d(45px, 30px, 0)');

    // Y al desmontarse el fantasma no se escribe en ningún sitio.
    act(() => vista.result.current.fantasma(null));
    act(() => mover(50, 30));
    expect(nodo.style.transform).toBe('translate3d(45px, 30px, 0)');
  });

  /**
   * Desmontarse a mitad del gesto deja de escuchar: si no, el próximo movimiento
   * del ratón arrastraría un bloque que ya no existe y soltarlo escribiría en la
   * canción desde un lienzo que no está.
   */
  it('desmontarse a mitad del gesto deja de escuchar, sin soltar', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));
    act(() => mover(160, 25));

    vista.unmount();
    soltar(160, 25);

    expect(onDrop).not.toHaveBeenCalled();
  });

  // Y desmontarse sin gesto en curso no tiene nada que quitar.
  it('desmontarse sin gesto no hace nada', () => {
    const { vista } = montar();

    expect(() => vista.unmount()).not.toThrow();
  });
});

/**
 * Con el dedo, mover es desplazar: la tira se sale por la derecha en un
 * teléfono y los bloques la tapan casi entera. Medido a 390 con ocho acordes,
 * un barrido sobre la tira la dejaba en `scrollLeft` 0 y cambiaba el orden de
 * los acordes. Así que el bloque se sujeta primero —`PULSACION_LARGA_MS`
 * quieto— y entonces se mueve; antes, el gesto es del navegador.
 */
describe('Arrastrar un bloque con el dedo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moverse sin sujetarlo no arrastra: es desplazar', () => {
    const { onDrop, vista } = montar();

    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => mover(80, 10));
    act(() => soltar(80, 10));

    expect(vista.result.current.drag).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  // Y el navegador conserva el gesto: el barrido no se frena.
  it('antes de sujetarlo, el barrido es del navegador', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));

    const evento = barrido();
    act(() => {
      window.dispatchEvent(evento);
    });

    expect(evento.defaultPrevented).toBe(false);
  });

  // Un dedo nunca sujeta completamente quieto: temblar dentro del umbral no
  // cancela la pulsación larga.
  it('temblar dentro del umbral sigue siendo sujetar', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => mover(12, 11));

    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    expect(vista.result.current.drag?.blockId).toBe('a');
  });

  // Irse antes de tiempo deja de escuchar: sujetar después, en otro sitio, no
  // levanta el bloque que se soltó.
  it('irse antes de tiempo cancela la pulsacion larga', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => mover(80, 10));

    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    expect(vista.result.current.drag).toBeNull();
  });

  it('sujetarlo lo levanta donde esta, sin moverlo todavia', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));

    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    expect(vista.result.current.drag).toEqual({
      blockId: 'a',
      target: { partId: 'estrofa', index: 0 },
    });
  });

  // El fantasma nace bajo el dedo, no en la esquina.
  it('y el fantasma sale bajo el dedo', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    const nodo = document.createElement('div');
    act(() => vista.result.current.fantasma(nodo));

    expect(nodo.style.transform).toBe('translate3d(10px, 10px, 0)');
  });

  // Sujetarlo y soltarlo sin moverlo es un toque largo, no un cambio de sitio.
  it('soltarlo sin moverlo no lo cambia de sitio', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });
    act(() => mover(12, 11));

    act(() => soltar(12, 11));

    expect(onDrop).not.toHaveBeenCalled();
    expect(vista.result.current.drag).toBeNull();
  });

  it('sujeto, se mueve y se suelta como con el raton', () => {
    const { onDrop, vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    act(() => mover(160, 80));
    expect(vista.result.current.drag?.target).toEqual({ partId: 'estribillo', index: 2 });

    act(() => soltar(160, 80));
    expect(onDrop).toHaveBeenCalledWith('a', 'estribillo', 2);
  });

  // Un `pointermove` no puede impedir que el navegador desplace: eso lo dice el
  // `touchmove`, y solo con el bloque ya sujeto.
  it('sujeto, el barrido se frena para que la tira no se desplace', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    const evento = barrido();
    act(() => {
      window.dispatchEvent(evento);
    });

    expect(evento.defaultPrevented).toBe(true);
  });

  // Si el navegador ya se lo ha quedado, no se puede frenar y no se intenta.
  it('un barrido que ya no se puede cancelar se deja pasar', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    const evento = barrido(false);
    expect(() =>
      act(() => {
        window.dispatchEvent(evento);
      }),
    ).not.toThrow();
    expect(evento.defaultPrevented).toBe(false);
  });

  // Sujetar quieto medio segundo abre el menú de contexto en un teléfono, y aquí
  // sujetar quieto es justo cómo se coge un bloque.
  it('sujetarlo no abre el menu de contexto', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));

    const menu = new Event('contextmenu', { cancelable: true });
    act(() => {
      window.dispatchEvent(menu);
    });

    expect(menu.defaultPrevented).toBe(true);
  });

  // Con el ratón no hay menú que frenar ni barrido que escuchar.
  it('con el raton no se toca el menu de contexto', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(pulsar(), 'a'));

    const menu = new Event('contextmenu', { cancelable: true });
    act(() => {
      window.dispatchEvent(menu);
    });

    expect(menu.defaultPrevented).toBe(false);
  });

  // Si el sistema se queda el gesto durante la espera, la espera se cancela:
  // el bloque no se levanta solo un rato después.
  it('si el sistema se queda el gesto mientras se sujeta, no se levanta', () => {
    const { vista } = montar();
    act(() => vista.result.current.start(tocar(), 'a'));
    act(() => soltar(10, 10, 'pointercancel'));

    act(() => {
      vi.advanceTimersByTime(PULSACION_LARGA_MS);
    });

    expect(vista.result.current.drag).toBeNull();
  });
});
