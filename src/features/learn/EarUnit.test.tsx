// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, type EarUnit as EarUnitDef } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { EarUnit } from './EarUnit';

const G = pitchClassFromName('G');

const GRADOS: EarUnitDef = {
  id: 'e1-oido',
  title: 'Reconocer el I, el IV y el V',
  kind: 'ear',
  ear: 'degree',
  xp: 25,
};

const CALIDAD: EarUnitDef = { ...GRADOS, id: 'e2-repaso', ear: 'quality' };

beforeEach(() => {
  useSessionStore.getState().actions.reset();
  vi.restoreAllMocks();
});

function conTonalidad() {
  useSessionStore.getState().actions.pinKey({ tonic: G, mode: 'major' });
}

describe('sin tonalidad', () => {
  // Un acorde suelto no tiene grado: lo tiene dentro de una tonalidad.
  it('no se puede preguntar, y se dice por qué', () => {
    render(<EarUnit unit={GRADOS} onDone={() => {}} />);
    expect(screen.getByText(/solo tiene grado dentro de una/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escuchar/ })).not.toBeInTheDocument();
  });
});

describe('una unidad de oído', () => {
  /**
   * Sonar sin que nadie lo pida es meter ruido en una pantalla en la que se
   * acaba de entrar. El primer sonido lo pide quien está delante.
   */
  it('no suena sola al entrar', () => {
    conTonalidad();
    render(<EarUnit unit={CALIDAD} onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Escuchar' })).toBeInTheDocument();
  });

  it('pregunta con los acordes de tu tonalidad', () => {
    conTonalidad();
    render(<EarUnit unit={GRADOS} onDone={() => {}} />);

    // En Sol mayor el V es Re, no Sol.
    expect(screen.getByRole('button', { name: /D \(V\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Primero suena/)).toHaveTextContent('G');
  });

  // Un acorde suelto no tiene grado, así que la tónica suena antes y se dice:
  // no es parte de la pregunta, es el suelo desde el que se mide.
  it('las de calidad no llevan referencia', () => {
    conTonalidad();
    render(<EarUnit unit={CALIDAD} onDone={() => {}} />);
    expect(screen.queryByText(/Primero suena/)).not.toBeInTheDocument();
  });

  /**
   * El botón no se gasta ni antes ni después de contestar. Un entrenamiento
   * auditivo que deja oír una sola vez mide la memoria, no el oído, y volver a
   * oírlo **con la respuesta delante** es donde se aprende.
   */
  it('se puede escuchar las veces que haga falta, también tras contestar', async () => {
    conTonalidad();
    render(<EarUnit unit={CALIDAD} onDone={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));
    expect(screen.getByRole('button', { name: /Escuchar otra vez/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Alegre' }));
    expect(screen.getByRole('button', { name: /Escuchar otra vez/ })).toBeEnabled();
  });

  it('al terminar avisa de si se acertó todo', async () => {
    conTonalidad();
    const done = vi.fn();
    render(<EarUnit unit={CALIDAD} onDone={done} />);

    // Tres preguntas: alegre, triste, menor.
    for (const buena of ['Alegre', 'Triste', 'Menor']) {
      await userEvent.click(screen.getByRole('button', { name: buena }));
      await userEvent.click(screen.getByRole('button', { name: /Siguiente|Terminar/ }));
    }
    expect(done).toHaveBeenCalledWith(true);
  });

  it('fallar no bloquea, y lo dice', async () => {
    conTonalidad();
    const done = vi.fn();
    const miss = vi.fn();
    render(<EarUnit unit={CALIDAD} onDone={done} onMiss={miss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Triste' }));
    expect(miss).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument();
  });
});
