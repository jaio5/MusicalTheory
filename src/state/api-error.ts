/**
 * Lo que dijo el servidor cuando dijo que no.
 *
 * **Todas las rutas de esta aplicación contestan el mismo sobre** cuando algo va
 * mal: `{ error: { code, message } }`, con la frase ya escrita en español y
 * diciendo qué hacer. Eso es un contrato compartido, y estaba leído a mano en
 * cuatro sitios —ideas, versiones, canciones y la contraseña olvidada— con
 * cuatro variantes de la misma comprobación.
 *
 * Vive en `state/` porque es donde este proyecto habla con el servidor
 * (`account.ts` ya hace sus `fetch` aquí), y no en `ui/`, que es lo que se pinta.
 *
 * El código se devuelve además de la frase porque no todos los errores se
 * arreglan igual: un «no entra en tu plan» lleva a la pantalla de planes y un
 * modelo caído no lleva a ningún sitio.
 */

export interface ApiError<Code extends string = string> {
  readonly code: Code | null;
  readonly message: string;
}

/** El sobre de error de un cuerpo ya interpretado, si lo trae. */
function errorEnvelope(payload: unknown): { code?: unknown; message?: unknown } | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const error = (payload as { error?: unknown }).error;
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }) : null;
}

/**
 * El error de un cuerpo ya interpretado.
 *
 * `fallback` es lo que se dice cuando el servidor no dijo nada legible, y lo pone
 * quien llama porque depende de qué se estaba intentando: «no hemos podido
 * guardar la canción» y «no hemos podido contactar con el modelo» no son la misma
 * frase.
 */
export function apiErrorOf<Code extends string = string>(
  payload: unknown,
  fallback: string,
): ApiError<Code> {
  const error = errorEnvelope(payload);
  const code = typeof error?.code === 'string' ? (error.code as Code) : null;
  const message =
    typeof error?.message === 'string' && error.message !== '' ? error.message : fallback;

  return { code, message };
}

/**
 * Lo mismo, leyendo la respuesta.
 *
 * Un cuerpo que no es JSON devuelve la frase de respaldo en vez de lanzar: una
 * pasarela caída o un proxy que se mete por medio contestan HTML, y eso no puede
 * convertirse en una excepción sin mensaje delante de quien está mirando.
 */
export async function apiErrorFrom<Code extends string = string>(
  response: Response,
  fallback: string,
): Promise<ApiError<Code>> {
  try {
    return apiErrorOf<Code>(await response.json(), fallback);
  } catch {
    return { code: null, message: fallback };
  }
}
