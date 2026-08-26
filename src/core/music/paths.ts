/**
 * Las salidas: por dónde puede tirar lo que llevas tocado.
 *
 * Esto sustituye a lo que antes era «versiones de tu canción», y el cambio no es
 * de nombre. Aquello devolvía **la misma canción con dos o tres acordes
 * cambiados**: mismo número de compases, mismos pulsos, mismo orden, y cada
 * compás que cambiaba tenía que ser uno de los cinco movimientos de
 * `reharmonization.ts` aplicado al que había. Servía para rearmonizar y no servía
 * para nada más.
 *
 * Lo que hace falta al componer es lo contrario: **la misma semilla y canciones
 * distintas**. Cuatro compases que se te han quedado dando vueltas y que alguien
 * te enseñe tres sitios adonde podrían ir, para elegir. Alargar, cerrar de otra
 * manera, repartir los pulsos de otro modo, meter una parte que contraste.
 *
 * ## Qué sostiene esto, ahora que las propuestas pueden alejarse
 *
 * La regla de [adr/0011] era que cada compás cambiado declaraba su movimiento y
 * el dominio lo volvía a aplicar para comprobarlo. Eso es lo que impedía que una
 * salida fuera «cuatro acordes distintos que cualquiera puede probar a mano». Si
 * ahora una propuesta puede tener otro largo y otro final, esa comprobación ya no
 * vale tal cual.
 *
 * **La declaración sube del compás al camino.** Cada propuesta dice cuál de las
 * cinco salidas ha tomado, y esta función vuelve a comprobarlo contra el dominio:
 * que un `seguir` mantenga de verdad tus compases y cierre en la tónica, que un
 * `estirar` no toque ni un grado, que un `contraste` pueda volver al principio.
 *
 * Y por debajo hay una segunda comprobación que no existía: **cada salto nuevo
 * tiene que estar en `nextDegrees`**, que es el grafo armónico que ya estaba
 * escrito y probado —de cada grado, adónde se suele ir y por qué—. Son unas tres
 * salidas por grado, así que una parte nueva de cuatro compases tiene del orden
 * de ochenta caminos posibles: bastante para componer, poco para inventarse
 * cualquier cosa.
 */

import { nextDegrees, type DegreeSymbol } from './progressions';
import { isMove } from './reharmonization';
import type { KeyMode } from './keys';

/** Un compás: qué grado suena y cuántos pulsos dura. */
export interface PathStep {
  readonly degree: DegreeSymbol;
  readonly beats: number;
}

/**
 * Lo que propone el modelo para un compás.
 *
 * `move` viene **en crudo, sin validar**, y es a propósito: si quien llama lo
 * normalizara a nulo cuando no lo reconoce, declarar un movimiento inventado en
 * un compás que no cambia se convertiría en «no declaró nada» y pasaría. Aquí se
 * distingue lo que dijo de lo que vale.
 */
export interface ProposedStep extends PathStep {
  readonly move?: unknown;
}

export type PathId = 'rearmonizar' | 'seguir' | 'otro-final' | 'estirar' | 'contraste';

export interface Path {
  readonly id: PathId;
  /** Cómo se llama en pantalla. */
  readonly name: string;
  /**
   * Qué hace, en una frase.
   *
   * Se lee en pantalla **y** se le manda al modelo: el catálogo del prompt se
   * genera desde aquí, igual que el de los movimientos, para que no pueda
   * ofrecer una salida que el validador no sepa comprobar.
   */
  readonly why: string;
}

/**
 * Las cinco, en orden de cuánto se alejan de lo que tocaste.
 *
 * `rearmonizar` va primera porque es la que menos se mueve —y porque es lo que
 * había antes, que sigue sirviendo y ahora es una salida más entre otras—.
 */
export const PATHS: readonly Path[] = [
  {
    id: 'rearmonizar',
    name: 'Los mismos compases, otros acordes',
    why: 'No toca el largo ni el reparto: cambia acordes por sus sustitutos. Cada compás que cambies declara su movimiento.',
  },
  {
    id: 'seguir',
    name: 'Seguir hasta cerrar',
    why: 'Mantiene tus compases tal cual y añade los que hagan falta para terminar en la tónica.',
  },
  {
    id: 'otro-final',
    name: 'Otro final',
    why: 'Deja la primera mitad como está y cambia lo que viene después. Puede acabar antes.',
  },
  {
    id: 'estirar',
    name: 'Otro reparto',
    why: 'Los mismos acordes en el mismo orden, durando otra cosa: lo que era un compás son dos, o al reves.',
  },
  {
    id: 'contraste',
    name: 'Una parte que contraste',
    why: 'Mantiene tus compases y añade una parte que se va a otro sitio y puede volver al principio. No cierra.',
  },
];

