// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';
import { moverTutor, SITIO_POR_DEFECTO } from '@state/tutor-spot';

import { Tutor } from './Tutor';

function pintar(nodo: React.ReactNode) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      {nodo}
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  moverTutor(SITIO_POR_DEFECTO);
});

describe('El muñeco del profesor', () => {
  // Cerrado no dice nada: un ayudante que habla sin motivo se aprende a cerrar
  // sin leerlo, y el día que dice algo útil ya nadie lo mira.
  it('empieza callado y solo se ve el muñeco', () => {
    pintar(<Tutor />);

    expect(screen.getByRole('button', { name: /preguntarle al profesor/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * Lo que se pedía y no había: preguntar sin salirse de la unidad. El formulario
   * del profesor va dentro del globo, no detrás de un enlace a otra pantalla.
   */
  it('al pulsarlo se abre con el formulario de preguntar dentro', async () => {
    pintar(<Tutor topic="Los grados" />);

    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(screen.getByRole('button', { name: /preguntar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pregunta lo que quieras/i)).toBeInTheDocument();
  });

  it('se abre solo cuando hay algo que avisar, y con la frase entera para quien no ve', () => {
    pintar(<Tutor aviso="Esa no era." />);

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Esa no era.')).toBeInTheDocument();
  });

  it('se cierra y avisa de que ya se ha visto', async () => {
    const visto = vi.fn();
    pintar(<Tutor aviso="Esa no era." onAvisoVisto={visto} />);

    await userEvent.click(screen.getByRole('button', { name: /^cerrar$/i }));

    expect(visto).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * El sitio sale del guardado, no de una clase fija: cada pantalla monta su
   * propio muñeco y todos tienen que aparecer donde lo dejaste.
   */
  it('se pinta en el lado y a la altura donde lo dejaste', () => {
    moverTutor({ lado: 'derecha', alto: 35 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('right-3');
    // La fila se invierte para que el globo se abra hacia dentro de la pantalla.
    expect(marco.className).toContain('flex-row-reverse');
    expect(marco.style.top).toBe('35%');
    expect(marco.className).toContain('items-start');
  });

  /**
   * El fallo que tuvo: capturar el puntero al apoyar el dedo redirige todos los
   * eventos al contenedor, y entonces el `click` no llega al botón de dentro. Se
   * movía y no se abría.
   *
   * jsdom no implementa la captura de verdad, así que lo que se vigila es **el
   * momento** en que se pide: al apoyar, nunca; al moverse, sí. Es lo que
   * distingue un toque de un arrastre.
   */
  it('no captura el puntero hasta que te mueves de verdad', () => {
    const capturar = vi.fn();
    const liberar = vi.fn();
    Element.prototype.setPointerCapture = capturar;
    Element.prototype.releasePointerCapture = liberar;
    Element.prototype.hasPointerCapture = () => true;

    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    expect(capturar, 'apoyar el dedo no puede capturar: se come el clic').not.toHaveBeenCalled();

    fireEvent.pointerMove(marco, { clientX: 200, clientY: 400, movementX: 180, pointerId: 1 });
    expect(capturar).toHaveBeenCalledOnce();
  });

  /**
   * El fallo que tuvo: anclado siempre por arriba, al abrirse el globo empujaba
   * al muñeco hacia abajo desde el 78 % y los dos se salían de la pantalla. Se
   * ancla por el borde más cercano, y así el globo crece hacia dentro.
   */
  it('abajo se ancla por abajo, para que el globo suba en vez de empujarlo fuera', () => {
    moverTutor({ lado: 'izquierda', alto: 78 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.bottom).toBe('22%');
    expect(marco.style.top).toBe('');
    expect(marco.className).toContain('items-end');
  });

  it('arriba se ancla por arriba, y entonces el globo baja', () => {
    moverTutor({ lado: 'izquierda', alto: 20 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.top).toBe('20%');
    expect(marco.style.bottom).toBe('');
    expect(marco.className).toContain('items-start');
  });

  it('en el lado de siempre se abre hacia el otro', () => {
    moverTutor(SITIO_POR_DEFECTO);
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('left-3');
    expect(marco.className).not.toContain('flex-row-reverse');
  });
});
