// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { Settings } from './Settings';

/**
 * Los dos ajustes del taller: el estilo y la escala.
 *
 * Viven en el estado de sesión y no dentro de esta pieza porque **los tocan
 * varias pantallas** —la escala la usa el mástil y también las unidades de
 * tocar— y porque así no se pierden al cambiar de pantalla. Lo que se prueba
 * aquí es eso: que elegir aquí cambia el estado que lee todo lo demás.
 *
 * Los dos son `ui/Field`, que es lo que les da los 44 px de alto: con la
 * guitarra en las manos, un desplegable de veinte no se acierta.
 */

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('los ajustes del taller', () => {
  it('elegir un estilo lo deja puesto para todo lo demás', async () => {
    render(<Settings />);

    const estilo = screen.getByLabelText(/estilo/i);
    await userEvent.selectOptions(estilo, 'jazz');

    expect(useSessionStore.getState().styleId).toBe('jazz');
  });

  it('elegir una escala, igual', async () => {
    render(<Settings />);

    await userEvent.selectOptions(screen.getByLabelText(/escala/i), 'dorian');

    expect(useSessionStore.getState().scaleId).toBe('dorian');
  });

  it('lo que hay puesto se ve sin abrir nada', () => {
    // Es media pantalla de contexto: sin él, una sugerencia rara parece un
    // error en vez de ser el estilo que hay elegido.
    useSessionStore.getState().actions.setStyle('jazz');

    render(<Settings />);

    expect(screen.getByLabelText(/estilo/i)).toHaveValue('jazz');
  });

  it('la afinación no está aquí: vive con el mástil, que es quien la dibuja', () => {
    // Dos sitios donde cambiarla serían dos sitios donde mirar cuál hay puesta.
    render(<Settings />);

    expect(screen.queryByLabelText(/afinaci/i)).not.toBeInTheDocument();
  });
});
