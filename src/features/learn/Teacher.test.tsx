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
  /**
   * No hay campo ni error en rojo: lo que falta se resuelve con un toque, y el
   * toque se ofrece ahí mismo, en línea.
   */
  it('en vez del campo, las cuatro tonalidades de salida', () => {
    useSessionStore.getState().actions.reset();

    pintar();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tonalidades para empezar' })).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('elegir una trae el campo para preguntar', async () => {
    useSessionStore.getState().actions.reset();
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /^C mayor/ }));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('sin cuenta', () => {
  /**
   * Campo y botón activos acababan en un 401. En su lugar, la entrada.
   */
  it('en vez del campo, un botón para entrar que lleva a la cuenta', () => {
    pintar(ANONYMOUS);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preguntar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar para preguntar' })).toHaveAttribute(
      'href',
      '/cuenta',
    );
  });

  // En latón competía con «Siguiente» en el globo del muñeco: dos acciones
  // principales a la vez. Entrar es la secundaria.
  it('y ese botón es el secundario, no el de latón', () => {
    pintar(ANONYMOUS);

    const entrar = screen.getByRole('link', { name: 'Entrar para preguntar' });
    expect(entrar).toHaveClass('border-border');
    expect(entrar.className).not.toMatch(/bg-brass/);
  });

  // Mandaba a /cuenta, donde lo único que se leía era que aquí no hay cuentas:
  // un callejón con dos puertas. Se dice aquí mismo y no se manda a ninguna parte.
  it('sin cuentas configuradas lo dice, y no manda a entrar', () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <Teacher />
      </AccountProvider>,
    );

    expect(screen.getByText(/no tiene cuentas configuradas/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar para preguntar' })).not.toBeInTheDocument();
  });

  it('las preguntas de ejemplo se ven pero no se pulsan', () => {
    pintar(ANONYMOUS);

    expect(screen.getByText(/el V tira tanto hacia el I/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /el V tira tanto/ })).not.toBeInTheDocument();
  });

  it('dentro del globo no salen ni de vista previa', () => {
    pintar(ANONYMOUS, { compact: true });

    expect(screen.queryByText(/el V tira tanto/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar para preguntar' })).toBeInTheDocument();
  });

  it('sin cuenta y sin tonalidad, primero lo de entrar', () => {
    useSessionStore.getState().actions.reset();

    pintar(ANONYMOUS);

    expect(screen.getByRole('link', { name: 'Entrar para preguntar' })).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Tonalidades para empezar' }),
    ).not.toBeInTheDocument();
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
    // La respuesta se deja a medias a propósito, para mirar el botón mientras.
    let contestar: (respuesta: Response) => void = () => undefined;
    fetchFalso.mockReturnValue(
      new Promise<Response>((listo) => {
        contestar = listo;
      }),
    );
    pintar();

    await preguntar();

    const pensando = screen.getByRole('button', { name: 'Pensando…' });
    expect(pensando).toBeDisabled();
    // Y lo dice también a quien no lee el rótulo: la ruedecilla es adorno, y por
    // eso lo que lleva la información es `aria-busy`.
    expect(pensando).toHaveAttribute('aria-busy', 'true');
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

  it('lo que escribe el modelo no lleva marca', async () => {
    pintar();

    await preguntar();

    expect(await screen.findByText(/Porque tiene la sensible/)).toBeInTheDocument();
    expect(screen.queryByText(/sin IA|Sin IA|Sin conexión/)).not.toBeInTheDocument();
  });

  /**
   * Lo que no es del modelo se marca de un vistazo, y **la marca depende del
   * motivo**: con el modelo caído no hay nada que reescribir en la pregunta.
   */
  it.each([
    [{ fuente: 'glosario', motivo: 'unparseable_response' }, 'Del glosario, sin IA'],
    [{ fuente: 'aviso', motivo: 'unparseable_response' }, 'Sin IA'],
    [{ fuente: 'glosario', motivo: 'model_unavailable' }, 'Sin conexión con el modelo'],
  ])('lo que no es del modelo se marca: %o', async (origen, marca) => {
    fetchFalso.mockResolvedValue(respuesta(200, { answer: 'Lo del glosario.', ...origen }));
    pintar();

    await preguntar();

    expect(await screen.findByText('Lo del glosario.')).toBeInTheDocument();
    expect(screen.getByText(marca)).toBeInTheDocument();
  });

  it('una pregunta en blanco no sale', async () => {
    pintar();

    await userEvent.type(screen.getByPlaceholderText(/Pregunta lo que quieras/), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Preguntar' }));

    expect(fetchFalso).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Escribe lo que quieres preguntar.',
    );
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

    expect(screen.getByText(/Sin preguntas a la IA hoy/)).toBeInTheDocument();
  });

  /**
   * Y si la sesión caduca con la pantalla abierta, la ruta contesta 401 aunque
   * se tuviera cuenta: ahí sí hay un error que enseñar, con su salida.
   */
  it('una sesión caducada enseña el error con su enlace para entrar', async () => {
    fetchFalso.mockResolvedValue(
      respuesta(401, { error: { code: 'account_required', message: 'Entra con tu cuenta.' } }),
    );
    pintar();

    await preguntar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Entra con tu cuenta.');
    expect(screen.getByRole('link', { name: /Entrar con tu cuenta/ })).toHaveAttribute(
      'href',
      '/cuenta',
    );
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
