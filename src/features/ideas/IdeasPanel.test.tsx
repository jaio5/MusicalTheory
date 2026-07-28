// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { ideasError, type IdeasRequest } from './contract';
import { IdeasPanel } from './IdeasPanel';

const A = pitchClassFromName('A');

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Panel de ideas', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  afterEach(cleanup);

  it('avisa de que a la IA solo van símbolos', () => {
    render(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />);
    expect(screen.getByText(/ni el audio ni el vídeo salen de tu equipo/i)).toBeInTheDocument();
  });

  it('no deja pedir nada sin tonalidad', () => {
    render(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />);
    expect(screen.getByText(/toca unos compases o elige una tonalidad/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /progresiones/i })).not.toBeInTheDocument();
  });

  it('manda la tonalidad y las notas, y nada más', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setScale('minorPentatonic');

    let sent: IdeasRequest | null = null;
    render(
      <IdeasPanel
        fetchIdeas={async (request) => {
          sent = request;
          return respondWith({ ideas: [] });
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(sent).toMatchObject({
      kind: 'progression',
      key: { tonic: 'A', mode: 'minor' },
      scale: 'minorPentatonic',
    });
    expect(JSON.stringify(sent)).not.toContain('audio');
  });

  it('enseña las ideas que vuelven', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      <IdeasPanel
        fetchIdeas={async () =>
          respondWith({
            ideas: [
              {
                title: 'Bajar por tonos',
                why: 'Mantiene el centro y evita la sensible.',
                degrees: ['i', 'VII', 'VI'],
                chords: ['Am', 'G', 'F'],
              },
            ],
          })
        }
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByText('Bajar por tonos')).toBeInTheDocument();
    expect(screen.getByText('Am · G · F')).toBeInTheDocument();
    expect(screen.getByText(/evita la sensible/i)).toBeInTheDocument();
  });

  it('explica en español lo que ha fallado', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      <IdeasPanel
        fetchIdeas={async () => respondWith(ideasError('unparseable_response'), 502)}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no ha venido bien formada/i);
  });

  it('sobrevive a que se caiga la red', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      <IdeasPanel
        fetchIdeas={async () => {
          throw new Error('sin red');
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/vuelve a intentarlo/i);
  });

  it('enseña la escala propuesta con su nombre', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      <IdeasPanel
        fetchIdeas={async () =>
          respondWith({
            ideas: [{ title: 'Prueba el dórico', why: 'Sube la sexta.', scale: 'dorian' }],
          })
        }
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /qué escala meter encima/i }));

    expect(await screen.findByText('Dórico de La')).toBeInTheDocument();
  });
});
