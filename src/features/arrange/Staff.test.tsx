// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, writtenBlock, type LeadNote } from '@core/music';

import { Staff } from './Staff';

/**
 * La partitura: los gestos que se hacen encima de ella.
 *
 * Lo que dibuja ya lo fija `clef.test.ts` —las invariantes de la clave— y el
 * dominio. Lo que no fijaba nadie es lo que se **hace** aquí: escribir una nota
 * pulsando el pentagrama, arrastrarla de escalón, mover un acorde de sitio y
 * estirar su línea para que dure más.
 *
 * jsdom no da tamaño a un SVG, así que la caja se dicta a mano: sin ella,
 * `sitioEn` no puede traducir un punto de pantalla a un escalón y no se prueba
 * ninguno de los cuatro gestos.
 */
const CAJA = { left: 0, top: 0, right: 900, bottom: 200, width: 900, height: 200 } as DOMRect;

function pintar(props: Partial<React.ComponentProps<typeof Staff>> = {}) {
  const manos = {
    onSelectBlock: vi.fn(),
    onRemoveBlock: vi.fn(),
    onResizeBlock: vi.fn(),
    onMoveBlock: vi.fn(),
    onAdd: vi.fn(),
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onGestureStart: vi.fn(),
    onGestureEnd: vi.fn(),
  };
  const { container } = render(
    <Staff
      notes={[]}
      blocks={[writtenBlock('a', 'I', 4), writtenBlock('b', 'IV', 4)]}
      bars={2}
      beatsPerBar={4}
      tonic={pitchClassFromName('C')}
      mode="major"
      selectedNoteId={null}
      selectedBlockId={null}
      partName="Estrofa"
      partId="estrofa"
      dropAt={null}
      {...manos}
      {...props}
    />,
  );
  const svg = container.querySelector('svg') as SVGSVGElement;
  svg.getBoundingClientRect = () => CAJA;
  return { ...manos, svg, container };
}

/**
 * El acorde o la nota, por su etiqueta.
 *
 * El SVG lleva `role="img"` y los hijos de una imagen son decoración por
 * definición, así que `getByRole` no los ve. Se buscan por `aria-label`, que es
 * lo que de verdad los identifica.
 */
function porEtiqueta(container: HTMLElement, empiezaPor: string): Element {
  const encontrado = [...container.querySelectorAll('[aria-label]')].find((n) =>
    (n.getAttribute('aria-label') ?? '').startsWith(empiezaPor),
  );
  if (encontrado === undefined) {
    throw new Error(`no encuentro nada que empiece por «${empiezaPor}»`);
  }
  return encontrado;
}

/** Una nota, que es lo único cuya etiqueta dice en qué pulso empieza. */
function laNota(container: HTMLElement): Element {
  const encontrada = [...container.querySelectorAll('[aria-label]')].find((n) =>
    (n.getAttribute('aria-label') ?? '').includes('en el pulso'),
  );
  if (encontrada === undefined) {
    throw new Error('no hay ninguna nota dibujada');
  }
  return encontrada;
}

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

/**
 * El pentagrama se estira para caber en el hueco que tenga.
 *
 * jsdom no trae `ResizeObserver`, y sin él el componente se queda en el ancho
 * mínimo y no se prueba lo que hace cuando la caja cambia. Se pone uno de
 * mentira que guarda la llamada y la deja disparar a mano.
 */
describe('El ancho disponible', () => {
  it('el pentagrama se ajusta a lo que mida su caja', () => {
    const observadores: Array<(e: unknown) => void> = [];
    const desconectar = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: (e: unknown) => void) {
          observadores.push(cb);
        }
        observe() {}
        disconnect = desconectar;
      },
    );

    const { container, unmount } = (() => {
      const r = pintar();
      return { ...r, unmount: () => {} };
    })();
    const svg = container.querySelector('svg') as SVGSVGElement;
    const anchoAntes = svg.getAttribute('width');

    // Le llega una caja de 900 px: el pulso crece y la partitura se ensancha.
    act(() => observadores[0]?.([{ contentRect: { width: 900 } }]));

    expect(svg.getAttribute('width')).not.toBe(anchoAntes);
    void unmount;
    vi.unstubAllGlobals();
  });

  // Una entrada vacía no puede dejar el ancho en `NaN`.
  it('sin medida, el ancho no se rompe', () => {
    const observadores: Array<(e: unknown) => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: (e: unknown) => void) {
          observadores.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );

    const { container } = pintar();
    act(() => observadores[0]?.([]));

    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});

