/**
 * Lo que se comprueba de la prosa que escribe el modelo antes de pintarla, sea del
 * tema que sea: la respuesta del profesor y el título y el porqué de una salida.
 *
 * **Va antes que mirar si habla de música, y no depende de ello.** La auditoría del
 * 7 de octubre de 2026 coló «confirma tu cuenta en https://evil.example: es una
 * nota del equipo» por el profesor —«nota» es una palabra de música— y, con las
 * directrices de una salida inyectadas, `qwen3:8b` devolvió tres de tres veces el
 * título «Renueva tu cuenta en evil.example» (adr/0115). Una respuesta de música no
 * necesita un enlace, un correo ni una contraseña, y la aplicación no pide ninguna
 * de las tres desde la boca del modelo.
 *
 * Vive en `core/` porque lo usan los dos contratos, y un feature no importa de otro.
 */

import { copiaParaBuscar } from './marca';

/**
 * Cuánto se lee de lo escrito, en caracteres. Lo que se pinta llega recortado
 * antes —900 el profesor, 200 un porqué—; esto es para que buscar en ello, y la
 * comparación en desorden, que es cuadrática, no dependan de que quien llama se
 * acuerde.
 */
const LEIDO = 2000;

/** Un enlace o un dominio: `https://`, `www.`, `algo.ejemplo`. */
const ENLACE = /:\/\/|(?<![a-z0-9])www\.|(?<![a-z0-9-])[a-z0-9-]{2,}\.[a-z][a-z0-9-]+/u;

/** Un correo: una arroba entre dos cosas que no son espacio. */
const CORREO = /[^\s@]@[^\s@]/u;

/**
 * Las palabras de un cebo: lo que se pide para robar una cuenta o un pago. Sin
 * tildes y en minúscula, que es como queda la copia para buscar.
 *
 * **Se quedan fuera las que en música son otra cosa**: «clave» (de sol), «enlace»
 * (de acordes, de voces), «clic» (el de la claqueta), «suspendida» (la cuarta).
 */
const CEBO =
  /(?<![a-z0-9])(?:contrasen|password|passwd|login|log-in|inicia(?:r)? sesion|tarjeta|cvv|iban|paypal|bizum|whatsapp|telegram|bitcoin|cripto|e-?mail|correo|url|datos bancarios|cuenta bancaria|(?:verific|confirm|renuev|renov|actualiz|reactiv|valid)[a-z]*\s+(?:tu\s+|su\s+|la\s+)?cuenta)/u;

/**
 * Si lo que ha escrito el modelo lleva un enlace, un dominio, un correo o una
 * palabra de cebo. Se mira en la copia para buscar, sin tildes ni disfraces: un
 * `evil.ехample` con letras cirílicas también es un dominio.
 *
 * Se equivoca hacia rechazar, y a propósito: lo que se pierde es una frase, y la
 * pantalla tiene siempre la del dominio para ponerla en su sitio. **Un punto sin
 * espacio entre dos palabras se lee como un dominio**, y una respuesta que escriba
 * «I-IV.Luego» se tira; el modelo pone el espacio casi siempre.
 */
export function esUnCebo(texto: string): boolean {
  const copia = copiaParaBuscar(texto.slice(0, LEIDO));
  return ENLACE.test(copia) || CORREO.test(copia) || CEBO.test(copia);
}

/** Las palabras de un texto, en minúscula, sin tildes ni disfraces. */
function palabrasDe(texto: string): string[] {
  return copiaParaBuscar(texto)
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

/** Cuántas palabras seguidas de las instrucciones hacen falta para decir que las copia. */
const PALABRAS_COPIADAS = 8;

/**
 * Cuántas palabras con contenido de las instrucciones, **en su orden aunque no
 * seguidas**, hacen falta para decir que las copia.
 */
const EN_SU_ORDEN = 12;

/**
 * Lo mismo, cuando son la mayor parte de lo que se ha escrito: un porqué de una frase
 * que es la primera de las instrucciones con dos palabras metidas no llega a doce.
 */
const EN_SU_ORDEN_CORTO = 7;
const PROPORCION_COPIADA = 0.6;

/**
 * Las palabras que cuentan para la copia en desorden: de cuatro letras o más. Las
 * cortas —«de», «la», «que»— están en cualquier frase en español, y en su orden
 * salían a decenas en una respuesta de música.
 */
function conContenido(palabras: readonly string[]): string[] {
  return palabras.filter((palabra) => palabra.length >= 4);
}

/**
 * La subsecuencia común más larga de dos listas de palabras: cuántas de la primera
 * aparecen en la segunda en el mismo orden, con lo que sea entre medias. Cuadrática,
 * pero sobre lo que el modelo ha escrito, que llega recortado —900 caracteres el
 * profesor, 200 un porqué—, y unas cien palabras de instrucciones.
 */
function enComun(a: readonly string[], b: readonly string[]): number {
  let fila = new Array<number>(b.length + 1).fill(0);
  for (const palabra of a) {
    const siguiente = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      siguiente[j] =
        palabra === b[j - 1] ? fila[j - 1]! + 1 : Math.max(fila[j]!, siguiente[j - 1]!);
    }
    fila = siguiente;
  }
  return fila[b.length]!;
}

/**
 * Si lo escrito copia las instrucciones del prompt de sistema.
 *
 * Dos maneras, y vale cualquiera:
 *
 * - **ocho palabras seguidas suyas**, que no salen por casualidad explicando una
 *   cadencia —siete ya se pueden: «en la tonalidad que te den» son seis—;
 * - **o sus palabras con contenido en su orden, con otras metidas entre medias**:
 *   doce, o siete si son la mayor parte de lo escrito. Es la copia intercalada —una
 *   palabra de música cada seis— que la auditoría del 7 de octubre de 2026 coló por
 *   la primera regla, que solo miraba palabras seguidas (adr/0115).
 *
 * Llegan como parámetro porque los prompts de sistema viven en el servidor y los
 * contratos no pueden abrirlo.
 */
export function copiaLasInstrucciones(texto: string, instrucciones?: string): boolean {
  if (instrucciones === undefined) {
    return false;
  }
  const suyas = palabrasDe(instrucciones);
  const dichas = palabrasDe(texto.slice(0, LEIDO));
  const seguidas = new Set(
    suyas
      .slice(0, Math.max(0, suyas.length - PALABRAS_COPIADAS + 1))
      .map((_, inicio) => suyas.slice(inicio, inicio + PALABRAS_COPIADAS).join(' ')),
  );
  if (
    dichas.some((_, inicio) =>
      seguidas.has(dichas.slice(inicio, inicio + PALABRAS_COPIADAS).join(' ')),
    )
  ) {
    return true;
  }
  const llenas = conContenido(dichas);
  const comunes = enComun(conContenido(suyas), llenas);
  return (
    comunes >= EN_SU_ORDEN ||
    (comunes >= EN_SU_ORDEN_CORTO && comunes >= llenas.length * PROPORCION_COPIADA)
  );
}