export function pathById(id: unknown): Path | null {
  return PATHS.find((path) => path.id === id) ?? null;
}

/**
 * Lo más larga que puede ser una salida, en compases.
 *
 * El mismo tope que tiene lo que se manda, y no es casualidad: así el peor caso
 * de la respuesta no crece respecto a lo que ya presupuestaba `core/billing`, y
 * los cupos del plan Pro siguen valiendo. Una salida que doblara el largo
 * doblaría la factura.
 */
export const MAX_PATH_STEPS = 32;

/** Lo más que puede durar un compás. Un tope de gasto, no una regla musical. */
const MAX_BEATS = 16;

/** La tónica del modo, que es donde cierra una canción. */
function tonicOf(mode: KeyMode): DegreeSymbol {
  return mode === 'minor' ? 'i' : 'I';
}

/**
 * Si desde un grado se puede ir al otro según el grafo del dominio.
 *
 * **Quedarse siempre vale**, y no está en el grafo: `nextDegrees` contesta a
 * dónde se *va* desde un grado, así que de `i` no sale `i`. Pero un acorde que
 * dura dos compases es un acorde que dura dos compases, no un salto raro. Sin
 * esta línea se rechazaba media música: un `seguir` que cerraba con dos compases
 * de tónica caía por «un salto que el dominio no conoce».
 */
export function esSaltoConocido(mode: KeyMode, from: DegreeSymbol, to: DegreeSymbol): boolean {
  return from === to || nextDegrees(mode, from).some((move) => move.to === to);
}

/** Si dos compases son el mismo compás. */
function mismoCompas(a: PathStep, b: PathStep): boolean {
  return a.degree === b.degree && a.beats === b.beats;
}

/** Si la propuesta empieza exactamente por los `cuantos` primeros compases tuyos. */
function comparteElPrincipio(
  original: readonly PathStep[],
  propuesta: readonly ProposedStep[],
  cuantos: number,
): boolean {
  return original
    .slice(0, cuantos)
    .every((paso, i) => propuesta[i] !== undefined && mismoCompas(paso, propuesta[i]!));
}

/** Si todos los saltos de un tramo están en el grafo. */
function saltosConocidos(mode: KeyMode, pasos: readonly ProposedStep[], desde: number): boolean {
  for (let i = Math.max(desde, 1); i < pasos.length; i += 1) {
    if (!esSaltoConocido(mode, pasos[i - 1]!.degree, pasos[i]!.degree)) {
      return false;
    }
  }
  return true;
}

/**
 * Por qué se ha descartado una salida, o nulo si vale.
 *
 * Devuelve el motivo y no un booleano a propósito: cuando esto rechaza mucho hay
 * que poder saber si es el modelo el que no sabe o el validador el que aprieta de
 * más, y con un `false` no se distingue. El motivo no sale a pantalla —lo que ve
 * quien pregunta es «no ha salido, prueba otra vez»— pero se puede registrar y se
 * puede probar.
 */