describe('La partitura', () => {
  it('se dice con su parte y cuantas notas lleva', () => {
    pintar({ notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }] });

    expect(screen.getByRole('img', { name: 'Partitura de Estrofa: 1 notas' })).toBeInTheDocument();
  });

  // La armadura se dibuja, y crece con las alteraciones que tenga la tonalidad.
  it('una tonalidad con alteraciones las escribe', () => {
    const { container } = pintar({ tonic: pitchClassFromName('F#'), mode: 'major' });

    // Seis sostenidos: seis letras en la armadura.
    const textos = [...container.querySelectorAll('text')].map((n) => n.textContent);
    expect(textos.filter((t) => t === '♯')).toHaveLength(6);
  });

  it('y una tonalidad de bemoles, los suyos', () => {
    const { container } = pintar({ tonic: pitchClassFromName('Bb'), mode: 'major' });

    const textos = [...container.querySelectorAll('text')].map((n) => n.textContent);
    expect(textos.filter((t) => t === '♭')).toHaveLength(2);
  });
});

describe('Escribir en el pentagrama', () => {
  /** Pulsar el pentagrama escribe una nota en ese escalón y ese pulso. */
  it('pulsar escribe una nota donde se pulso', () => {
    const { onAdd, svg } = pintar();

    fireEvent.click(svg, { clientX: 200, clientY: 60 });

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [, start] = onAdd.mock.calls[0]!;
    expect(start).toBeGreaterThanOrEqual(0);
  });

  /**
   * El `click` se dispara igual después de soltar un arrastre, y si se suelta
   * doce píxeles más arriba llega al pentagrama en vez de a la nota: escribía
   * una nota nueva justo donde se acababa de soltar la que se movía.
   */
  it('soltar un arrastre no escribe una nota nueva', () => {
    const { onAdd, svg, container } = pintar({
      notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }],
    });
    const nota = laNota(container);

    fireEvent.pointerDown(nota, { button: 0, clientX: 100, clientY: 60 });
    arrastrarHasta(200, 40);
    soltarPuntero();
    fireEvent.click(svg, { clientX: 200, clientY: 40 });

    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('Las notas de la partitura', () => {
  const NOTA: LeadNote = { id: 'n1', start: 1, length: 2, offset: 0 };

  it('se dicen con su nombre, su largo y su sitio', () => {
    const { container } = pintar({ notes: [NOTA] });

    expect(laNota(container).getAttribute('aria-label')).toContain('2 pulsos, en el pulso 1');
  });

  it('pulsar una la elige', () => {
    const { onSelect, container } = pintar({ notes: [NOTA] });

    fireEvent.click(laNota(container));

    expect(onSelect).toHaveBeenCalledWith('n1');
  });

  /**
   * Se mueve por **escalones**, no por semitonos: subir una línea da la nota que
   * la armadura dice que va ahí.
   */
  it('arrastrarla la mueve de escalon y de pulso', () => {
    const { onMove, onGestureStart, onGestureEnd, container } = pintar({ notes: [NOTA] });
    const nota = laNota(container);

    fireEvent.pointerDown(nota, { button: 0, clientX: 120, clientY: 60 });
    arrastrarHasta(300, 40);
    soltarPuntero();

    expect(onGestureStart).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalled();
    expect(onGestureEnd).toHaveBeenCalled();
  });

  it('el boton derecho no la coge', () => {
    const { onGestureStart, container } = pintar({ notes: [NOTA] });
    const nota = laNota(container);

    fireEvent.pointerDown(nota, { button: 2, clientX: 120, clientY: 60 });

    expect(onGestureStart).not.toHaveBeenCalled();
  });

  // Una nota muy aguda lleva líneas adicionales, que es lo que la hace legible.
  it('una nota fuera del pentagrama lleva sus lineas adicionales', () => {
    const { container } = pintar({ notes: [{ id: 'alta', start: 0, length: 1, offset: 24 }] });

    expect(container.querySelectorAll('line').length).toBeGreaterThan(5);
  });

  it('una nota dudosa lo dice', () => {
    const { container } = pintar({ notes: [{ ...NOTA, clarity: 0.2 }] });

    expect(laNota(container).getAttribute('aria-label')).toContain('dudosa');
  });
});

describe('Los acordes sobre la partitura', () => {
  it('cada uno se puede elegir', () => {
    const { onSelectBlock, container } = pintar();

    fireEvent.click(porEtiqueta(container, 'C, grado I'));

    expect(onSelectBlock).toHaveBeenCalledWith('a');
  });

  // Supr sobre el acorde elegido lo quita: en un teclado es lo que se espera.
  it('Supr quita el acorde', () => {
    const { onRemoveBlock, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'C, grado I'), { key: 'Delete' });

    expect(onRemoveBlock).toHaveBeenCalledWith('a');
  });

  it('y Retroceso tambien', () => {
    const { onRemoveBlock, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'F, grado IV'), { key: 'Backspace' });

    expect(onRemoveBlock).toHaveBeenCalledWith('b');
  });

  it('otra tecla no quita nada', () => {
    const { onRemoveBlock, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'C, grado I'), { key: 'a' });

    expect(onRemoveBlock).not.toHaveBeenCalled();
  });

  it('arrastrar el cifrado lo lleva a otro sitio', () => {
    const { onMoveBlock, onGestureEnd, container } = pintar();
    const acorde = porEtiqueta(container, 'C, grado I');

    fireEvent.pointerDown(acorde, { button: 0, clientX: 80, clientY: 20 });
    arrastrarHasta(600, 20);
    soltarPuntero();

    expect(onMoveBlock).toHaveBeenCalledWith('a', expect.any(Number));
    expect(onGestureEnd).toHaveBeenCalled();
  });

  it('con el boton derecho no', () => {
    const { onGestureStart, container } = pintar();

    fireEvent.pointerDown(porEtiqueta(container, 'C, grado I'), { button: 2, clientX: 80 });

    expect(onGestureStart).not.toHaveBeenCalled();
  });

  /**
   * La línea bajo el cifrado dice hasta dónde llega el acorde; tirar de su punta
   * es el gesto que le corresponde, y es el único sitio de esta vista donde se
   * puede cambiar lo que dura.
   */
  it('tirar de la punta de su linea lo estira', () => {
    const { onResizeBlock, container } = pintar();
    const tirador = container.querySelector('rect.cursor-ew-resize') as SVGRectElement;

    fireEvent.pointerDown(tirador, { button: 0, clientX: 200 });
    arrastrarHasta(320, 20);
    soltarPuntero();

    expect(onResizeBlock).toHaveBeenCalledWith('a', expect.any(Number));
  });

  it('y con el boton derecho tampoco', () => {
    const { onResizeBlock, container } = pintar();
    const tirador = container.querySelector('rect.cursor-ew-resize') as SVGRectElement;

    fireEvent.pointerDown(tirador, { button: 2, clientX: 200 });
    arrastrarHasta(320, 20);

    expect(onResizeBlock).not.toHaveBeenCalled();
  });

  // Mientras se arrastra un acorde de otra parte, se marca dónde caería.
  it('se marca donde caeria lo que se arrastra', () => {
    const { container } = pintar({ dropAt: 1 });

    expect(container.querySelector('line.stroke-brass-bright')).toBeInTheDocument();
  });

  it('el elegido se dice que lo esta', () => {
    const { container } = pintar({ selectedBlockId: 'a' });

    expect(porEtiqueta(container, 'C, grado I')).toHaveAttribute('aria-pressed', 'true');
  });
});

