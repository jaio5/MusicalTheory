// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@core/music';

import { Question } from './Question';

const PRIMERA: Exercise = {
  prompt: '¿Cuál es el V grado de C mayor?',
  choices: [
    { text: 'F', correct: false },
    { text: 'G', correct: true },
    { text: 'Am', correct: false },
  ],
  why: 'Cinco notas por encima de C está G.',
};

const SEGUNDA: Exercise = {
  prompt: '¿Y el IV?',
  choices: [
    { text: 'Dm', correct: false },
    { text: 'F', correct: true },
  ],
  why: 'Cuatro notas por encima de C está F.',
};

/** Las dos preguntas seguidas, como las pasa una unidad. */
function Unidad({ alResponder = () => {} }: { readonly alResponder?: (bien: boolean) => void }) {
  const [at, setAt] = useState(0);
  const preguntas = [PRIMERA, SEGUNDA];
  return (
    <Question
      exercise={preguntas[at]!}
      position={at + 1}
      total={preguntas.length}
      lastLabel="Terminar la unidad"
      onAnswered={alResponder}
      onNext={() => setAt((actual) => Math.min(actual + 1, preguntas.length - 1))}
    />
  );
}

describe('el foco al contestar', () => {
  /**
   * Las opciones se desactivan al corregir, y un botón desactivado suelta el
   * foco: se iba al `body`, y quien contestaba con el teclado tenía que recorrer
   * la pantalla entera para llegar a «Siguiente».
   */
  it('contestando con el teclado, el foco va a «Siguiente»', async () => {
    const alResponder = vi.fn();
    render(<Unidad alResponder={alResponder} />);

    screen.getByRole('button', { name: 'G' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(alResponder).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
  });

  it('y al pasar de pregunta, a la primera opción de la nueva', async () => {
    render(<Unidad />);

    screen.getByRole('button', { name: 'G' }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('¿Y el IV?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dm' })).toHaveFocus();
  });

  /**
   * Cambiar de pregunta sin haber contestado —otra tonalidad, otra lección— no
   * es venir de «Siguiente», y el foco no se mueve de donde esté.
   */
  it('si la pregunta cambia sin haberla contestado, el foco no se toca', () => {
    const { rerender } = render(
      <>
        <button type="button">Fuera</button>
        <Question
          exercise={PRIMERA}
          position={1}
          total={2}
          lastLabel="Terminar"
          onAnswered={() => {}}
          onNext={() => {}}
        />
      </>,
    );
    const fuera = screen.getByRole('button', { name: 'Fuera' });
    fuera.focus();

    rerender(
      <>
        <button type="button">Fuera</button>
        <Question
          exercise={SEGUNDA}
          position={1}
          total={2}
          lastLabel="Terminar"
          onAnswered={() => {}}
          onNext={() => {}}
        />
      </>,
    );

    expect(fuera).toHaveFocus();
  });
});

describe('la corrección se anuncia', () => {
  /**
   * La región viva nacía con el texto dentro, y una región que aparece ya llena
   * no la anuncia ningún lector de pantalla de forma fiable. Tiene que estar
   * antes, vacía, y rellenarse al contestar: la misma, no otra.
   */
  it('la región viva está montada y vacía antes de contestar', () => {
    const { container } = render(<Unidad />);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
  });

  it('al fallar, la misma región dice cuál era y por qué', async () => {
    const { container } = render(<Unidad />);
    const region = container.querySelector('[aria-live="polite"]');

    await userEvent.click(screen.getByRole('button', { name: 'F' }));

    expect(container.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region).toHaveTextContent('Era G. Cinco notas por encima de C está G.');
  });

  // La marca verde no se oye: sin decirlo, acertar sonaba como un párrafo más.
  it('al acertar, dice que está bien', async () => {
    const { container } = render(<Unidad />);

    await userEvent.click(screen.getByRole('button', { name: 'G' }));

    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Bien. Cinco notas por encima de C está G.',
    );
  });

  it('«Siguiente» va fuera de la región, para no leerse como parte del porqué', async () => {
    const { container } = render(<Unidad />);

    await userEvent.click(screen.getByRole('button', { name: 'G' }));

    expect(container.querySelector('[aria-live="polite"]')).not.toContainElement(
      screen.getByRole('button', { name: 'Siguiente' }),
    );
  });

  it('en la última, el botón dice cómo se termina', async () => {
    render(<Unidad />);

    await userEvent.click(screen.getByRole('button', { name: 'G' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'F' }));

    expect(screen.getByRole('button', { name: 'Terminar la unidad' })).toHaveFocus();
  });
});