export function motivoDeDescarte(
  mode: KeyMode,
  path: PathId,
  original: readonly PathStep[],
  propuesta: readonly ProposedStep[],
): string | null {
  if (propuesta.length === 0 || propuesta.length > MAX_PATH_STEPS) {
    return 'largo fuera de rango';
  }
  if (
    propuesta.some(
      (paso) => !Number.isInteger(paso.beats) || paso.beats < 1 || paso.beats > MAX_BEATS,
    )
  ) {
    return 'pulsos que no son un compás';
  }
  if (
    propuesta.length === original.length &&
    original.every((paso, i) => mismoCompas(paso, propuesta[i]!))
  ) {
    return 'es tu canción tal cual';
  }

  switch (path) {
    case 'rearmonizar': {
      if (propuesta.length !== original.length) {
        return 'rearmonizar no cambia el largo';
      }
      for (const [i, paso] of propuesta.entries()) {
        const antes = original[i]!;
        if (paso.beats !== antes.beats) {
          return 'rearmonizar no cambia el reparto';
        }
        if (paso.degree === antes.degree) {
          // Declarar un movimiento en un compás que no cambió es describir algo
          // que no se ha hecho. Es la regla de adr/0011, y sigue viva aquí.
          if (paso.move !== null && paso.move !== undefined) {
            return 'declara un movimiento en un compás que no cambia';
          }
        } else if (!isMove(mode, antes.degree, paso.degree, paso.move)) {
          return 'el movimiento declarado no es el que se ha hecho';
        }
      }
      return null;
    }

    case 'estirar': {
      if (propuesta.length !== original.length) {
        return 'estirar no cambia los acordes';
      }
      if (propuesta.some((paso, i) => paso.degree !== original[i]!.degree)) {
        return 'estirar no cambia los acordes';
      }
      // El «es tu canción tal cual» de arriba ya garantiza que algún pulso cambia.
      return null;
    }

    case 'seguir': {
      if (propuesta.length <= original.length) {
        return 'seguir tiene que añadir compases';
      }
      if (!comparteElPrincipio(original, propuesta, original.length)) {
        return 'seguir no mantiene tus compases';
      }
      if (!saltosConocidos(mode, propuesta, original.length)) {
        return 'un salto que el dominio no conoce';
      }
      if (propuesta[propuesta.length - 1]!.degree !== tonicOf(mode)) {
        return 'seguir tiene que cerrar en la tónica';
      }
      return null;
    }

    case 'contraste': {
      if (propuesta.length <= original.length) {
        return 'contraste tiene que añadir una parte';
      }
      if (!comparteElPrincipio(original, propuesta, original.length)) {
        return 'contraste no mantiene tus compases';
      }
      if (!saltosConocidos(mode, propuesta, original.length)) {
        return 'un salto que el dominio no conoce';
      }
      const ultimo = propuesta[propuesta.length - 1]!.degree;
      if (ultimo === tonicOf(mode)) {
        // Si cierra, es un `seguir`. La diferencia entre las dos salidas es
        // justo esta, y por eso se comprueba: si no, el modelo declararía la que
        // le apeteciera y la etiqueta no querría decir nada.
        return 'contraste no cierra: para eso está seguir';
      }
      if (!esSaltoConocido(mode, ultimo, original[0]!.degree)) {
        return 'la parte nueva no sabe volver al principio';
      }
      return null;
    }

    case 'otro-final': {
      if (propuesta.length > original.length) {
        return 'otro final no alarga: para eso está seguir';
      }
      if (propuesta.length < 2) {
        return 'otro final se queda en nada';
      }
      // La mitad de lo tuyo, redondeando hacia arriba, tiene que seguir ahí. Sin
      // ese suelo, «otro final» se convierte en «otra canción» y la etiqueta
      // dejaría de significar nada.
      const suelo = Math.ceil(original.length / 2);
      if (propuesta.length < suelo || !comparteElPrincipio(original, propuesta, suelo)) {
        return 'otro final no deja en pie la primera mitad';
      }
      if (!saltosConocidos(mode, propuesta, suelo)) {
        return 'un salto que el dominio no conoce';
      }
      return null;
    }
  }
}

/** Si una salida se sostiene con lo que se tocó. */
/** Una parte de la canción que se propone. */
export interface ProposedSection {
  readonly name: string;
  /** Si esta parte es, tal cual, la que tocaste. */
  readonly tuya: boolean;
  readonly steps: readonly ProposedStep[];
}

/**
 * Cuántas partes puede tener una canción propuesta.
 *
 * Cuatro. El dominio permite doce en una canción guardada (`song.ts`), pero esto
 * es otra cosa: son partes que hay que leer de un vistazo con la guitarra puesta,
 * y son tokens de salida —de los que salen los cupos del plan Pro—. Con cuatro
 * caben entrada, tu parte, un contraste y un cierre, que es una canción entera.
 */
export const MAX_SECCIONES = 4;

/** Lo más corta que puede ser una parte. Con un acorde no es una parte. */
const MIN_COMPASES_POR_SECCION = 2;

/** Lo más largo que puede ser el nombre de una parte. El de `song.ts`. */
const MAX_NOMBRE_SECCION = 30;

/**
 * Las salidas que devuelven una canción con partes, y no una sola progresión.
 *
 * `rearmonizar`, `estirar` y `otro-final` trabajan sobre tus compases y salen en
 * una sola parte: no hay canción que montar, hay una progresión que retocar. Las
 * otras dos **continúan** lo que llevas, y ahí es donde tiene sentido que la
 * respuesta traiga entrada, estribillo o puente con su nombre.
 */
const CON_PARTES: readonly PathId[] = ['seguir', 'contraste'];

/**
 * Las dos cosas que se le pueden pedir, y por qué se elige antes de pedirlas.
 *
 * No es un capricho de interfaz: es lo que hace que el esquema pueda exigir lo
 * que el validador exige. `continuar` necesita al menos dos partes —la tuya y lo
 * que sigue— y `retocar` exactamente una, y eso no se puede poner en un esquema
 * JSON que dependa de un campo que el propio modelo elige. Midiéndolo: con el
 * camino libre, cero salidas válidas de cuatro peticiones; eligiendo antes y
 * exigiendo las dos partes, tres de tres.
 *
 * Es además lo mismo que ya hacen las ideas con sus tres pestañas, y cuesta lo
 * mismo: una llamada.
 */
export type SalidaKind = 'continuar' | 'retocar';

