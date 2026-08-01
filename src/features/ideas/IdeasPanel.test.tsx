// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Account } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { ideasError, type IdeasRequest } from './contract';
import { IdeasPanel } from './IdeasPanel';

const A = pitchClassFromName('A');

/**
 * Las ideas van con plan, así que casi todos estos tests se pintan dentro de una
 * cuenta que las incluye. El caso de quien no las tiene se prueba aparte, abajo.
 */
const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

function conCuenta(node: React.ReactNode, account: Account = CON_PLAN) {
  return (
    <AccountProvider account={account} accounts>
      {node}
    </AccountProvider>
  );
}

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Panel de ideas', () => {
  it('avisa de que a la IA solo van símbolos', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />));
    expect(screen.getByText(/ni el audio ni el vídeo salen de tu equipo/i)).toBeInTheDocument();
  });

  it('no deja pedir nada sin tonalidad', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />));
    expect(screen.getByText(/toca unos compases o elige una tonalidad/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /progresiones/i })).not.toBeInTheDocument();
  });

  it('manda la tonalidad y las notas, y nada más', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setScale('minorPentatonic');

    let sent: IdeasRequest | null = null;
    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async (request) => {
            sent = request;
            return respondWith({ ideas: [] });
          }}
        />,
      ),
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
      conCuenta(
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
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByText('Bajar por tonos')).toBeInTheDocument();
    expect(screen.getByText('Am · G · F')).toBeInTheDocument();
    expect(screen.getByText(/evita la sensible/i)).toBeInTheDocument();
  });

  it('explica en español lo que ha fallado', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => respondWith(ideasError('unparseable_response'), 502)}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no ha venido bien formada/i);
  });

  it('sobrevive a que se caiga la red', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => {
            throw new Error('sin red');
          }}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/vuelve a intentarlo/i);
  });

  it('enseña la escala propuesta con su nombre', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith({
              ideas: [{ title: 'Prueba el dórico', why: 'Sube la sexta.', scale: 'dorian' }],
            })
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /qué escala meter encima/i }));

    expect(await screen.findByText('Dórico de A')).toBeInTheDocument();
  });

  /**
   * El mensaje del servidor gana al genérico: los rechazos por plan y por cupo
   * llevan el plan y el número concretos, y la frase de aquí no sabe eso.
   */
  it('enseña el motivo que manda el servidor, no uno genérico', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith(
              ideasError('quota_exhausted', 'Se te han acabado las 40 peticiones a la IA de hoy.'),
              429,
            )
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/las 40 peticiones/i);
  });

  /**
   * El rechazo que llega en marcha tiene la misma salida que el candado que se
   * enseña de antemano. Un plan puede caducar entre que se pinta la pantalla y se
   * pulsa el botón, y entonces el único aviso es este.
   */
  it('si lo que falta es plan, deja ir a verlos', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith(
              ideasError(
                'plan_required',
                'Las ideas de la IA entran en el plan Medio: 9,99 € al mes.',
              ),
              402,
            )
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/entran en el plan medio/i);
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  // Un enlace a los planes debajo de «el modelo no contesta» mandaría a pagar por
  // algo que no se arregla pagando.
  it('no manda a los planes cuando el fallo no es de plan', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel fetchIdeas={async () => respondWith(ideasError('model_unavailable'), 503)} />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: /ver los tres planes/i })).not.toBeInTheDocument();
  });
});

describe('Sin plan que incluya las ideas', () => {
  const SIN_PLAN: Account = {
    email: 'javier@example.com',
    name: null,
    plan: 'gratis',
    aiModel: 'claude-opus-5',
    aiLeftToday: 3,
    aiLeftMonth: 3,
  };

  it('no enseña los botones: enseña qué plan las trae', () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />, SIN_PLAN));

    expect(screen.queryByRole('button', { name: /progresiones/i })).not.toBeInTheDocument();
    // El plan más barato que las incluye, y con su precio: un candado que no dice
    // cómo se abre es una pared. En plural, que es lo que son las ideas: esto
    // decía «Las ideas de la IA entra en el plan Medio» hasta que se leyó.
    expect(
      screen.getByText('Las ideas de la IA entran en el plan Medio: 9,99 € al mes.'),
    ).toBeInTheDocument();
    // Y se puede ir a verlos: el candado lleva a las tres tarjetas, no a la cuenta.
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  // El resto de la pantalla de componer no cuesta nada de servir, y decirlo evita
  // que parezca que la pantalla entera está de pago.
  it('dice que lo demás de la pantalla sigue siendo gratis', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />, SIN_PLAN));

    expect(screen.getByText(/es gratis/i)).toBeInTheDocument();
  });
});
