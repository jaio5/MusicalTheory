/**
 * Las canciones de la cuenta.
 *
 * `GET` las lista, `POST` crea una, `PUT` escribe encima de una que ya existe y
 * `DELETE` borra. Cuatro verbos y una sola tabla, sin nada que fusionar: a
 * diferencia del avance, dos aparatos que guardan la misma canción no tienen que
 * ponerse de acuerdo, porque quien guarda es quien la tiene abierta.
 *
 * Lo que sube son **grados, un tempo y nombres de sección**. Ni audio ni vídeo,
 * aquí tampoco: eso no sale del equipo y esta ruta no cambia eso.
 *
 * El identificador de la canción **no se cree nunca del cuerpo**: al crear lo
 * pone Postgres, y al actualizar se comprueba contra el dueño en la misma
 * sentencia que escribe.
 */

import { NextResponse } from 'next/server';

import { can, cheapestPlanWith, needsPlanMessage } from '@core/billing';
import { MAX_SONGS, parseSong, type Song } from '@core/music';
import { currentSession } from '@server/entitlements';
import { readJsonBody } from '@server/request-body';
import {
  createSong,
  isSongId,
  listSongs,
  removeSong,
  updateSong,
  type SaveResult,
} from '@server/songs-repo';

export const runtime = 'nodejs';

function sinCuenta(): NextResponse {
  return NextResponse.json(
    { error: { code: 'sin-cuenta', message: 'Entra con tu cuenta para guardar tus canciones.' } },
    { status: 401 },
  );
}

function sinPlan(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'plan-necesario',
        message: needsPlanMessage(cheapestPlanWith('canciones'), 'Guardar tus canciones', true),
      },
    },
    { status: 402 },
  );
}

function noLeido(): NextResponse {
  return NextResponse.json(
    {
      error: { code: 'no-leido', message: 'No hemos podido leer tus canciones ahora mismo.' },
    },
    { status: 502 },
  );
}

/**
 * Que no exista y que no sea tuya se contestan igual, y por eso la frase es una.
 *
 * Desde fuera son el mismo caso —esa dirección no lleva a nada tuyo—, y decir
 * cuál de los dos es confirmaría que ese identificador existe en la cuenta de
 * otra persona.
 */
const NO_ESTA = 'Esa canción ya no está en tu cuenta.';

function noEsUna(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'cancion-vacia',
        message: 'Una canción necesita al menos un acorde para poder guardarse.',
      },
    },
    { status: 400 },
  );
}

/** La cuenta y el permiso, que se comprueban igual en los cuatro verbos. */
async function puerta(): Promise<
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly res: NextResponse }
> {
  const session = await currentSession();
  if (session === null) {
    return { ok: false, res: sinCuenta() };
  }
  if (!can(session.account.plan, 'canciones')) {
    return { ok: false, res: sinPlan() };
  }
  return { ok: true, userId: session.userId };
}

/**
 * Traduce lo que dijo el repositorio.
 *
 * Está aquí y no en el repositorio porque el repositorio no sabe de HTTP, y la
 * frase de «no te caben más» tiene que decir el número: un tope sin número
 * obliga a contar a mano cuántas hay para saber cuántas sobran.
 */
function respuesta(result: SaveResult): NextResponse {
  switch (result.kind) {
    case 'ok':
      return NextResponse.json({ song: result.song });
    case 'no-existe':
      return NextResponse.json(
        {
          error: { code: 'no-existe', message: NO_ESTA },
        },
        { status: 404 },
      );
    case 'llena':
      return NextResponse.json(
        {
          error: {
            code: 'llena',
            message: `Ya tienes ${MAX_SONGS} canciones guardadas. Borra alguna para guardar otra.`,
          },
        },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { error: { code: 'no-guardado', message: 'No hemos podido guardar la canción.' } },
        { status: 502 },
      );
  }
}

export async function GET(): Promise<NextResponse> {
  const puerto = await puerta();
  if (!puerto.ok) {
    return puerto.res;
  }

  const songs = await listSongs(puerto.userId);
  return songs === null ? noLeido() : NextResponse.json({ songs });
}

export async function POST(request: Request): Promise<NextResponse> {
  const puerto = await puerta();
  if (!puerto.ok) {
    return puerto.res;
  }

  // El identificador que venga en el cuerpo se ignora: aquí se está creando, y
  // el de verdad lo pone Postgres al insertar.
  const song = parseSong(await readJsonBody(request), 'nueva');
  if (song === null) {
    return noEsUna();
  }

  return respuesta(await createSong(puerto.userId, song));
}

export async function PUT(request: Request): Promise<NextResponse> {
  const puerto = await puerta();
  if (!puerto.ok) {
    return puerto.res;
  }

  const record = await readJsonBody(request);
  const id = record['id'];
  if (!isSongId(id)) {
    return NextResponse.json(
      {
        error: { code: 'no-existe', message: NO_ESTA },
      },
      { status: 404 },
    );
  }

  const song: Song | null = parseSong(record, id);
  if (song === null) {
    return noEsUna();
  }

  return respuesta(await updateSong(puerto.userId, song));
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const puerto = await puerta();
  if (!puerto.ok) {
    return puerto.res;
  }

  const record = await readJsonBody(request);
  // `removeSong` recibe lo que llegue y comprueba la forma: un identificador
  // inventado es «no existe», no un fallo del servidor.
  const removed = await removeSong(puerto.userId, record['id']);

  switch (removed) {
    case 'ok':
      return NextResponse.json({ borrada: true });
    case 'no-existe':
      return NextResponse.json({ error: { code: 'no-existe', message: NO_ESTA } }, { status: 404 });
    default:
      return NextResponse.json(
        { error: { code: 'no-borrado', message: 'No hemos podido borrar la canción.' } },
        { status: 502 },
      );
  }
}