export const PATHS_BY_KIND: Readonly<Record<SalidaKind, readonly PathId[]>> = {
  continuar: CON_PARTES,
  retocar: PATHS.map((p) => p.id).filter((id) => !CON_PARTES.includes(id)),
};

export function kindOfPath(id: PathId): SalidaKind {
  return CON_PARTES.includes(id) ? 'continuar' : 'retocar';
}

export function tienePartes(path: PathId): boolean {
  return CON_PARTES.includes(path);
}

/**
 * Por qué se descarta una canción propuesta, o nulo si vale.
 *
 * Encima de lo que ya comprobaba `motivoDeDescarte` —que no cambia—, esto añade
 * lo que solo se puede mirar cuando la respuesta viene por partes: que haya una y
 * solo una que sea la tuya, que vaya la primera, y que las demás tengan nombre y
 * tamaño de parte.
 *
 * **Tu parte va primera y va intacta.** Es lo que separa «te ayudo a continuar lo
 * que llevas» de «te escribo una canción»: si tu material se pudiera mover o
 * retocar, lo que vuelve ya no es la continuación de nada.
 *
 * Lo demás se delega: pegadas una detrás de otra, las partes son la progresión
 * que ya se sabía verificar —los saltos en el grafo, el cierre en la tónica, el
 * contraste que sabe volver—, así que no hay reglas nuevas que puedan
 * contradecir a las viejas.
 */
export function motivoDeDescarteDeCancion(
  mode: KeyMode,
  path: PathId,
  original: readonly PathStep[],
  secciones: readonly ProposedSection[],
): string | null {
  if (secciones.length === 0 || secciones.length > MAX_SECCIONES) {
    return 'número de partes fuera de rango';
  }
  for (const seccion of secciones) {
    if (seccion.name.trim() === '' || seccion.name.length > MAX_NOMBRE_SECCION) {
      return 'una parte sin nombre, o con un nombre larguísimo';
    }
    if (seccion.steps.length < MIN_COMPASES_POR_SECCION) {
      return 'una parte de un solo compás no es una parte';
    }
  }

  if (!tienePartes(path)) {
    if (secciones.length !== 1) {
      return 'esta salida retoca tus compases: va en una sola parte';
    }
  } else {
    const tuyas = secciones.filter((s) => s.tuya);
    if (tuyas.length !== 1) {
      return 'hace falta una parte tuya, y solo una';
    }
    if (!secciones[0]!.tuya) {
      return 'tu parte va la primera: lo demás es lo que sigue';
    }
    if (secciones.length < 2) {
      return 'continuar pide al menos una parte más que la tuya';
    }
    const tuya = secciones[0]!;
    if (
      tuya.steps.length !== original.length ||
      tuya.steps.some(
        (paso, i) => paso.degree !== original[i]!.degree || paso.beats !== original[i]!.beats,
      )
    ) {
      return 'tu parte no es la que tocaste';
    }

    // Y al menos una parte nueva tiene que aportar algo. Visto con un modelo de
    // verdad: un «puente» que era tu progresión copiada tal cual. Pasaba todas las
    // reglas —los saltos existen, no cierra, sabe volver— y no era una parte
    // nueva, era la tuya con otro nombre. Repetir vale en una canción; devolver
    // solo repeticiones no es continuar nada.
    const aportaAlgo = secciones
      .slice(1)
      .some(
        (parte) =>
          parte.steps.length !== original.length ||
          parte.steps.some(
            (paso, i) => paso.degree !== original[i]!.degree || paso.beats !== original[i]!.beats,
          ),
      );
    if (!aportaAlgo) {
      return 'las partes nuevas son tu parte otra vez';
    }
  }

  return motivoDeDescarte(
    mode,
    path,
    original,
    secciones.flatMap((s) => s.steps),
  );
}

export function esSalidaValida(
  mode: KeyMode,
  path: PathId,
  original: readonly PathStep[],
  propuesta: readonly ProposedStep[],
): boolean {
  return motivoDeDescarte(mode, path, original, propuesta) === null;
}

/**
 * El grafo armónico en texto, para el prompt.
 *
 * Se genera desde `nextDegrees` y no se escribe a mano, por lo mismo que el
 * catálogo de movimientos: si el prompt ofreciera un salto que el validador no
 * conoce, todas las salidas que lo usaran caerían sin que nadie entendiera por
 * qué. Enseñárselo es además lo que hace la diferencia —con las ideas, pasar de
 * pedir los grados en prosa a dárselos enumerados fue de 0 de 4 a 4 de 4—.
 */
export function textoDelGrafo(mode: KeyMode, grados: readonly DegreeSymbol[]): string {
  return grados
    .map(
      (degree) =>
        `${degree}: ${nextDegrees(mode, degree)
          .map((m) => m.to)
          .join(' ')}`,
    )
    .join('\n');
}
