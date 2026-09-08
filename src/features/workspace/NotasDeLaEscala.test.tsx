// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { NotasDeLaEscala } from './NotasDeLaEscala';

/**
 * Las notas de la escala que hay puesta.
 *
 * Es el dato que la aplicación tenía y no enseñaba donde se mira: para saber qué
 * notas caben había que abrir el mástil, que responde a otra pregunta —dónde
 * están, no cuáles son—.
 */
beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('las notas de la escala', () => {
  it('sin tonalidad no ocupa sitio: no hay nada que enseñar', () => {
    const { container } = render(<NotasDeLaEscala />);

    expect(container).toBeEmptyDOMElement();
  });

  it('con tonalidad, las siete de la mayor y en orden', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    actions.setScale('major');

    render(<NotasDeLaEscala />);

    const notas = screen.getByRole('list', { name: /escala mayor/i });
    expect([...notas.children].map((li) => li.textContent)).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
    ]);
  });

  /**
   * La alteración no se elige a ojo: la pentatónica menor de Do sale de Mi bemol,
   * así que se escribe con bemoles. Es lo que decide `accidentalForScale`, y por
   * eso aquí se pide `scaleNoteNames` en vez de nombrar las notas a mano.
   */
  it('escribe cada nota con la alteración que le toca a esa escala', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'minor' });
    actions.setScale('minorPentatonic');

    render(<NotasDeLaEscala />);

    const textos = [...screen.getByRole('list').children].map((li) => li.textContent);
    expect(textos).toContain('Eb');
    expect(textos).not.toContain('D#');
  });

  it('cambiar de escala cambia las notas: elegir tiene una respuesta visible', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    actions.setScale('major');

    const { rerender } = render(<NotasDeLaEscala />);
    expect(screen.getByRole('list').children).toHaveLength(7);

    actions.setScale('minorPentatonic');
    rerender(<NotasDeLaEscala />);

    expect(screen.getByRole('list').children).toHaveLength(5);
  });
});
