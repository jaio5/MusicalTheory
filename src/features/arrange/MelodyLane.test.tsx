// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, type LeadNote } from '@core/music';

import { MelodyLane } from './MelodyLane';

/**
 * La rejilla del punteo: escribir notas pulsando, moverlas y estirarlas.
 *
 * jsdom no da tamaño a nada, así que la caja de la rejilla se dicta a mano: sin
 * eso, `casillaEn` no puede traducir un punto de la pantalla a una casilla y no
 * se prueba ni una de las tres cosas que hace este componente.
 *
 * La rejilla que se monta abajo es Do mayor con «solo la escala». Abarca más de
 * una octava, así que hay **dos filas de Do**: por eso se coge la primera y no
 * `getByRole`, que encuentra dos y se queja.
 */
const ALTO_FILA = 22;
const POR_PULSO = 40;

function cajaDeLaRejilla(rejilla: HTMLElement, filas: number) {
  rejilla.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      right: 400,
      bottom: filas * ALTO_FILA,
      width: 400,
      height: filas * ALTO_FILA,
    }) as DOMRect;
}

function pintar(props: Partial<React.ComponentProps<typeof MelodyLane>> = {}) {
  const manos = {
    onAdd: vi.fn(),
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onGestureStart: vi.fn(),
    onGestureEnd: vi.fn(),
  };
  const { container } = render(
    <MelodyLane
      notes={[]}
      beats={8}
      beatsPerBar={4}
      tonic={pitchClassFromName('C')}
      scaleId="major"
      onlyScale
      porPulso={POR_PULSO}
      selectedNoteId={null}
      partName="Estrofa"
      {...manos}
      {...props}
    />,
  );
  const rejilla = container.querySelector('div[style*="height"]') as HTMLElement;
  cajaDeLaRejilla(rejilla, 8);
  return { ...manos, rejilla };
}

/** Arrastrar con el puntero: las escuchas viven en la ventana. */
function arrastrarHasta(x: number, y: number) {
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: x, clientY: y, cancelable: true }),
  );
}
function soltarPuntero() {
  window.dispatchEvent(new PointerEvent('pointerup', {}));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Escribir en la rejilla del punteo', () => {
  // Las filas llevan el nombre de su nota, que es lo que se lee al escribir.
  it('cada fila dice que nota escribe', () => {
    pintar();

    expect(screen.getAllByRole('button', { name: 'Escribir C en Estrofa' }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('button', { name: 'Escribir G en Estrofa' }).length).toBeGreaterThan(
      0,
    );
  });

  /**
   * Pulsar una casilla vacía escribe la nota ahí: es lo más corto que hay entre
   * querer una nota y tenerla.
   */
  it('pulsar una casilla escribe una nota en su pulso', () => {
    const { onAdd, rejilla } = pintar();
    cajaDeLaRejilla(rejilla, 8);

    fireEvent.click(screen.getAllByRole('button', { name: 'Escribir C en Estrofa' })[0]!, {
      clientX: POR_PULSO * 2 + 5,
      clientY: 5,
    });

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [, start] = onAdd.mock.calls[0]!;
    expect(start).toBeGreaterThanOrEqual(0);
  });

  // El pulso se redondea a la rejilla: media corchea no existe.
  it('el pulso cae en la rejilla, no donde se pulso', () => {
    const { onAdd, rejilla } = pintar();
    cajaDeLaRejilla(rejilla, 8);

    fireEvent.click(screen.getAllByRole('button', { name: 'Escribir C en Estrofa' })[0]!, {
      clientX: POR_PULSO * 3 + 13,
      clientY: 5,
    });

    const [, start] = onAdd.mock.calls[0]!;
    expect(Number.isInteger(start * 4)).toBe(true);
  });
});

