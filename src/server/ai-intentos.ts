/**
 * Preguntarle al modelo con su reintento, y qué hacer si no sale.
 *
 * Era la mitad de abajo de `ai-route.ts`, y salió de allí por una razón concreta:
 * **el examen del profesor tiene que ir por este mismo camino**
 * (`scripts/examen-del-profesor.ts`). La ruta arrastra `next/server`, la sesión, la
 * base de datos y las puertas del cupo, y nada de eso cambia lo que se contesta;
 * esto sí. Un examen con su propia copia del bucle mediría otro programa, y la
 * primera vez que se separaran el examen aprobaría lo que la ruta no sirve.
 *
 * No sabe de HTTP: devuelve un desenlace, y la ruta decide qué código sale de cada
 * uno.
 */

import { MAX_MODEL_ATTEMPTS, type UsoDelModelo } from '@core/billing';

import { askModel, RespuestaTruncada } from './ask-model';

/** Por qué no ha salido una respuesta del modelo. Son los dos 502 de las rutas. */
export type FalloDelModelo = 'model_unavailable' | 'unparseable_response';

/**
 * Lo que una ruta le pregunta al modelo y cómo comprueba lo que vuelve.
 *
 * `Peticion` es lo que sale de validar el cuerpo y `Respuesta` lo que se devuelve
 * como JSON cuando todo va bien.
 */
export interface PreguntaAlModelo<Peticion, Respuesta> {
  readonly prompt: (peticion: Peticion) => string;
  readonly system: string;
  /**
   * El esquema que se le exige a la respuesta.
   *
   * Es una función de la petición porque en las salidas depende de ella: los
   * grados válidos no son los mismos en mayor que en menor.
   */
  readonly schema: (peticion: Peticion) => Record<string, unknown>;
  readonly maxTokens: number;
  /** Qué contestar sin clave, construido desde el dominio. */
  readonly sinClave: (peticion: Peticion) => unknown;
  /**
   * Comprueba contra el dominio lo que ha contestado el modelo y devuelve el
   * cuerpo de la respuesta, o nulo si no vale y hay que reintentar.
   *
   * Devuelve el cuerpo entero y no los datos sueltos porque cada ruta lo envuelve
   * distinto —`{ versions }`, la respuesta del profesor a pelo— y eso es cosa
   * suya, no de aquí.
   */
  readonly validar: (payload: unknown, peticion: Peticion) => Respuesta | null;
  /**
   * Qué contestar cuando el modelo no ha dado nada que valga: no ha contestado,
   * se ha cortado por el tope o lo que dijo no pasó la validación las dos veces.
   *
   * **Opcional, y lo construye la ruta desde el dominio**, nunca desde lo que dijo
   * el modelo: si lo que vuelve no pasó el validador, no se puede reaprovechar a
   * trozos. Nulo es «no tengo nada honrado que decir», y entonces sale el 502 de
   * siempre. Quien conteste algo tiene que decir en la respuesta que no es del
   * modelo: es lo que se le debe a quien lo lee.
   *
   * **Y el `fallo` no es un adorno**: con el modelo caído, «pregúntalo de otra
   * manera» hace gastar otra pregunta contra lo mismo. El respaldo lo usa para
   * elegir qué decir y lo devuelve en la respuesta, como `motivo`.
   */
  readonly respaldo?: (peticion: Peticion, fallo: FalloDelModelo) => Respuesta | null;
}

/** Cómo acabó: con lo del modelo, con el respaldo o sin nada. */
export type Desenlace<Respuesta> =
  | { readonly kind: 'modelo'; readonly respuesta: Respuesta }
  | { readonly kind: 'respaldo'; readonly respuesta: Respuesta; readonly fallo: FalloDelModelo }
  | { readonly kind: 'error'; readonly fallo: FalloDelModelo };

export interface OpcionesDeLaPregunta {
  /** Lo que dijo el modelo en cada intento, antes de validarlo. Para el examen. */
  readonly alIntentar?: (payload: unknown) => void;
  /**
   * Lo que ha gastado cada llamada a la API (`askModel`), para el techo de gasto.
   * Nulo es una llamada sin respuesta, que se cuenta como el peor caso.
   */
  readonly alUsar?: (uso: UsoDelModelo | null) => void;
}

