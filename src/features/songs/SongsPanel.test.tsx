// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { DEFAULT_BPM, MAX_SECTIONS, pitchClassFromName, type Song } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { SongsPanel } from './SongsPanel';

const C = pitchClassFromName('C');

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'basico',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

const SIN_PLAN: Account = { ...CON_PLAN, plan: 'gratis' };

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

const UNA: Song = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'La mía',
  tonic: C,
  mode: 'major',
  bpm: 100,
  sections: [{ name: 'Parte 1', degrees: ['I', 'V', 'vi', 'IV'] }],
  updatedAt: 1000,
};

/** Pone una tonalidad y un camino de acordes, como si se hubiera compuesto. */
function componiendo(labels: readonly string[]) {
  const { actions } = useSessionStore.getState();
  actions.pinKey({ tonic: C, mode: 'major' });
  actions.clearPath();
  for (const label of labels) {
    actions.pushChord({ symbol: label, label, root: C, notes: [C], why: 'porque sí' });
  }
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('sin el plan que lo incluye', () => {
  it('enseña el candado y no pregunta al servidor', () => {
    const request = vi.fn();
    render(conCuenta(<SongsPanel request={request} />, SIN_PLAN));

    expect(screen.getByRole('note')).toHaveTextContent(/plan Básico/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('la lista', () => {
  it('pinta lo que hay guardado con su tonalidad', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText('La mía')).toBeInTheDocument();
    // Cifrado anglosajón en toda la aplicación: «C mayor», no «Do mayor».
    expect(screen.getByText(/C mayor · 1 sección · 4 acordes · 100 bpm/)).toBeInTheDocument();
  });

  it('sin nada guardado lo dice, en vez de dejar el hueco vacío', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [] }));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText(/Todavía no has guardado ninguna/)).toBeInTheDocument();
  });
});

describe('guardar', () => {
  it('manda la tonalidad y los grados, no los cifrados', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado ninguna/);

    componiendo(['I', 'V', 'vi', 'IV']);
    await userEvent.type(screen.getByLabelText('Nombre'), 'Mi canción');
    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    const post = request.mock.calls.find(([init]) => init.method === 'POST');
    expect(post).toBeDefined();
    expect(JSON.parse(post![0].body as string)).toEqual({
      name: 'Mi canción',
      tonic: C,
      mode: 'major',
      // El tempo del metrónomo entra en la canción: es lo que hace que al
      // abrirla mañana suene a la velocidad a la que la escribiste.
      bpm: DEFAULT_BPM,
      sections: [{ name: 'Parte 1', degrees: ['I', 'V', 'vi', 'IV'] }],
    });
  });

  it('sin tonalidad no guarda, y dice por qué', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado ninguna/);

    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Elige una tonalidad/);
    expect(request.mock.calls.some(([init]) => init.method === 'POST')).toBe(false);
  });

  it('sin un solo acorde no guarda, y dice por qué', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado ninguna/);

    componiendo([]);
    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/al menos uno/);
  });

  it('dice cuántos acordes se han quedado fuera, en vez de perderlos callando', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado ninguna/);

    // «V7/vi» es un dominante secundario: no es un grado del catálogo.
    componiendo(['I', 'V7/vi', 'vi']);
    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Un acorde no es un grado/);
  });

  it('el error del servidor se enseña tal y como lo escribe el servidor', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(respondWith({ songs: [] }))
      .mockResolvedValueOnce(
        respondWith(
          { error: { code: 'llena', message: 'Ya tienes 50 canciones guardadas.' } },
          409,
        ),
      );
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado ninguna/);

    componiendo(['I', 'V']);
    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes 50 canciones guardadas.');
  });
});

describe('abrir', () => {
  it('deja la tonalidad y el camino puestos en el modo componer', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir' }));

    const state = useSessionStore.getState();
    expect(state.pinnedKey).toEqual({ tonic: C, mode: 'major' });
    // Los cifrados salen del dominio al abrir, no de lo que se guardó.
    expect(state.path.map((chord) => chord.symbol)).toEqual(['C', 'G', 'Am', 'F']);
    expect(state.currentDegree).toBe('IV');
  });

  it('abrir dos veces no encadena las dos canciones', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    const abrir = await screen.findByRole('button', { name: 'Abrir' });
    await userEvent.click(abrir);
    await userEvent.click(abrir);

    expect(useSessionStore.getState().path).toHaveLength(4);
  });
});

describe('borrar', () => {
  it('manda el identificador y vuelve a leer la lista', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));

    await waitFor(() => {
      const del = request.mock.calls.find(([init]) => init.method === 'DELETE');
      expect(del).toBeDefined();
      expect(JSON.parse(del![0].body as string)).toEqual({ id: UNA.id });
    });
    // Tres llamadas: la lista al montar, el borrado y la lista de después.
    expect(request.mock.calls.filter(([init]) => init.method === 'GET')).toHaveLength(2);
  });
});

describe('renombrar', () => {
  it('sustituye la fila en vez de abrir otra cosa, y manda la canción entera', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar' }));
    const campo = screen.getByLabelText('Nombre nuevo');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Otro nombre');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const put = request.mock.calls.find(([init]) => init.method === 'PUT');
    expect(put).toBeDefined();
    // Entera y no solo el nombre: el contrato la interpreta con la misma función
    // que interpreta lo que llega de Postgres, y una a medias no pasaría.
    expect(JSON.parse(put![0].body as string)).toMatchObject({
      id: UNA.id,
      name: 'Otro nombre',
      tonic: UNA.tonic,
      sections: UNA.sections,
    });
  });

  it('«dejarlo» no manda nada', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));

    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dejarlo' }));

    expect(request.mock.calls.some(([init]) => init.method === 'PUT')).toBe(false);
    expect(screen.getByText('La mía')).toBeInTheDocument();
  });
});

