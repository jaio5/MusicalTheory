/**
 * El cuerpo de una petición, leído sin creerse nada.
 *
 * Todas las rutas de esta aplicación hacían lo mismo con siete líneas iguales:
 * intentar `request.json()`, tratar el fallo como cuerpo vacío y forzar el tipo a
 * un objeto de claves. Dos de ellas tenían además la misma función auxiliar
 * escrita letra por letra.
 *
 * **Un cuerpo roto se lee como uno vacío y no como un error.** Quien decide si
 * falta algo es la validación de cada campo, que sabe qué falta y puede decirlo
 * en español: un «cuerpo inválido» genérico diría menos y obligaría a adivinar.
 *
 * **Y un cuerpo enorme también se lee como vacío, sin llegar a leerlo entero.**
 * `request.json()` se traga lo que le manden: el dominio acota lo que se *guarda*
 * —doce secciones, treinta y dos grados, sesenta y cuatro notas de punteo— pero
 * eso se comprueba *después* de tener el JSON en memoria, así que nada impedía
 * mandar cincuenta megas y que el servidor los juntara antes de decir que no. Es
 * la única puerta de esta aplicación por la que entra algo de tamaño libre.
 *
 * Vive en `server/` y no en `core/` porque conoce `Request`, que es HTTP. La
 * pregunta pura de si algo tiene forma de objeto está en `core/parse.ts`, y esto
 * la usa.
 */

import { isRecordOrEmpty } from '@core/parse';

/**
 * Lo más que puede pesar un cuerpo legítimo, con sitio de sobra.
 *
 * El más grande que esta aplicación manda es una canción llena: doce secciones
 * con treinta y dos grados y sesenta y cuatro notas de punteo cada una, más los
 * nombres. Contando generosamente son unos treinta y cinco kilobytes, así que
 * esto deja casi cuatro veces ese margen y sigue estando cuatro órdenes de
 * magnitud por debajo de lo que haría daño.
 *
 * No es un límite de validación: es un límite de *lectura*. Lo que quepa aquí lo
 * sigue midiendo el dominio con sus propios topes.
 */
export const MAX_CUERPO = 128 * 1024;

/**
 * El cuerpo como texto, o nulo si se pasa de tamaño.
 *
 * Se mira primero `Content-Length`, que evita leer nada cuando el propio cliente
 * confiesa el tamaño. Pero **no se confía en él**: puede faltar —en una petición
 * troceada no viene— y puede mentir, así que el flujo se lee a trozos y se corta
 * en cuanto se pasa. Quedarse solo con la cabecera sería una comprobación que
 * cualquiera puede saltarse omitiéndola.
 */
async function textoAcotado(request: Request): Promise<string | null> {
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO) {
    return null;
  }

  const flujo = request.body;
  /* v8 ignore next 3 -- una peticion sin cuerpo no llega aqui: las rutas que leen cuerpo son POST y PUT */
  if (flujo === null) {
    return '';
  }

  const lector = flujo.getReader();
  const trozos: Uint8Array[] = [];
  let leidos = 0;

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) {
        break;
      }
      leidos += value.byteLength;
      if (leidos > MAX_CUERPO) {
        // Se suelta el flujo sin terminar de leerlo: seguir vaciándolo por
        // cortesía sería justo el trabajo del que uno se quiere ahorrar.
        await lector.cancel();
        return null;
      }
      trozos.push(value);
    }
  } finally {
    lector.releaseLock();
  }

  const todo = new Uint8Array(leidos);
  let desde = 0;
  for (const trozo of trozos) {
    todo.set(trozo, desde);
    desde += trozo.byteLength;
  }
  return new TextDecoder().decode(todo);
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const texto = await textoAcotado(request);
    return texto === null ? {} : isRecordOrEmpty(JSON.parse(texto));
  } catch {
    return {};
  }
}