/** El respaldo si hay y contesta algo; si no, el error tal cual. */
function sinModelo<Peticion, Respuesta>(
  ruta: PreguntaAlModelo<Peticion, Respuesta>,
  peticion: Peticion,
  fallo: FalloDelModelo,
): Desenlace<Respuesta> {
  const respuesta = ruta.respaldo?.(peticion, fallo) ?? null;
  return respuesta === null ? { kind: 'error', fallo } : { kind: 'respaldo', respuesta, fallo };
}

/**
 * Si el fallo es de los que se pasan solos: la API ha contestado que está
 * saturada (429) o que ha fallado por su lado (5xx). No ha generado nada y no
 * cobra, así que reintentarlo cuesta lo que suponen los cupos.
 */
function esPasajero(fallo: unknown): boolean {
  const estado = (fallo as { status?: unknown } | null)?.status;
  return typeof estado === 'number' && (estado === 429 || estado >= 500);
}

/**
 * Le pregunta al modelo, valida y reintenta una vez.
 *
 * Un reintento y basta. Encadenar más cuesta dinero y tiempo, y quien está delante
 * prefiere un «no ha salido» rápido a treinta segundos de espera.
 *
 * Y el reintento **pide algo distinto**: el número de intento viaja hasta el
 * modelo, que sube la temperatura en el segundo. Sin eso, con el modelo de casa la
 * segunda llamada era la misma pregunta con la misma respuesta.
 */
export async function preguntarAlModelo<Peticion, Respuesta>(
  ruta: PreguntaAlModelo<Peticion, Respuesta>,
  peticion: Peticion,
  opciones: OpcionesDeLaPregunta = {},
): Promise<Desenlace<Respuesta>> {
  const prompt = ruta.prompt(peticion);

  for (let intento = 0; intento < MAX_MODEL_ATTEMPTS; intento += 1) {
    let payload: unknown;
    try {
      payload = await askModel({
        prompt,
        system: ruta.system,
        schema: ruta.schema(peticion),
        maxTokens: ruta.maxTokens,
        sinClave: () => ruta.sinClave(peticion),
        // **Qué intento es, y no es un adorno.** El modelo de casa va a
        // temperatura cero, así que repetir la misma petición daba exactamente la
        // misma respuesta: el reintento era esperar el doble para el mismo «no».
        intento,
        ...(opciones.alUsar === undefined ? {} : { alUsar: opciones.alUsar }),
      });
    } catch (fallo) {
      // Una respuesta cortada por el tope de tokens **no se reintenta**: el
      // prompt y el tope son los mismos, así que la segunda llamada se cortaría
      // por donde se cortó la primera. Y no es «el modelo no contesta»: contestó,
      // y lo que dijo no se puede leer. Una negativa tampoco: diría lo mismo.
      if (fallo instanceof RespuestaTruncada) {
        return sinModelo(ruta, peticion, 'unparseable_response');
      }
      // **Un 429 o un 5xx de la API sí, dentro de los mismos dos intentos.** Era
      // el SDK quien los reintentaba por su cuenta, y esas llamadas no las contaba
      // nadie (adr/0114): ahora el reintento es éste, y cuesta lo que suponen los
      // cupos. Lo demás —sin red, un tiempo agotado, una negativa— no: sobre un
      // proveedor caído, reintentar es gastar dos veces para no servir nada. 502
      // y no 500 si no sale: el que ha fallado es el modelo.
      if (!esPasajero(fallo) || intento + 1 >= MAX_MODEL_ATTEMPTS) {
        return sinModelo(ruta, peticion, 'model_unavailable');
      }
      continue;
    }

    opciones.alIntentar?.(payload);
    const respuesta = ruta.validar(payload, peticion);
    if (respuesta !== null) {
      return { kind: 'modelo', respuesta };
    }
  }

  return sinModelo(ruta, peticion, 'unparseable_response');
}