describe('añadir una parte', () => {
  it('añade lo que llevas encadenado como sección nueva', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    componiendo(['ii', 'V']);
    await userEvent.click(screen.getByRole('button', { name: 'Añadir parte' }));

    const put = request.mock.calls.find(([init]) => init.method === 'PUT');
    expect(JSON.parse(put![0].body as string).sections).toEqual([
      ...UNA.sections,
      { name: 'Parte 2', degrees: ['ii', 'V'] },
    ]);
  });

  it('no deja mezclar tonalidades, y dice por qué', async () => {
    // Meter en una canción en Do una parte que tocaste en Sol guardaría los
    // grados de Sol dentro de una canción de Do: al abrirla sonaría otra cosa
    // sin que nadie hubiera hecho nada mal.
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('G'), mode: 'major' });
    actions.pushChord({ symbol: 'G', label: 'I', root: C, notes: [C], why: 'x' });
    actions.pushChord({ symbol: 'D', label: 'V', root: C, notes: [C], why: 'x' });

    await userEvent.click(screen.getByRole('button', { name: 'Añadir parte' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/está en C mayor y tú estás en G mayor/);
    expect(request.mock.calls.some(([init]) => init.method === 'PUT')).toBe(false);
  });

  it('sin acordes encadenados no añade nada', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    componiendo([]);
    await userEvent.click(screen.getByRole('button', { name: 'Añadir parte' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Encadena algún acorde/);
  });

  it('con varias partes se ven todas, con una sola no se enseña la lista', async () => {
    const dos: Song = {
      ...UNA,
      sections: [
        { name: 'Estrofa', degrees: ['I', 'V'] },
        { name: 'Estribillo', degrees: ['vi', 'IV'] },
      ],
    };
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [dos] }));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText('Estrofa:')).toBeInTheDocument();
    expect(screen.getByText('Estribillo:')).toBeInTheDocument();
  });
});

describe('cuando el servidor no coopera', () => {
  it('no poder leer la lista se dice, en vez de parecer que no tienes ninguna', async () => {
    // Una lista vacía diría «no tienes ninguna», que es mentira y da un susto de
    // los que hacen cerrar la aplicación.
    const request = vi.fn().mockResolvedValue(respondWith({ error: { message: 'No va.' } }, 502));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText('No va.')).toBeInTheDocument();
  });

  it('sin red, tampoco se queda callado', async () => {
    const request = vi.fn().mockRejectedValue(new Error('sin red'));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText(/Comprueba la conexión/)).toBeInTheDocument();
  });

  it('una cancion con el documento a medias se cae de la lista, no la tumba', async () => {
    // Cada canción pasa por `parseSong` aunque venga del propio servidor.
    const request = vi
      .fn()
      .mockResolvedValue(respondWith({ songs: [UNA, { id: 'rota', name: 'Rota' }] }));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText('La mía')).toBeInTheDocument();
    expect(screen.queryByText('Rota')).not.toBeInTheDocument();
  });

  it('un cuerpo sin lista se lee como lista vacia', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({}));
    render(conCuenta(<SongsPanel request={request} />));

    expect(await screen.findByText(/Todavía no has guardado/)).toBeInTheDocument();
  });

  it('borrar y no poder se dice', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(respondWith({ songs: [UNA] }))
      .mockResolvedValueOnce(respondWith({ error: { message: 'No se ha borrado.' } }, 502));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    await userEvent.click(screen.getByRole('button', { name: /borrar/i }));

    expect(await screen.findByText('No se ha borrado.')).toBeInTheDocument();
  });

  it('borrar sin red, tampoco', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(respondWith({ songs: [UNA] }))
      .mockRejectedValueOnce(new Error('sin red'));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    await userEvent.click(screen.getByRole('button', { name: /borrar/i }));

    expect(await screen.findByText(/No hemos podido borrar/)).toBeInTheDocument();
  });

  it('guardar sin red se dice', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(respondWith({ songs: [] }))
      .mockRejectedValueOnce(new Error('sin red'));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText(/Todavía no has guardado/);

    componiendo(['I', 'V']);
    await userEvent.type(screen.getByLabelText('Nombre'), 'Nueva');
    await userEvent.click(screen.getByRole('button', { name: /Guardar esta progresión/ }));

    expect(await screen.findByText(/No hemos podido guardar la canción/)).toBeInTheDocument();
  });
});

describe('el tope de partes', () => {
  it('una canción llena no admite otra, y se dice cuál es el tope', async () => {
    const llena: Song = {
      ...UNA,
      sections: Array.from({ length: MAX_SECTIONS }, (_, i) => ({
        name: `Parte ${i + 1}`,
        degrees: ['I', 'V'],
      })),
    };
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [llena] }));
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    componiendo(['I', 'V']);
    await userEvent.click(screen.getByRole('button', { name: 'Añadir parte' }));

    expect(await screen.findByText(/que es el tope/)).toBeInTheDocument();
  });

  it('sin tonalidad no se añade nada, y se dice por qué', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ songs: [UNA] }));
    useSessionStore.getState().actions.reset();
    render(conCuenta(<SongsPanel request={request} />));
    await screen.findByText('La mía');

    await userEvent.click(screen.getByRole('button', { name: 'Añadir parte' }));

    expect(await screen.findByText(/Elige una tonalidad/)).toBeInTheDocument();
  });
});
