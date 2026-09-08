/**
 * El avance de la cuenta.
 *
 * `GET` lo baja. `PUT` sube el de este navegador, lo **fusiona** con el que haya
 * guardado y devuelve el resultado, que es el que el navegador se queda.
 *
 * Fusiona el servidor y no el navegador, y eso es lo importante de este fichero.
 * Si el navegador leyese, fusionase y escribiese, dos aparatos abiertos a la vez
 * se pisarían: el segundo en escribir borraría lo que hizo el primero. Fusionando
 * aquí, subir es siempre seguro y nunca hay que decidir quién gana.
 *
 * Lo que sube son identificadores de unidad, números y fechas. Nada de audio,
 * aquí tampoco: eso no sale del equipo y esta ruta no cambia eso.
 */

import { NextResponse } from 'next/server';

import { can, cheapestPlanWith, needsPlanMessage } from '@core/billing';
import { EMPTY_PROGRESS, mergeProgress, parseProgress } from '@core/music';
import { currentSession } from '@server/entitlements';
import { readJsonBody } from '@server/request-body';
import { loadAccountProgress, saveAccountProgress } from '@server/progress-repo';

export const runtime = 'nodejs';

type Sesion = NonNullable<Awaited<ReturnType<typeof currentSession>>>;

function sinCuenta(): NextResponse {
  return NextResponse.json(
    { error: { code: 'sin-cuenta', message: 'Entra con tu cuenta para guardar tu avance.' } },
    { status: 401 },
  );
}

function sinPlan(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'plan-necesario',
        message: needsPlanMessage(
          cheapestPlanWith('sincronizar'),
          'Guardar el avance en la cuenta',
        ),
      },
    },
    { status: 402 },
  );
}

/**
 * La sesión que puede sincronizar, o ya la respuesta que explica por qué no.
 *
 * Las dos operaciones piden lo mismo —cuenta y plan— y lo pedían con seis líneas
 * calcadas. Devolver la respuesta en vez de lanzar deja que quien llama la
 * reenvíe tal cual, que es lo único que hacía con ella.
 */
async function sesionQueSincroniza(): Promise<Sesion | NextResponse> {
  const session = await currentSession();
  if (session === null) {
    return sinCuenta();
  }
  if (!can(session.account.plan, 'sincronizar')) {
    return sinPlan();
  }
  return session;
}

export async function GET(): Promise<NextResponse> {
  const session = await sesionQueSincroniza();
  if (session instanceof NextResponse) {
    return session;
  }

  const loaded = await loadAccountProgress(session.userId);
  if (loaded.kind === 'error') {
    return NextResponse.json(
      { error: { code: 'no-leido', message: 'No hemos podido leer tu avance ahora mismo.' } },
      { status: 502 },
    );
  }

  return NextResponse.json({
    progress: loaded.kind === 'ok' ? loaded.progress : EMPTY_PROGRESS,
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await sesionQueSincroniza();
  if (session instanceof NextResponse) {
    return session;
  }

  const record = await readJsonBody(request);

  // Lo que llega del navegador se interpreta con la misma función que interpreta
  // lo que se lee de la base de datos. Cualquiera puede abrir la consola y
  // mandar un avance con los diez cursos hechos; lo que no puede es mandar una
  // unidad que no existe, un XP que no cuadre con lo hecho o una racha sin fecha.
  const entrante = parseProgress(record['progress']);

  const guardado = await loadAccountProgress(session.userId);
  if (guardado.kind === 'error') {
    // Sin poder leer lo que había, no se escribe: escribir sería sustituir el
    // avance de la cuenta por el de este navegador, y eso es perder lo que se
    // hizo en otro sitio.
    return NextResponse.json(
      {
        error: {
          code: 'no-leido',
          message: 'No hemos podido leer tu avance, así que no lo hemos tocado. Vuelve a probar.',
        },
      },
      { status: 502 },
    );
  }

  const junto = guardado.kind === 'ok' ? mergeProgress(guardado.progress, entrante) : entrante;

  if (!(await saveAccountProgress(session.userId, junto))) {
    return NextResponse.json(
      { error: { code: 'no-guardado', message: 'No hemos podido guardar tu avance.' } },
      { status: 502 },
    );
  }

  return NextResponse.json({ progress: junto });
}
