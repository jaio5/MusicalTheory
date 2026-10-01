// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, type LeadNote } from '@core/music';

import { ALTO_FILA, MelodyLane } from './MelodyLane';

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
      detail: 1,
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
      detail: 1,
      clientX: POR_PULSO * 3 + 13,
      clientY: 5,
    });

    const [, start] = onAdd.mock.calls[0]!;
    expect(Number.isInteger(start * 4)).toBe(true);
  });
});

/**
 * Con el teclado el `click` llega sin puntero: `detail` a cero y las
 * coordenadas a cero. Leerlas escribía siempre la fila de arriba en el pulso
 * cero, pulsara uno la fila que pulsara.
 */
describe('Escribir con el teclado', () => {
  // `fireEvent.click` trae `detail` a cero, igual que el `click` de un Intro. Se
  // coge la primera fila con ese nombre, que es la aguda: hay notas repetidas.
  function teclear(nombre: string) {
    fireEvent.click(screen.getAllByRole('button', { name: `Escribir ${nombre} en Estrofa` })[0]!, {
      detail: 0,
    });
  }

  it('la fila que se activa es la nota que se escribe', () => {
    const { onAdd } = pintar();

    teclear('G');

    // Sol sobre Do son siete semitonos, y no la fila de arriba.
    expect(onAdd).toHaveBeenCalledWith(7, 0);
  });

  it('y va justo detras de la ultima nota', () => {
    const { onAdd } = pintar({
      notes: [
        { id: 'a', start: 0, length: 1, offset: 0 },
        { id: 'b', start: 2, length: 1.5, offset: 2 },
      ],
    });

    teclear('F');

    expect(onAdd).toHaveBeenCalledWith(5, 3.5);
  });

  // Fuera de la rejilla no se vería, y parecería que la tecla no ha hecho nada.
  it('sin salirse de la rejilla', () => {
    const { onAdd } = pintar({ notes: [{ id: 'a', start: 6, length: 4, offset: 0 }] });

    teclear('F');

    expect(onAdd).toHaveBeenCalledWith(5, 7.75);
  });

  it('con el puntero sigue mandando donde se pulso', () => {
    const { onAdd, rejilla } = pintar();
    cajaDeLaRejilla(rejilla, 8);

    fireEvent.click(screen.getAllByRole('button', { name: 'Escribir G en Estrofa' })[0]!, {
      detail: 1,
      clientX: POR_PULSO * 3 + 5,
      clientY: 5,
    });

    const [, start] = onAdd.mock.calls[0]!;
    expect(start).toBe(3);
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
      detail: 1,
      clientX: 200,
      clientY: 40,
    });

    expect(onAdd).not.toHaveBeenCalled();
  });

  /**
   * Lo que se coge mide al menos 24 por 24, que es lo que pide la norma, aunque
   * lo pintado sea más fino: una semicorchea pintada mide ocho de ancho.
   */
  it('la zona de agarre no baja de 24 aunque la nota sea corta', () => {
    pintar({ notes: [{ id: 'c', start: 0, length: 0.25, offset: 0 }] });
    const nota = screen.getByRole('button', { name: /^C, 0.25 pulsos/ });

    expect(nota.style.height).toBe(`${ALTO_FILA}px`);
    expect(nota.style.width).toBe('24px');
    expect(ALTO_FILA).toBeGreaterThanOrEqual(24);
  });

  // Estirar se mide desde lo pintado: en una nota corta, el aire de la zona de
  // agarre que sobresale no estira.
  it('en una nota corta, el aire de la derecha no la estira', () => {
    const { onResize, onMove, rejilla } = pintar({
      notes: [{ id: 'c', start: 0, length: 0.25, offset: 0 }],
    });
    cajaDeLaRejilla(rejilla, 8);
    const nota = screen.getByRole('button', { name: /^C, 0.25 pulsos/ });
    nota.getBoundingClientRect = () => ({ left: 0, right: 24, top: 0, bottom: 24 }) as DOMRect;

    fireEvent.pointerDown(nota, { button: 0, clientX: 20, clientY: 5 });
    arrastrarHasta(100, 5);
    soltarPuntero();

    expect(onResize).toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
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