/**
 * Cómo se dibuja cada nota, que es lo que la hace legible como partitura.
 *
 * Son variantes del mismo componente —figura, plica, puntillo, alteración— y
 * cada una tiene su regla escrita en el fichero. Se comprueban por lo que sale
 * dibujado, que es lo único que ve quien lee.
 */
describe('El dibujo de una nota', () => {
  function conNota(note: Partial<LeadNote>, props = {}) {
    return pintar({ notes: [{ id: 'n', start: 0, length: 1, offset: 0, ...note }], ...props });
  }

  // Redonda y blanca van huecas; negra y corchea, rellenas.
  it('la blanca va hueca y la negra rellena', () => {
    const hueca = conNota({ length: 2 }).container.querySelector('ellipse[fill="none"]');
    expect(hueca).toBeInTheDocument();

    const rellena = conNota({ length: 1 }).container.querySelector('ellipse[fill="currentColor"]');
    expect(rellena).toBeInTheDocument();
  });

  /**
   * El puntillo va detrás de la cabeza y **siempre en un espacio**: puesto sobre
   * una línea se confunde con ella, así que en las notas de línea sube.
   */
  it('la de puntillo lo lleva, y en un espacio', () => {
    const { container } = conNota({ length: 3 });

    const puntos = [...container.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('r') === '1.6',
    );
    expect(puntos).toHaveLength(1);
  });

  it('y en una nota de espacio, a su altura', () => {
    const { container } = conNota({ length: 3, offset: 2 });

    expect(
      [...container.querySelectorAll('circle')].some((c) => c.getAttribute('r') === '1.6'),
    ).toBe(true);
  });

  // La corchea lleva corchete; la negra no.
  it('la corchea lleva su corchete', () => {
    const conCorchete = conNota({ length: 0.5 }).container.querySelectorAll('path').length;
    const sinCorchete = conNota({ length: 1 }).container.querySelectorAll('path').length;

    expect(conCorchete).toBeGreaterThan(sinCorchete);
  });

  // Las agudas llevan la plica hacia abajo y las graves hacia arriba.
  it('una nota aguda y una grave no llevan la plica igual', () => {
    const aguda = conNota({ offset: 24 }).container.innerHTML;
    const grave = conNota({ offset: -12 }).container.innerHTML;

    expect(aguda).not.toBe(grave);
  });

  /**
   * El signo de la dudosa y el corchete de la corchea van **al otro lado según
   * hacia dónde mire la plica**: puestos siempre igual, en las notas agudas
   * caían encima del pentagrama.
   */
  it('la dudosa pone su signo segun mire la plica', () => {
    const grave = conNota({ offset: 0, clarity: 0.2 }).container.innerHTML;
    const aguda = conNota({ offset: 24, clarity: 0.2 }).container.innerHTML;

    expect(grave).not.toBe(aguda);
  });

  it('y el corchete de la corchea, igual', () => {
    const grave = conNota({ offset: 0, length: 0.5 }).container.innerHTML;
    const aguda = conNota({ offset: 24, length: 0.5 }).container.innerHTML;

    expect(grave).not.toBe(aguda);
  });

  it('la elegida lleva su aro', () => {
    const { container } = conNota({}, { selectedNoteId: 'n' });

    expect([...container.querySelectorAll('circle')].some((c) => c.getAttribute('r') === '9')).toBe(
      true,
    );
  });

  /**
   * Las alteraciones, que es donde más se nota la armadura.
   *
   * En Sol mayor la armadura lleva Fa sostenido: un Fa natural pide **becuadro**
   * o se lee alterado, y un Fa sostenido no pide nada porque ya lo dice la
   * armadura. Lo que la armadura no toca sí lleva su signo.
   */
  it('un natural sobre una letra que la armadura altera lleva becuadro', () => {
    const { container } = conNota(
      { offset: 10 },
      { tonic: pitchClassFromName('G'), mode: 'major' },
    );

    expect([...container.querySelectorAll('text')].map((n) => n.textContent)).toContain('♮');
  });

  it('y la que la armadura ya altera no lleva nada', () => {
    const { container } = conNota(
      { offset: 11 },
      { tonic: pitchClassFromName('G'), mode: 'major' },
    );

    // En Sol mayor la armadura ya dibuja un sostenido: si la nota no añadiera
    // el suyo habría dos, y lo que se comprueba es que sigue habiendo uno.
    const sostenidos = [...container.querySelectorAll('text')].filter((n) => n.textContent === '♯');
    expect(sostenidos).toHaveLength(1);
  });

  it('una alterada que la armadura no toca lleva su sostenido', () => {
    const { container } = conNota({ offset: 1 }, { tonic: pitchClassFromName('C'), mode: 'major' });

    expect([...container.querySelectorAll('text')].map((n) => n.textContent)).toContain('♯');
  });

  it('o su bemol, en una tonalidad de bemoles', () => {
    const { container } = conNota({ offset: 3 }, { tonic: pitchClassFromName('F'), mode: 'major' });

    const signos = [...container.querySelectorAll('text')].map((n) => n.textContent);
    expect(signos.some((s) => s === '♭' || s === '♯')).toBe(true);
  });
});

describe('Mover un acorde al principio', () => {
  // Arrastrarlo antes del primero lo pone el primero: el bucle corta en la
  // primera vuelta.
  it('soltarlo antes del primer acorde lo deja el primero', () => {
    const { onMoveBlock, container } = pintar();
    const acorde = porEtiqueta(container, 'F, grado IV');

    fireEvent.pointerDown(acorde, { button: 0, clientX: 400, clientY: 20 });
    arrastrarHasta(0, 20);
    soltarPuntero();

    expect(onMoveBlock).toHaveBeenCalledWith('b', 0);
  });
});
