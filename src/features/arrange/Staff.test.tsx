// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, writtenBlock, type LeadNote } from '@core/music';

import { CIFRAS_DEL_COMPAS, repartoEnSistemas, Staff } from './Staff';

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
    onBlockKeyDown: vi.fn(),
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
      corrigiendoBlockId={null}
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
 * Se buscan por el principio del `aria-label`, que es lo que los identifica: el
 * nombre entero lleva el grado y los pulsos, y repetirlo en cada test sería
 * atarlos a una redacción.
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
  /**
   * **Un grupo y no una imagen.** Los hijos de una imagen son decoración por
   * definición, así que con `img` los acordes y las notas no existían para un
   * lector de pantalla, y axe lo marca como interactivos anidados.
   */
  it('lo que se elige dentro se anuncia como boton', () => {
    pintar({ notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }] });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^C, grado I/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /en el pulso 0/ })).toBeInTheDocument();
  });

  // El lector decía «1 pulsos» en cada negra y «1 notas» en cada partitura.
  it('se dice con su parte y cuantas notas lleva, en singular si es una', () => {
    pintar({ notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }] });

    expect(screen.getByRole('group', { name: 'Partitura de Estrofa: 1 nota' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /, 1 pulso, en el pulso 0$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^C, grado I, 4 pulsos/ })).toBeInTheDocument();
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

  /**
   * **Un pentagrama vacío no dice qué espera.** Con la canción escrita solo con
   * acordes —el caso normal al empezar— salen los cifrados arriba y cinco líneas
   * en blanco debajo. Quien lee partituras entiende una hoja guía sin melodía;
   * quien no, ve una pantalla rota.
   */
  it('sin punteo dice que aqui se escribe', () => {
    pintar({ notes: [] });

    expect(screen.getByText(/aquí se escribe el punteo/i)).toBeInTheDocument();
  });

  /**
   * En una sola línea medía unos doscientos ochenta píxeles y en un teléfono se
   * cortaba contra el borde de la hoja. Va en dos, y si ni así cabe donde empieza
   * la música se corre hacia la clave.
   */
  it('la pista va en dos lineas', () => {
    const { container } = pintar({ notes: [] });

    expect(container.querySelectorAll('text tspan')).toHaveLength(2);
  });

  /**
   * **Y se lee como una frase.** Los dos renglones son dos `tspan` pegados, y un
   * lector junta su texto sin separarlo: oía «pentagramay aquí».
   */
  it('las dos lineas se leen separadas por un espacio', () => {
    const { container } = pintar({ notes: [] });
    const pista = [...container.querySelectorAll('text')].find((n) =>
      /Pulsa en el pentagrama/.test(n.textContent ?? ''),
    )!;

    expect(pista.textContent).toBe('Pulsa en el pentagrama y aquí se escribe el punteo.');
  });

  /**
   * Iba a once píxeles y arrancando pegada a la clave. A doce, que es el mínimo
   * de la casa, y centrada bajo la música, que es donde se escribe.
   */
  it('la pista va a doce y centrada', () => {
    const { container } = pintar({ notes: [] });
    const pista = [...container.querySelectorAll('text')].find((n) =>
      /Pulsa en el pentagrama/.test(n.textContent ?? ''),
    )!;

    expect(Number(pista.getAttribute('font-size'))).toBeGreaterThanOrEqual(12);
    expect(pista.getAttribute('text-anchor')).toBe('middle');
  });

  it('y en una hoja estrecha se corre hacia la izquierda sin salirse', () => {
    const estrecha = pintar({ notes: [], bars: 1, beatsPerBar: 2 }).container;
    const ancha = pintar({ notes: [], bars: 4 }).container;
    const xDe = (c: HTMLElement) =>
      Number(
        [...c.querySelectorAll('text')]
          .find((n) => /Pulsa en el pentagrama/.test(n.textContent ?? ''))!
          .getAttribute('x'),
      );
    const anchoDe = (c: HTMLElement) => Number(c.querySelector('svg')!.getAttribute('width'));

    // `x` es el centro de la frase, así que la mitad de lo que mide tiene que
    // caber a cada lado.
    expect(xDe(estrecha)).toBeLessThan(xDe(ancha));
    expect(xDe(estrecha) - 88).toBeGreaterThanOrEqual(4);
    expect(xDe(ancha) + 88).toBeLessThanOrEqual(anchoDe(ancha));
  });

  it('y en cuanto hay una nota se calla', () => {
    pintar({ notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }] });

    expect(screen.queryByText(/aquí se escribe el punteo/i)).not.toBeInTheDocument();
  });

  /**
   * Pulsar el pentagrama **es** como se escribe una nota, así que el rótulo no
   * puede comerse el clic: sería convertir la ayuda en un estorbo.
   */
  it('el aviso no se come la pulsacion', () => {
    const { container } = pintar({ notes: [] });

    const aviso = [...container.querySelectorAll('text')].find((n) =>
      /aquí se escribe/i.test(n.textContent ?? ''),
    );
    expect(aviso).toBeDefined();
    expect(aviso!.classList.contains('pointer-events-none')).toBe(true);
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

  // Con el teclado: un `<g>` no convierte `Intro` en `click` como un botón.
  it('Intro sobre una nota la elige', () => {
    const { onSelect, container } = pintar({ notes: [NOTA] });

    fireEvent.keyDown(laNota(container), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('n1');
  });

  it('y otra tecla no', () => {
    const { onSelect, container } = pintar({ notes: [NOTA] });

    fireEvent.keyDown(laNota(container), { key: 'a' });

    expect(onSelect).not.toHaveBeenCalled();
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
  /**
   * El cifrado es el mando principal de la vista por defecto, y medía 29 px de
   * alto: aquí valen los mismos 44 que en todo lo que se pulsa, también dentro
   * de un SVG. El dibujo es el mismo; crece la zona transparente que se toca.
   */
  it('su zona de agarre mide los 44 px de la casa', () => {
    const { container } = pintar();
    const agarre = porEtiqueta(container, 'C, grado I').querySelector('rect') as SVGRectElement;

    expect(Number(agarre.getAttribute('height'))).toBe(44);
  });

  // Y se lee a un metro: veintidós píxeles en la letra de los títulos, no en la
  // monoespaciada, que es para lo que se alinea en columna.
  it('se escribe a veintidos en la letra de los titulos', () => {
    const { container } = pintar();
    const cifrado = porEtiqueta(container, 'C, grado I').querySelector('text') as SVGTextElement;

    expect(Number(cifrado.getAttribute('font-size'))).toBe(22);
    expect(cifrado).toHaveClass('font-display');
    expect(cifrado.getAttribute('font-family')).toBeNull();
  });

  /**
   * Un barrido de arriba abajo que nazca en un cifrado sigue siendo desplazar
   * la hoja: solo se le quita al navegador el eje por el que el acorde se mueve.
   * Las notas, que se mueven en los dos, se quedan con el gesto entero.
   */
  it('deja al navegador el desplazamiento vertical, y una nota no', () => {
    const { container } = pintar({
      notes: [{ id: 'n', offset: 0, start: 0, length: 1 }],
    });

    expect(porEtiqueta(container, 'C, grado I')).toHaveStyle({ touchAction: 'pan-y' });
    expect(laNota(container)).toHaveStyle({ touchAction: 'none' });
  });

  it('cada uno se puede elegir', () => {
    const { onSelectBlock, container } = pintar();

    fireEvent.click(porEtiqueta(container, 'C, grado I'));

    expect(onSelectBlock).toHaveBeenCalledWith('a');
  });

  /**
   * Las teclas de un acorde —Supr, flechas, `Shift` y flechas— **las decide el
   * lienzo**, el mismo para las dos vistas: aquí solo se le dice qué acorde.
   * Cuando la partitura las resolvía por su cuenta, solo sabía de `Supr`, y las
   * flechas que el panel prometía no movían nada.
   */
  it('las teclas de un acorde se las lleva el lienzo, con su acorde', () => {
    const { onBlockKeyDown, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'C, grado I'), { key: 'Delete' });
    fireEvent.keyDown(porEtiqueta(container, 'F, grado IV'), { key: 'ArrowRight' });

    expect(onBlockKeyDown).toHaveBeenNthCalledWith(1, expect.anything(), 'a');
    expect(onBlockKeyDown).toHaveBeenNthCalledWith(2, expect.anything(), 'b');
  });

  /**
   * Con el teclado se llegaba al acorde y no había forma de elegirlo: un `<g>`
   * no convierte `Intro` ni `Espacio` en `click`, como sí hace un botón.
   */
  it('Intro elige el acorde', () => {
    const { onSelectBlock, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'C, grado I'), { key: 'Enter' });

    expect(onSelectBlock).toHaveBeenCalledWith('a');
  });

  it('y Espacio tambien, sin desplazar la pagina', () => {
    const { onSelectBlock, container } = pintar();

    const siguio = fireEvent.keyDown(porEtiqueta(container, 'F, grado IV'), { key: ' ' });

    expect(onSelectBlock).toHaveBeenCalledWith('b');
    expect(siguio).toBe(false);
  });

  // Intro y Espacio eligen y no siguen hasta el lienzo: elegir no es mover.
  it('Intro elige y no se la pasa al lienzo', () => {
    const { onBlockKeyDown, onSelectBlock, container } = pintar();

    fireEvent.keyDown(porEtiqueta(container, 'C, grado I'), { key: 'Enter' });

    expect(onSelectBlock).toHaveBeenCalledWith('a');
    expect(onBlockKeyDown).not.toHaveBeenCalled();
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

  /**
   * **Y la semicorchea lleva dos**, que es lo que la distingue de la corchea.
   *
   * Con uno solo, un punteo rápido saldría escrito al doble de lo que dura. El
   * número de corchetes *es* la figura, así que no es un adorno: es el dato.
   */
  it('la semicorchea lleva dos corchetes, uno mas que la corchea', () => {
    const semi = conNota({ length: 0.25 }).container.querySelectorAll('path').length;
    const corchea = conNota({ length: 0.5 }).container.querySelectorAll('path').length;

    expect(semi).toBe(corchea + 1);
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

/**
 * La indicación de compás, medida como se mide la clave en `clef.test.ts`: por
 * lo que tiene que cumplir y no por cómo se ve.
 *
 * Estaba a ojo y salía media pauta corrida hacia abajo: el número de arriba en
 * la mitad de abajo, el de abajo colgando por debajo de la primera línea.
 */
describe('La indicación de compás', () => {
  const C = CIFRAS_DEL_COMPAS;

  it('la de arriba llena de la quinta linea a la tercera', () => {
    expect(C.baseArriba).toBe(C.lineaDelMedio);
    expect(C.baseArriba - C.alto).toBe(C.lineaDeArriba);
  });

  it('y la de abajo, de la tercera a la primera, sin colgar', () => {
    expect(C.baseAbajo).toBe(C.lineaDeAbajo);
    expect(C.baseAbajo - C.alto).toBe(C.lineaDelMedio);
  });

  // Lo que se ve de una cifra es algo menos de tres cuartos de su cuerpo: es esa
  // altura, y no el `fontSize`, la que tiene que medir dos espacios.
  it('el cuerpo de letra es el que da esa altura a una cifra', () => {
    expect(C.cuerpo * 0.72).toBeCloseTo(C.alto, 5);
  });

  it('las lineas que dice son las que se dibujan', () => {
    const { container } = pintar();
    const alturas = new Set(
      [...container.querySelectorAll('[data-sistema="0"] > line')].map((l) =>
        Number(l.getAttribute('y1')),
      ),
    );

    expect(alturas).toContain(C.lineaDeArriba);
    expect(alturas).toContain(C.lineaDelMedio);
    expect(alturas).toContain(C.lineaDeAbajo);
  });

  it('y las cifras se asientan donde dice', () => {
    const { container } = pintar({ beatsPerBar: 3 });
    const cifras = [...container.querySelectorAll('text')].filter((t) =>
      /^[34]$/.test(t.textContent ?? ''),
    );

    expect(cifras.map((t) => Number(t.getAttribute('y')))).toEqual([C.baseArriba, C.baseAbajo]);
    expect(Number(cifras[0]!.parentElement!.getAttribute('font-size'))).toBe(C.cuerpo);
  });
});

/**
 * **Lo que no cabe en una línea se parte en sistemas**, como una partitura de
 * verdad (adr/0064). A 390 de pantalla, cuatro compases medían 552 en una caja
 * de 364 y el cuarto quedaba detrás de un desplazamiento sin pista.
 */
describe('Los sistemas', () => {
  // Do mayor no lleva armadura: este es su margen, el de `Staff.tsx`.
  const MARGEN_DO = 44 + 24 + 12;
  const anchoDeHoja = (r: ReturnType<typeof repartoEnSistemas>, margen: number) =>
    margen + r.porSistema * 4 * r.porPulso + 8 + 18;

  it('en un telefono van dos compases por linea, y caben', () => {
    const reparto = repartoEnSistemas(364, MARGEN_DO, 4, 4);

    expect(reparto).toMatchObject({ sistemas: 2, porSistema: 2 });
    expect(anchoDeHoja(reparto, MARGEN_DO)).toBeLessThanOrEqual(364);
  });

  // A 1440 desbordaba catorce píxeles: el relleno y el borde de la hoja no se
  // descontaban del ancho que se repartía.
  it('en un escritorio van en una, y la hoja no se sale de su caja', () => {
    const reparto = repartoEnSistemas(713, MARGEN_DO, 4, 4);

    expect(reparto.sistemas).toBe(1);
    expect(anchoDeHoja(reparto, MARGEN_DO)).toBeLessThanOrEqual(713);
  });

  it('los compases se reparten a partes iguales, no cuatro y uno colgando', () => {
    // Caben cuatro por línea a pulso mínimo, y son cinco.
    const reparto = repartoEnSistemas(560, MARGEN_DO, 5, 4);

    expect(reparto).toMatchObject({ sistemas: 2, porSistema: 3 });
  });

  it('sin medida no se parte', () => {
    expect(repartoEnSistemas(0, MARGEN_DO, 8, 4).sistemas).toBe(1);
  });

  describe('dibujados', () => {
    function enUnTelefono(props: Partial<React.ComponentProps<typeof Staff>> = {}) {
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
      const r = pintar({ bars: 4, ...props });
      act(() => observadores[0]?.([{ contentRect: { width: 364 } }]));
      vi.unstubAllGlobals();
      return r;
    }

    it('cada sistema lleva su clave y su armadura, y el compas solo el primero', () => {
      const { container } = enUnTelefono({ tonic: pitchClassFromName('G'), mode: 'major' });
      const sistemas = container.querySelectorAll('[data-sistema]');

      expect(sistemas).toHaveLength(2);
      for (const sistema of sistemas) {
        expect(sistema.querySelector('path')).toBeInTheDocument();
        expect([...sistema.querySelectorAll('text')].map((t) => t.textContent)).toContain('♯');
      }
      const cuatros = [...container.querySelectorAll('text')].filter((t) => t.textContent === '4');
      expect(cuatros).toHaveLength(2);
      expect(sistemas[1]!.textContent).not.toContain('4');
    });

    // La barra final solo en el último: el primero acaba en una divisoria.
    it('solo el ultimo acaba en barra final', () => {
      const { container } = enUnTelefono();
      const gruesas = (s: string) =>
        container.querySelectorAll(`[data-sistema="${s}"] line[stroke-width="3"]`).length;

      expect(gruesas('0')).toBe(0);
      expect(gruesas('1')).toBe(1);
    });

    // Un acorde que cruza el final de un renglón sigue en el de abajo.
    it('un acorde que cruza de linea lleva un tramo en cada una', () => {
      const { container } = enUnTelefono({
        blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'IV', 8)],
      });
      const acorde = porEtiqueta(container, 'F, grado IV');

      expect(acorde.querySelectorAll('line')).toHaveLength(2);
    });

    it('y uno que acaba justo en la barra se queda en su linea', () => {
      const { container } = enUnTelefono();

      expect(porEtiqueta(container, 'F, grado IV').querySelectorAll('line')).toHaveLength(1);
    });

    // La nota del segundo renglón baja con él.
    it('una nota del segundo sistema baja con el', () => {
      const { container } = enUnTelefono({ notes: [{ id: 'n', start: 9, length: 1, offset: 0 }] });

      expect(laNota(container).getAttribute('transform')).toMatch(/^translate\(0 \d+/);
    });

    // Y pulsar en el segundo escribe en sus compases, no en los del primero.
    it('pulsar en el segundo sistema escribe en sus compases', () => {
      const { svg, onAdd } = enUnTelefono();
      const alto = Number(svg.getAttribute('height')) / 2;

      fireEvent.click(svg, { clientX: 100, clientY: alto + 60 });

      expect(onAdd.mock.calls[0]![1]).toBeGreaterThanOrEqual(8);
    });

    it('la marca de donde caeria va en su sistema', () => {
      const { container } = enUnTelefono({
        blocks: [writtenBlock('a', 'I', 8), writtenBlock('b', 'IV', 8)],
        dropAt: 1,
      });

      expect(
        container.querySelector('line.stroke-brass-bright')!.getAttribute('transform'),
      ).toMatch(/^translate/);
    });
  });
});

/**
 * **Lo que sobra a lo ancho se gasta en escala** (adr/0119). Con el pulso en su
 * tope, cuatro compases medían 824 píxeles en un hueco de 1.520 y dejaban la
 * hoja en una franja de 154 de alto: un diagrama pequeño en una pantalla que se
 * lee a un metro.
 */
describe('La escala de la hoja', () => {
  const MARGEN_DO = 44 + 24 + 12;
  const anchoNatural = (r: ReturnType<typeof repartoEnSistemas>) =>
    MARGEN_DO + r.porSistema * 4 * r.porPulso + 8;

  it('sin medida, ni en un telefono, no se agranda', () => {
    expect(repartoEnSistemas(0, MARGEN_DO, 4, 4).escala).toBe(1);
    expect(repartoEnSistemas(364, MARGEN_DO, 4, 4).escala).toBeCloseTo(1, 1);
  });

  it('con papel de sobra, llena el ancho de su caja', () => {
    const reparto = repartoEnSistemas(1520, MARGEN_DO, 4, 4);

    expect(reparto.escala).toBeGreaterThan(1.5);
    expect(anchoNatural(reparto) * reparto.escala).toBeCloseTo(1520 - 18, 0);
  });

  it('y no pasa del doble, para que un compas no sea un cartel', () => {
    expect(repartoEnSistemas(1900, MARGEN_DO, 1, 4).escala).toBe(2);
  });

  describe('dibujada', () => {
    function enUnaPantallaAncha(props: Partial<React.ComponentProps<typeof Staff>> = {}) {
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
      const r = pintar({ bars: 4, ...props });
      act(() => observadores[0]?.([{ contentRect: { width: 1520 } }]));
      vi.unstubAllGlobals();
      const reparto = repartoEnSistemas(1520, MARGEN_DO, 4, 4);
      return { ...r, reparto };
    }

    it('el dibujo crece entero y el viewBox no cambia', () => {
      const { svg, reparto } = enUnaPantallaAncha();
      const caja = svg.getAttribute('viewBox')!.split(' ').map(Number);

      expect(Number(svg.getAttribute('width'))).toBeCloseTo(caja[2]! * reparto.escala, 3);
      expect(Number(svg.getAttribute('height'))).toBeCloseTo(caja[3]! * reparto.escala, 3);
    });

    // El cifrado sigue a veintidós en pantalla: no crece con la hoja.
    it('el cifrado mide lo mismo en pantalla', () => {
      const { container, reparto } = enUnaPantallaAncha();
      const cifrado = porEtiqueta(container, 'C, grado I').querySelector('text')!;

      expect(Number(cifrado.getAttribute('font-size')) * reparto.escala).toBeCloseTo(22, 3);
    });

    // Pulsar en la hoja escalada escribe donde se pulsa, no más a la derecha.
    it('pulsar escribe en el pulso de debajo del dedo', () => {
      const { svg, onAdd, reparto } = enUnaPantallaAncha();
      const x = (MARGEN_DO + 2 * reparto.porPulso) * reparto.escala;

      fireEvent.click(svg, { clientX: x, clientY: 60 * reparto.escala });

      expect(onAdd.mock.calls[0]![1]).toBe(2);
    });

    // Y estirar cuenta el arrastre en pulsos de la hoja, no de la pantalla.
    it('estirar un pulso es arrastrar un pulso de la hoja escalada', () => {
      const { container, onResizeBlock, reparto } = enUnaPantallaAncha();
      const tirador = container.querySelector('rect.cursor-ew-resize') as SVGRectElement;

      fireEvent.pointerDown(tirador, { button: 0, clientX: 200 });
      arrastrarHasta(200 + reparto.porPulso * reparto.escala, 20);
      soltarPuntero();

      expect(onResizeBlock).toHaveBeenLastCalledWith('a', 5);
    });
  });
});

/**
 * El aviso de lo traído promete que los dudosos «salen marcados con «?»», y en
 * la partitura —la vista de entrada— no salía ninguno.
 */
describe('La duda en la partitura', () => {
  const dudoso = {
    ...writtenBlock('a', 'I', 4),
    source: 'heard' as const,
    confidence: 0.01,
    alternatives: ['vi' as const],
  };

  it('un acorde dudoso lleva su interrogante, su linea punteada y lo dice', () => {
    const { container } = pintar({ blocks: [dudoso, writtenBlock('b', 'IV', 4)] });
    const acorde = porEtiqueta(container, 'C, grado I');

    expect(acorde.getAttribute('aria-label')).toMatch(/, dudoso$/);
    expect(acorde.querySelector('tspan')).toHaveTextContent('?');
    expect(acorde.querySelector('line')!.getAttribute('stroke-dasharray')).toBe('3 3');
    expect(porEtiqueta(container, 'F, grado IV').querySelector('tspan')).toBeNull();
  });

  // «Apunté Em» no decía de cuál: el que se pregunta va recuadrado.
  it('el que se esta corrigiendo va recuadrado, y solo ese', () => {
    const { container } = pintar({
      blocks: [dudoso, writtenBlock('b', 'IV', 4)],
      corrigiendoBlockId: 'a',
    });

    expect(porEtiqueta(container, 'C, grado I').querySelector('[data-corrigiendo]')).not.toBeNull();
    expect(container.querySelectorAll('[data-corrigiendo]')).toHaveLength(1);
  });
});
