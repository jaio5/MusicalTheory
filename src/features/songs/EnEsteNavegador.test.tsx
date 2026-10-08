// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  escribirCopia,
  pitchClassFromName,
  translateToMode,
  writtenBlock,
  type Arrangement,
} from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

const descargarBytes = vi.fn();
vi.mock('@media/descargar', () => ({
  TIPO_MIDI: 'audio/midi',
  descargarBytes: (...args: unknown[]) => descargarBytes(...args),
}));

const { EnEsteNavegador } = await import('./EnEsteNavegador');

/**
 * Lo primero de Canciones: que la tuya ya está guardada en este navegador, y
 * cómo llevártela. Se decía «guardar entra en el plan Básico» y la canción se
 * guardaba igual, sin que nada lo dijera (adr/0118).
 */

const G = pitchClassFromName('G');

const CANCION: Arrangement = {
  parts: [
    {
      id: 'p1',
      name: 'Estribillo',
      blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'V', 4)],
      notes: [],
      bars: 2,
    },
  ],
};

beforeEach(() => {
  descargarBytes.mockClear();
  useSessionStore.getState().actions.reset();
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
});

/** Elige un fichero en el campo escondido, como lo haría el navegador. */
function elegir(contenido: string): void {
  const campo = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(campo, { target: { files: [new File([contenido], 'cancion.caos.json')] } });
}

describe('lo que se dice', () => {
  it('primero, que se guarda sola y sin pagar', () => {
    render(<EnEsteNavegador />);

    expect(
      screen.getByRole('heading', { name: 'Tu canción se guarda sola en este navegador' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sin cuenta y sin pagar nada/)).toBeInTheDocument();
  });
});

describe('descargar', () => {
  it('sin canción no descarga, y dice qué falta', async () => {
    render(<EnEsteNavegador />);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar MIDI' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar una copia' }));

    expect(descargarBytes).not.toHaveBeenCalled();
    expect(screen.getByText(/Todavía no hay nada que descargar/)).toBeInTheDocument();
  });

  it('el MIDI, con el nombre de la primera parte', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: G, mode: 'major' });
    useArrangementStore.setState({ arrangement: CANCION });
    render(<EnEsteNavegador />);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar MIDI' }));

    expect(descargarBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'estribillo.mid',
      'audio/midi',
    );
  });

  it('la copia lleva la canción entera, y se vuelve a abrir igual', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: G, mode: 'major' });
    useSessionStore.getState().actions.setTempo(90, 3);
    useArrangementStore.setState({ arrangement: CANCION });
    render(<EnEsteNavegador />);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar una copia' }));

    const [bytes, nombre, tipo] = descargarBytes.mock.calls[0]!;
    expect(nombre).toBe('estribillo.caos.json');
    expect(tipo).toBe('application/json');
    expect(JSON.parse(new TextDecoder().decode(bytes as Uint8Array))).toMatchObject({
      tonic: G,
      mode: 'major',
      bpm: 90,
      beatsPerBar: 3,
      arrangement: CANCION,
    });
  });
});

describe('abrir una copia', () => {
  it('el botón abre el selector de ficheros', async () => {
    render(<EnEsteNavegador />);
    const campo = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const abrir = vi.spyOn(campo, 'click');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir una copia' }));

    expect(abrir).toHaveBeenCalled();
  });

  it('pone la tonalidad, el tempo y la canción, con deshacer detrás', async () => {
    const antes: Arrangement = {
      parts: [{ id: 'x', name: 'Mía', blocks: [writtenBlock('c', 'IV', 4)], notes: [], bars: 1 }],
    };
    useArrangementStore.setState({ arrangement: antes, past: [] });
    render(<EnEsteNavegador />);

    elegir(
      escribirCopia({ tonic: G, mode: 'major', bpm: 80, beatsPerBar: 3, arrangement: CANCION }),
    );

    await waitFor(() => expect(useArrangementStore.getState().arrangement).toEqual(CANCION));
    const sesion = useSessionStore.getState();
    expect(sesion.pinnedKey).toEqual({ tonic: G, mode: 'major' });
    expect([sesion.bpm, sesion.beatsPerBar]).toEqual([80, 3]);
    // El paso de deshacer es la canción de antes, con los ajustes que devuelve.
    expect(useArrangementStore.getState().past[0]).toMatchObject(antes);
    expect(screen.getByText(/Abierta en G mayor/)).toBeInTheDocument();
  });

  // Poner la tonalidad menor de la copia traducía antes la canción de antes, y
  // la dominante del ii —que en menor no existe— se perdía en lo apilado.
  it('deshacer una copia de otro modo devuelve la canción de antes entera', async () => {
    const antes: Arrangement = {
      parts: [
        {
          id: 'x',
          name: 'Mía',
          blocks: [writtenBlock('c', 'IV', 4), writtenBlock('d', 'V/ii', 4)],
          notes: [],
          bars: 2,
        },
      ],
    };
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
    useSessionStore.getState().actions.setTempo(120, 4);
    useArrangementStore.setState({ arrangement: antes, past: [] });
    render(<EnEsteNavegador />);

    const enMenor = translateToMode(CANCION, 'minor');
    elegir(
      escribirCopia({ tonic: 9, mode: 'minor', bpm: 80, beatsPerBar: 3, arrangement: enMenor }),
    );
    await waitFor(() => expect(useArrangementStore.getState().arrangement).toEqual(enMenor));
    expect(screen.getByText(/con su tonalidad y su tempo/)).toBeInTheDocument();

    useArrangementStore.getState().actions.undo();

    const sesion = useSessionStore.getState();
    expect(useArrangementStore.getState().arrangement).toEqual(antes);
    expect(sesion.pinnedKey).toEqual({ tonic: 0, mode: 'major' });
    expect([sesion.bpm, sesion.beatsPerBar]).toEqual([120, 4]);
    expect(useArrangementStore.getState().quitadosAlCambiarDeModo).toBeNull();
  });

  it('un fichero que no es una copia no toca nada, y lo dice', async () => {
    render(<EnEsteNavegador />);

    elegir('{"hola": 1}');

    expect(await screen.findByText(/no es una copia de una canción de aquí/)).toBeInTheDocument();
    expect(useArrangementStore.getState().arrangement).toEqual(EMPTY_ARRANGEMENT);
  });

  it('cancelar el selector no hace nada', () => {
    render(<EnEsteNavegador />);
    const campo = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(campo, { target: { files: [] } });

    expect(useArrangementStore.getState().past).toEqual([]);
  });
});
