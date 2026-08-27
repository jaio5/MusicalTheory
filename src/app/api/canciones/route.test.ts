import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tus canciones guardadas: los cuatro verbos.
 *
 * Lo que importa aquí es que **cada consulta filtre por tu cuenta** —lo garantiza
 * el repositorio, y esto comprueba que la ruta le pasa siempre el usuario de la
 * sesión y nunca uno que venga en el cuerpo— y que los cuatro estados del
 * repositorio se traduzcan a códigos distintos: no es lo mismo «no existe» que
 * «no te caben más».
 */

const currentSession = vi.fn();
const listSongs = vi.fn();
const createSong = vi.fn();
const updateSong = vi.fn();
const removeSong = vi.fn();

vi.mock('@server/entitlements', () => ({ currentSession: () => currentSession() }));
vi.mock('@server/songs-repo', () => ({
  isSongId: (v: unknown) => typeof v === 'string' && v !== '',
  listSongs: (...a: unknown[]) => listSongs(...a),
  createSong: (...a: unknown[]) => createSong(...a),
  updateSong: (...a: unknown[]) => updateSong(...a),
  removeSong: (...a: unknown[]) => removeSong(...a),
}));

const { GET, POST, PUT, DELETE } = await import('./route');

/** Guardar canciones entra en un plan de pago. */
const SESION = { userId: 'u1', account: { plan: 'basico' } };

/** La canción viaja en la raíz del cuerpo, no envuelta. */
const CANCION = {
  name: 'La mía',
  tonic: 0,
  mode: 'major',
  bpm: 100,
  sections: [{ name: 'A', degrees: ['I', 'V', 'vi', 'IV'] }],
  updatedAt: 1,
};

function pedir(metodo: string, body?: unknown): Request {
  return new Request('http://x/api/canciones', {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  currentSession.mockReset();
  currentSession.mockResolvedValue(SESION);
  for (const m of [listSongs, createSong, updateSong, removeSong]) {
    m.mockReset();
  }
});

describe('la puerta, igual en los cuatro verbos', () => {
  it('sin cuenta no se lee ni se escribe nada', async () => {
    currentSession.mockResolvedValue(null);

    expect((await leer(await GET())).status).toBe(401);
    expect((await leer(await POST(pedir('POST', CANCION)))).status).toBe(401);
    expect((await leer(await PUT(pedir('PUT', { ...CANCION, id: 'a' })))).status).toBe(401);
    expect((await leer(await DELETE(pedir('DELETE', { id: 1 })))).status).toBe(401);
    expect(listSongs).not.toHaveBeenCalled();
    expect(createSong).not.toHaveBeenCalled();
  });

  it('con el plan gratis pide plan, y dice cuál', async () => {
    currentSession.mockResolvedValue({ userId: 'u1', account: { plan: 'gratis' } });

    const { status, body } = await leer(await GET());

    expect(status).toBe(402);
    expect((body['error'] as { message: string }).message).toMatch(/plan/i);
  });
});

describe('quién es el dueño', () => {
  it('el usuario sale de la sesión, nunca del cuerpo', async () => {
    // Es lo que impide escribir en la canción de otra persona mandando su
    // identificador. El repositorio filtra por `userId` en las cuatro consultas,
    // y esto comprueba que le llega el de la sesión.
    createSong.mockResolvedValue({ kind: 'ok', song: { id: 1, ...CANCION } });

    await POST(pedir('POST', { ...CANCION, userId: 'otro' }));

    expect(createSong).toHaveBeenCalledWith('u1', expect.anything());
  });

  it('listar solo pide las tuyas', async () => {
    listSongs.mockResolvedValue([]);

    await GET();

    expect(listSongs).toHaveBeenCalledWith('u1');
  });
});

describe('lo que dice el repositorio se traduce a códigos distintos', () => {
  it('guardar bien devuelve la canción', async () => {
    createSong.mockResolvedValue({ kind: 'ok', song: { id: 7, ...CANCION } });

    const { status, body } = await leer(await POST(pedir('POST', CANCION)));

    expect(status).toBe(200);
    expect(body['song']).toMatchObject({ id: 7 });
  });

  it('una canción que no existe es 404', async () => {
    updateSong.mockResolvedValue({ kind: 'no-existe' });

    expect((await leer(await PUT(pedir('PUT', { ...CANCION, id: 'la-mia' })))).status).toBe(404);
  });

  it('cuando no caben más, 409 y con el número dentro', async () => {
    // Un tope sin número obliga a contar a mano cuántas hay para saber cuántas
    // sobran.
    createSong.mockResolvedValue({ kind: 'llena' });

    const { status, body } = await leer(await POST(pedir('POST', CANCION)));

    expect(status).toBe(409);
    expect((body['error'] as { message: string }).message).toMatch(/\d+/);
  });

  it('si la base de datos falla, 502', async () => {
    createSong.mockResolvedValue({ kind: 'error' });

    expect((await leer(await POST(pedir('POST', CANCION)))).status).toBe(502);
  });
});

describe('lo que entra', () => {
  it('una canción que no lo es no se guarda', async () => {
    const { status } = await leer(await POST(pedir('POST', { loQueSea: true })));

    expect(status).toBe(400);
    expect(createSong).not.toHaveBeenCalled();
  });

  it('actualizar sin identificador es «no existe», no un fallo', async () => {
    const { status } = await leer(await PUT(pedir('PUT', CANCION)));

    expect(status).toBe(404);
    expect(updateSong).not.toHaveBeenCalled();
  });

  it('borrar sin decir cuál no borra nada', async () => {
    removeSong.mockResolvedValue('no-existe');

    await DELETE(pedir('DELETE', {}));

    // Se le pasa lo que venga y el repositorio decide; lo que no puede es borrar
    // sin identificador.
    expect(removeSong).toHaveBeenCalledWith('u1', undefined);
  });
});

describe('cuando la base de datos no contesta', () => {
  it('leer la lista y no poder es un 502, no una lista vacia', async () => {
    // Una lista vacía diría «no tienes ninguna», que es mentira y da un susto
    // de los que hacen cerrar la aplicación.
    listSongs.mockResolvedValue(null);

    const respuesta = await GET();

    expect(respuesta.status).toBe(502);
    expect(((await respuesta.json()) as { error: { code: string } }).error.code).toBe('no-leido');
  });

  it('borrar y no poder tambien se distingue de que no existiera', async () => {
    removeSong.mockResolvedValue('error');

    const respuesta = await DELETE(pedir('DELETE', { id: 's1' }));

    expect(respuesta.status).toBe(502);
    expect(((await respuesta.json()) as { error: { code: string } }).error.code).toBe('no-borrado');
  });

  it('borrar una que no esta es un 404', async () => {
    removeSong.mockResolvedValue('no-existe');

    expect((await DELETE(pedir('DELETE', { id: 'inventada' }))).status).toBe(404);
  });

  it('borrar una que si esta lo dice', async () => {
    removeSong.mockResolvedValue('ok');

    const respuesta = await DELETE(pedir('DELETE', { id: 's1' }));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ borrada: true });
  });
});

describe('cambiar una guardada', () => {
  it('sin identificador no se toca nada: es «no existe», no un 500', async () => {
    const respuesta = await PUT(pedir('PUT', CANCION));

    expect(respuesta.status).toBe(404);
    expect(updateSong).not.toHaveBeenCalled();
  });

  it('con identificador pero sin canción tampoco', async () => {
    const respuesta = await PUT(pedir('PUT', { id: 's1', name: 'solo el nombre' }));

    expect(respuesta.status).toBe(400);
    expect(updateSong).not.toHaveBeenCalled();
  });
});
