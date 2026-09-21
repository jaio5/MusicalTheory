// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';

import { WheelOfFifths } from './WheelOfFifths';

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
});
