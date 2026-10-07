/**
 * El avance de la cuenta.
 *
 * `GET` lo baja. `PUT` sube el de este navegador, lo **fusiona** con el que haya
 * guardado y devuelve el resultado, que es el que el navegador se queda.
 *
 * Fusiona el servidor y no el navegador, y eso es lo importante de este fichero.
 * Si el navegador leyese, fusionase y escribiese, dos aparatos abiertos a la vez
 * se pisarían: el segundo en escribir borraría lo que hizo el primero. Fusionando
 * aquí, subir es siempre seguro y nunca hay que decidir quién gana. **Y fusiona
 * en una transacción** (`fusionarAvance`): leer, fundir y escribir sueltos dejaba
 * que dos subidas a la vez se pisaran igual, solo que aquí dentro (adr/0116).
 *
 * Lo que sube son identificadores de unidad, números y fechas. Nada de audio,
 * aquí tampoco: eso no sale del equipo y esta ruta no cambia eso.
 */

import { NextResponse } from 'next/server';

import { can, cheapestPlanWith, needsPlanMessage } from '@core/billing';
import { EMPTY_PROGRESS, parseProgress, posicionesDeLaUnidad } from '@core/music';
import { currentSession } from '@server/entitlements';
import { fusionarAvance, hoyEnElServidor, loadAccountProgress } from '@server/progress-repo';
import { readJsonBody } from '@server/request-body';
import { frenoPorCuenta, TOPE_DEL_AVANCE } from '@server/tope-por-cuenta';

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

  const frenado = await frenoPorCuenta('progreso', session.userId, TOPE_DEL_AVANCE);
  if (frenado !== null) {
    return frenado;
  }

  // Lo que llega del navegador se interpreta con la misma función que interpreta
  // lo que se lee de la base de datos. Cualquiera puede abrir la consola y
  // mandar un avance con los diez cursos hechos; lo que no puede es mandar una
  // unidad que no existe, un XP que no cuadre con lo hecho, una racha sin fecha o
  // una fecha posterior a mañana (adr/0116). Y con las posiciones contadas, como
  // lo leído de la cuenta: el navegador no carga las lecciones para contarlas, así
  // que lo que su cola apunte a una pregunta que ya no existe se suelta aquí.
  const hoy = hoyEnElServidor();
  const entrante = parseProgress(
    (await readJsonBody(request))['progress'],
    posicionesDeLaUnidad,
    hoy,
  );

  const junto = await fusionarAvance(session.userId, entrante, hoy);
  if (junto === null) {
    // Sin poder leer lo que había no se escribe, y la transacción lo garantiza:
    // escribir sería sustituir el avance de la cuenta por el de este navegador.
    return NextResponse.json(
      {
        error: {
          code: 'no-guardado',
          message:
            'No hemos podido guardar tu avance, y lo que había sigue igual. Vuelve a probar.',
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ progress: junto });
}
