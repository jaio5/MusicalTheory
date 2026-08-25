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
 * Vive en `server/` y no en `core/` porque conoce `Request`, que es HTTP. La
 * pregunta pura de si algo tiene forma de objeto está en `core/parse.ts`, y esto
 * la usa.
 */

import { isRecordOrEmpty } from '@core/parse';

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return isRecordOrEmpty(await request.json());
  } catch {
    return {};
  }
}
