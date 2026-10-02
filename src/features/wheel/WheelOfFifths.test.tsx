// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';

import { DIANA, INNER_RADIUS, RING_RADIUS, WheelOfFifths } from './WheelOfFifths';

/**
 * La rueda de quintas.
 *
 * Lo que hay que defender aquí no es el dibujo, que cambia: es **que sea un
 * mando y no una lista de veinticuatro enlaces**. Entrar en componer con el
 * teclado y llegar a los acordes costaba pasar una a una por las doce mayores y
 * las doce menores; una rueda se tabula una vez y se recorre con las flechas.
 *
 * Y que se anuncie por lo que es: donde se pulsa, un grupo de controles con su
 * nombre; en la portada, donde no se pulsa, una imagen con su descripción.
 */
const C = pitchClassFromName('C');

function elegible(onPick = vi.fn()) {
  render(<WheelOfFifths tonic={C} mode="major" onPick={onPick} />);
  return onPick;
}

describe('la rueda como mando', () => {
  it('se anuncia como grupo, y dice como se usa', () => {
    elegible();

    expect(screen.getByRole('group')).toHaveAccessibleName(
      /elige la tonalidad, y muévete con las flechas/i,
    );
  });

  /**
   * En la portada no se pulsa: allí sí es una imagen, y sus hijos son
   * decoración. Con `role="img"` y botones dentro se le estaría diciendo a un
   * lector de pantalla que ahí no hay nada que tocar.
   */
  it('sin nada que elegir es una imagen, y no un grupo', () => {
    render(<WheelOfFifths tonic={C} mode="major" />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/Rueda de quintas con C mayor/);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // Y sin tonalidad detectada, se dice que no la hay en vez de callarse.
  it('sin tonalidad lo dice', () => {
    render(<WheelOfFifths tonic={null} mode={null} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/Todavía no hay tonalidad detectada/);
  });

  // Y con una menor puesta, el nombre lo dice: girar no se oye.
  it('con una menor puesta, lo dice en el nombre', () => {
    render(<WheelOfFifths tonic={pitchClassFromName('A')} mode="minor" />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/con A menor/);
  });
});

describe('recorrerla con las flechas', () => {
  /** Las veinticuatro casillas, mayores primero y menores después. */
  function casillas(): HTMLElement[] {
    return screen.getAllByRole('button');
  }

  it('la derecha y la izquierda giran, y dan la vuelta dentro de su anillo', async () => {
    elegible();
    const todas = casillas();
    todas[0]!.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(todas[1]).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    // Desde la primera hacia atrás se da la vuelta: la última de las doce
    // mayores, no la primera de las menores.
    expect(todas[11]).toHaveFocus();
  });

  /**
   * Y arriba y abajo cambian de anillo **sin moverse de sitio**: una menor y su
   * relativa mayor comparten armadura, y por eso comparten posición.
   */
  it('arriba y abajo cambian de anillo y se quedan en el sitio', async () => {
    elegible();
    const todas = casillas();
    todas[3]!.focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(todas[15]).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(todas[3]).toHaveFocus();
  });

  it('cualquier otra tecla no mueve el foco', async () => {
    elegible();
    const todas = casillas();
    todas[0]!.focus();

    await userEvent.keyboard('a');

    expect(todas[0]).toHaveFocus();
  });

  // Y con el foco fuera de la rueda no hay de dónde salir.
  it('con el foco fuera, no hace nada', () => {
    elegible();

    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });

    expect(document.body).toHaveFocus();
  });
});

describe('elegir una tonalidad', () => {
  it('pulsar una mayor y una menor dice cual y de que modo', async () => {
    const onPick = elegible();
    const todas = screen.getAllByRole('button');

    await userEvent.click(todas[0]!);
    await userEvent.click(todas[12]!);

    expect(onPick).toHaveBeenNthCalledWith(1, C, 'major');
    expect(onPick).toHaveBeenNthCalledWith(2, pitchClassFromName('A'), 'minor');
  });

  /**
   * **El nombre empieza por lo que se ve** (WCAG 2.5.3). La menor dice «Am» y se
   * llamaba «A menor»: quien la pide por voz leyendo lo que ve no la encontraba.
   */
  it('cada casilla se llama empezando por lo que dice', () => {
    elegible();

    expect(screen.getByRole('button', { name: 'Am, A menor' })).toHaveTextContent(/^Am/);
    expect(screen.getByRole('button', { name: 'F#m, F# menor' })).toBeInTheDocument();
    // Las mayores ya empezaban igual, y no se les repite la letra.
    expect(screen.getByRole('button', { name: 'C mayor' })).toBeInTheDocument();
    // El título sigue siendo el nombre a secas: es lo que sale al pasar el ratón.
    expect(screen.getByTitle('A menor')).toBe(screen.getByRole('button', { name: 'Am, A menor' }));
  });
});

