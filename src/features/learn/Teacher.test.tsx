// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { Teacher } from './Teacher';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

/**
 * El profesor: el único sitio de la aplicación por donde entra texto libre.
 *
 * Lo que se prueba aquí es lo que decide esta pieza y no el servidor:
 *
 * - **Sin tonalidad no se pregunta.** El profesor responde con los acordes que
 *   tienes delante; sin ella, la respuesta sería un ejemplo en Do mayor.
 * - **El error se enseña con su código, no solo con su frase.** Un «no entra en
 *   tu plan» tiene una salida a un clic; un modelo caído no lleva a ningún sitio,
 *   y ofrecer planes ahí sería vender por una avería nuestra.
 * - **El cupo se vuelve a pedir aunque la petición falle**, porque se cobra al
 *   intentarla: si no, el contador de arriba mentiría hasta recargar.
 */

const CON_CUENTA: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: 3,
  aiLeftMonth: 20,
};

const fetchFalso = vi.fn();

function respuesta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pintar(account: Account = CON_CUENTA, props = {}) {
  return render(
    <AccountProvider account={account} accounts>
      <Teacher {...props} />
    </AccountProvider>,
  );
}

/** Con tonalidad puesta, que es lo normal al llegar aquí. */
function conTonalidad() {
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
}

beforeEach(() => {
  fetchFalso.mockReset();
  fetchFalso.mockResolvedValue(respuesta(200, { answer: 'Porque tiene la sensible.' }));
  vi.stubGlobal('fetch', fetchFalso);
  conTonalidad();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function preguntar(texto = '¿Por qué el V tira al i?') {
  await userEvent.type(screen.getByPlaceholderText(/Pregunta lo que quieras/), texto);
  await userEvent.click(screen.getByRole('button', { name: 'Preguntar' }));
}

describe('sin tonalidad', () => {
  it('no se puede preguntar, y se dice por qué', () => {
    useSessionStore.getState().actions.reset();

    pintar();

    expect(screen.getByText(/Elige una tonalidad primero/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preguntar' })).toBeDisabled();
  });
});

describe('preguntar', () => {
  it('viaja la tonalidad, la escala y lo escrito, y nada más', () => {
    // A la IA solo viajan símbolos. Ni audio ni vídeo salen del equipo.
    pintar();

    return preguntar().then(() => {
      const enviado = JSON.parse((fetchFalso.mock.calls[0]![1] as { body: string }).body) as Record<
        string,
        unknown
      >;

      expect(Object.keys(enviado).sort()).toEqual(['key', 'question', 'scale']);
      expect(enviado['key']).toEqual({ tonic: 'A', mode: 'minor' });
    });
  });

  it('la unidad viaja por su identificador, no por su titulo', async () => {
    // El título lo resuelve el servidor contra el temario, y así este campo deja
    // de ser texto libre entrando a un prompt.
    pintar(CON_CUENTA, { unitId: 'e1-grados' });

    await preguntar();

    const enviado = JSON.parse((fetchFalso.mock.calls[0]![1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(enviado['unitId']).toBe('e1-grados');
  });

  it('mientras piensa, el boton lo dice y no deja pulsar dos veces', async () => {
    let contestar = (_: Response) => undefined as void;
    fetchFalso.mockReturnValue(
      new Promise<Response>((listo) => {
        contestar = listo;
      }),
    );
    pintar();

    await preguntar();

    expect(screen.getByRole('button', { name: 'Pensando' })).toBeDisabled();
    contestar(respuesta(200, { answer: 'Ya está.' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preguntar' })).toBeDefined());
  });

  it('la respuesta se enseña, con su ejemplo si lo trae', async () => {
    fetchFalso.mockResolvedValue(
      respuesta(200, {
        answer: 'Porque tiene la sensible.',
        example: { chords: ['E', 'Am'], degrees: ['V', 'i'] },
      }),
    );
    pintar();

    await preguntar();

    expect(await screen.findByText(/Porque tiene la sensible/)).toBeInTheDocument();
    expect(screen.getByText(/E → Am/)).toBeInTheDocument();
    expect(screen.getByText(/\(V i\)/)).toBeInTheDocument();
  });

  it('una pregunta en blanco no sale', async () => {
    pintar();

    await userEvent.type(screen.getByPlaceholderText(/Pregunta lo que quieras/), '   ');

    expect(screen.getByRole('button', { name: 'Preguntar' })).toBeDisabled();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe('cuando no sale', () => {
  it('un «no entra en tu plan» lleva a la pantalla de planes', async () => {
    // La salida está a un clic y en la pantalla donde se ve qué trae cada uno.
    fetchFalso.mockResolvedValue(
      respuesta(402, { error: { code: 'plan_required', message: 'Hace falta un plan.' } }),
    );
    pintar();

    await preguntar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Hace falta un plan.');
    expect(screen.getByRole('link', { name: /planes/i })).toBeInTheDocument();
  });

  it('un modelo caido no ofrece planes: seria vender por una averia nuestra', async () => {
    fetchFalso.mockResolvedValue(
      respuesta(502, { error: { code: 'model_unavailable', message: 'No contesta.' } }),
    );
    pintar();

    await preguntar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No contesta.');
    expect(screen.queryByRole('link', { name: /planes/i })).not.toBeInTheDocument();
  });

  it('sin red tampoco se queda callado', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));
    pintar();

    await preguntar();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('un error sin frase usa la de respaldo', async () => {
    fetchFalso.mockResolvedValue(respuesta(500, {}));
    pintar();

    await preguntar();

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
  });
});

describe('el cupo', () => {
  it('se enseña como un numero, para mirarlo de reojo', () => {
    pintar();

    expect(screen.getByText(/Quedan 3 hoy/)).toBeInTheDocument();
    expect(screen.getByText(/20 este mes/)).toBeInTheDocument();
  });

  it('agotado se dice, y en otro color', () => {
    pintar({ ...CON_CUENTA, aiLeftToday: 0 });

    expect(screen.getByText(/Sin peticiones a la IA hoy/)).toBeInTheDocument();
  });

  it('sin cuenta no se promete ningun numero, y se dice por que', () => {
    // Sin cuenta el servidor cuenta por dirección, así que no hay número que
    // prometer.
    pintar(ANONYMOUS);

    expect(screen.queryByText(/Quedan/)).not.toBeInTheDocument();
    expect(screen.getByText(/El profesor pide cuenta/)).toBeInTheDocument();
  });
});

describe('las preguntas de arranque', () => {
  it('estan para quien no sabe ni como se llama lo que no sabe', () => {
    pintar();

    expect(screen.getByRole('button', { name: /el V tira tanto hacia el I/ })).toBeInTheDocument();
  });

  it('al pulsar una, se pregunta esa', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /el V tira tanto hacia el I/ }));

    const enviado = JSON.parse((fetchFalso.mock.calls[0]![1] as { body: string }).body) as {
      question: string;
    };
    expect(enviado.question).toMatch(/el V tira tanto hacia el I/);
  });

  it('dentro del globo del muñeco no salen: ahi ocupan mas que el formulario', () => {
    // Quien abre el muñeco ya sabe lo que quiere preguntar, que acaba de leer la
    // lección.
    pintar(CON_CUENTA, { compact: true });

    expect(screen.queryByRole('button', { name: /el V tira tanto/ })).not.toBeInTheDocument();
  });

  it('y desaparecen en cuanto hay respuesta', async () => {
    pintar();

    await preguntar();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /el V tira tanto/ })).not.toBeInTheDocument(),
    );
  });
});