describe('Las notas ya escritas', () => {
  const NOTA: LeadNote = { id: 'n1', start: 1, length: 2, offset: 0 };

  it('se dicen con su nombre, su largo y su sitio', () => {
    pintar({ notes: [NOTA] });

    expect(screen.getByRole('button', { name: 'C, 2 pulsos, en el pulso 1' })).toBeInTheDocument();
  });

  it('pulsar una la elige', () => {
    const { onSelect } = pintar({ notes: [NOTA] });

    fireEvent.click(screen.getByRole('button', { name: /^C, 2 pulsos/ }));

    expect(onSelect).toHaveBeenCalledWith('n1');
  });

  it('la elegida se dice que lo esta', () => {
    pintar({ notes: [NOTA], selectedNoteId: 'n1' });

    expect(screen.getByRole('button', { name: /^C, 2 pulsos/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /**
   * Por el cuerpo se mueve y por el borde derecho se estira: la misma regla que
   * los bloques de acorde, y por el mismo motivo —una manija aparte sería un
   * control de ocho píxeles—.
   */
  it('cogerla por el cuerpo la mueve', () => {
    const { onMove, onGestureStart, onGestureEnd, rejilla } = pintar({ notes: [NOTA] });
    cajaDeLaRejilla(rejilla, 8);
    const nota = screen.getByRole('button', { name: /^C, 2 pulsos/ });
    nota.getBoundingClientRect = () => ({ left: 40, right: 120, top: 0, bottom: 18 }) as DOMRect;

    fireEvent.pointerDown(nota, { button: 0, clientX: 60, clientY: 5 });
    arrastrarHasta(200, 40);
    soltarPuntero();

    expect(onGestureStart).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalled();
    expect(onGestureEnd).toHaveBeenCalled();
  });

  it('y por el borde derecho la estira', () => {
    const { onResize, onMove, rejilla } = pintar({ notes: [NOTA] });
    cajaDeLaRejilla(rejilla, 8);
    const nota = screen.getByRole('button', { name: /^C, 2 pulsos/ });
    nota.getBoundingClientRect = () => ({ left: 40, right: 120, top: 0, bottom: 18 }) as DOMRect;

    fireEvent.pointerDown(nota, { button: 0, clientX: 118, clientY: 5 });
    arrastrarHasta(200, 5);
    soltarPuntero();

    expect(onResize).toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  // Con el botón derecho se abre el menú del sistema.
  it('el boton derecho no coge nada', () => {
    const { onGestureStart } = pintar({ notes: [NOTA] });
    const nota = screen.getByRole('button', { name: /^C, 2 pulsos/ });

    fireEvent.pointerDown(nota, { button: 2, clientX: 60, clientY: 5 });

    expect(onGestureStart).not.toHaveBeenCalled();
  });

  /**
   * Al soltar una nota sobre otra fila, el `click` llega a la casilla de debajo:
   * sin la guarda, moverla escribía una nota nueva encima de la que se acababa
   * de mover.
   */
  it('soltar un arrastre no escribe una nota nueva', () => {
    const { onAdd, rejilla } = pintar({ notes: [NOTA] });
    cajaDeLaRejilla(rejilla, 8);
    const nota = screen.getByRole('button', { name: /^C, 2 pulsos/ });
    nota.getBoundingClientRect = () => ({ left: 40, right: 120, top: 0, bottom: 18 }) as DOMRect;

    fireEvent.pointerDown(nota, { button: 0, clientX: 60, clientY: 5 });
    arrastrarHasta(200, 40);
    soltarPuntero();
    fireEvent.click(screen.getAllByRole('button', { name: 'Escribir C en Estrofa' })[0]!, {
      clientX: 200,
      clientY: 40,
    });

    expect(onAdd).not.toHaveBeenCalled();
  });

  // Una nota de la que el motor dudó va translúcida y lo dice.
  it('una nota dudosa lo dice', () => {
    // Dudosa es la que el motor oyó con poca claridad.
    pintar({ notes: [{ ...NOTA, clarity: 0.2 }] });

    expect(screen.getByRole('button', { name: /dudosa$/ })).toBeInTheDocument();
  });
});

describe('Con «solo la escala» puesta', () => {
  /**
   * Una nota alterada no cabe en ninguna fila. Se queda donde está —quitarla
   * sería borrar trabajo por haber cambiado de vista— pero hay que decirlo:
   * escribir seis notas y ver una parece que se han perdido cinco.
   */
  it('las que no caben se cuentan, en singular', () => {
    pintar({ notes: [{ id: 'x', start: 0, length: 1, offset: 1 }] });

    expect(screen.getByText(/Hay 1 nota que no es de la escala/)).toBeInTheDocument();
  });

  it('y en plural', () => {
    pintar({
      notes: [
        { id: 'x', start: 0, length: 1, offset: 1 },
        { id: 'y', start: 1, length: 1, offset: 6 },
      ],
    });

    expect(screen.getByText(/Hay 2 notas que no son de la escala/)).toBeInTheDocument();
  });

  it('sin la escala puesta caben todas y no se dice nada', () => {
    pintar({ onlyScale: false, notes: [{ id: 'x', start: 0, length: 1, offset: 1 }] });

    expect(screen.queryByText(/no es de la escala/)).not.toBeInTheDocument();
  });
});