/**
 * El movimiento, que ya no hace GSAP sino una transición CSS
 * ([adr/0057](../../../docs/adr/0057-la-rueda-gira-sin-gsap.md)). Lo que se defiende
 * es lo que se ve quieto: dónde acaba la rueda y de qué tamaño queda la letra.
 */
describe('el giro y la letra', () => {
  /** El grupo que gira: el primero que lleva un `rotate` sin contragiro. */
  function anillo(contenedor: HTMLElement): SVGGElement {
    return contenedor.querySelector<SVGGElement>('g[style*="rotate"]:not([data-contragiro])')!;
  }

  it('gira por el camino corto, y acumula en vez de volver a cero', () => {
    const F = pitchClassFromName('F');
    const { container, rerender } = render(<WheelOfFifths tonic={F} mode="major" />);
    // Fa está una posición a la izquierda de Do: la rueda gira treinta grados.
    expect(anillo(container).style.transform).toBe('rotate(30deg)');

    rerender(<WheelOfFifths tonic={C} mode="major" />);
    expect(anillo(container).style.transform).toBe('rotate(0deg)');

    // De Do a Fa otra vez, treinta y no trescientos treinta.
    rerender(<WheelOfFifths tonic={F} mode="major" />);
    expect(anillo(container).style.transform).toBe('rotate(30deg)');
  });

  it('sin tonalidad se queda donde estaba', () => {
    const G = pitchClassFromName('G');
    const { container, rerender } = render(<WheelOfFifths tonic={G} mode="major" />);
    const antes = anillo(container).style.transform;

    rerender(<WheelOfFifths tonic={null} mode={null} />);

    expect(anillo(container).style.transform).toBe(antes);
  });

  it('las letras deshacen el giro, cada una sobre su centro', () => {
    const { container } = render(<WheelOfFifths tonic={pitchClassFromName('G')} mode="major" />);
    const etiqueta = container.querySelector<SVGGElement>('[data-contragiro]')!;

    expect(etiqueta.style.transform).toBe('rotate(30deg)');
    expect(etiqueta.style.transformOrigin).toBe('130px 18px');
  });

  /**
   * El anillo pequeño es el grande encogido: con la misma letra salía a diez
   * píxeles. Se le da más cuerpo, y se turna con el modo.
   */
  it('el anillo de dentro lleva letra mas grande, y cambia con el modo', () => {
    const { rerender } = render(<WheelOfFifths tonic={C} mode="major" onPick={vi.fn()} />);
    expect(screen.getByTitle('C mayor').style.fontSize).toBe('14px');
    expect(screen.getByTitle('A menor').style.fontSize).toBe('19px');

    rerender(<WheelOfFifths tonic={pitchClassFromName('A')} mode="minor" onPick={vi.fn()} />);
    expect(screen.getByTitle('C mayor').style.fontSize).toBe('19px');
    expect(screen.getByTitle('A menor').style.fontSize).toBe('14px');
  });

  it('en la portada tambien', () => {
    render(<WheelOfFifths tonic={null} mode={null} />);

    expect(screen.getByText('C').style.fontSize).toBe('14px');
    expect(screen.getByText('Am').style.fontSize).toBe('19px');
  });

  // La transición es la que obedece a `prefers-reduced-motion` desde
  // `globals.css`; sin ella la rueda saltaría siempre.
  it('se mueve con una transicion, no a saltos', () => {
    const { container } = render(<WheelOfFifths tonic={C} mode="major" />);

    expect(anillo(container).style.transition).toMatch(/transform 650ms/);
  });

  /**
   * Lo que se pulsa no encoge con el anillo, y lo que se ve sí: la diana del de
   * dentro se agranda lo que la escala le quita, así que en pantalla las
   * veinticuatro miden lo mismo.
   */
  it('la diana de dentro se agranda lo que su anillo encoge, y se turna con el modo', () => {
    const caja = (titulo: string) => screen.getByTitle(titulo).parentElement!;
    const disco = (titulo: string) => screen.getByTitle(titulo).firstElementChild as HTMLElement;
    const escala = INNER_RADIUS / RING_RADIUS;

    const { rerender } = render(<WheelOfFifths tonic={C} mode="major" onPick={vi.fn()} />);
    expect(Number(caja('C mayor').getAttribute('width'))).toBe(DIANA);
    expect(Number(caja('A menor').getAttribute('width'))).toBeCloseTo(DIANA / escala, 5);
    expect(disco('C mayor').style.width).toBe('32px');
    expect(disco('A menor').style.width).toBe('40px');

    rerender(<WheelOfFifths tonic={pitchClassFromName('A')} mode="minor" onPick={vi.fn()} />);
    expect(Number(caja('A menor').getAttribute('width'))).toBe(DIANA);
    expect(Number(caja('C mayor').getAttribute('width'))).toBeCloseTo(DIANA / escala, 5);
  });
});
