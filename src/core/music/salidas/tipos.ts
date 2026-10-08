/**
 * Lo que es una salida, para quien la construye, quien la juzga y quien la pide.
 *
 * Aparte de todos ellos porque lo usan todos: el juez nombraba los caminos de
 * quien construye y quien construye guardaba el veredicto del juez, y con los
 * tipos en cada orilla los dos ficheros se importaban mutuamente.
 */
import type { EspecieDeBloque } from '../chords';
import type { DegreeSymbol } from '../progressions';
import type { SectionRole } from '../song';
import type { MoveId } from './movimientos';

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

/** Una parte de la canción que se propone. */
export interface ProposedSection {
  readonly name: string;
  /** Si esta parte es, tal cual, la que tocaste. */
  readonly yours: boolean;
  readonly steps: readonly ProposedStep[];
}

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
 * Y cuesta lo mismo que sin elegir: una llamada.
 */
export type PathKind = 'continuar' | 'retocar';

/**
 * Hacia dónde tira una salida, contado por el dominio.
 *
 * Es lo que deja **elegir con tus directrices** sin que nadie tenga que adivinar:
 * «más triste» no es una regla que el dominio sepa comprobar, pero sí sabe si una
 * salida mete un acorde menor que no estaba. Cada color sale de comparar la
 * salida con lo tuyo, nunca de una etiqueta puesta a mano.
 */
export type Color =
  | 'oscurece'
  | 'aclara'
  | 'tension'
  | 'prestado'
  | 'cierra'
  | 'abierto'
  | 'mas-lento'
  | 'mas-rapido'
  | 'mas-corto'
  | 'cuadra';

/** Un compás de una salida posible, con el movimiento que lo justifica si lo hay. */
export interface PasoPosible extends PathStep {
  readonly move: MoveId | null;
  /**
   * Con qué especie suena —una séptima en un jazz, la del sustituto tritonal—.
   * Ausente o `null` es la tríada del grado; en lo tuyo, la que ya tenía.
   */
  readonly especie?: EspecieDeBloque | null;
}

/** Una parte de una salida posible. */
export interface ParteDeSalida {
  readonly name: string;
  readonly yours: boolean;
  readonly steps: readonly PasoPosible[];
}

/**
 * Una salida que el dominio sabe construir para tu canción, ya montada.
 *
 * **Correcta por construcción**: sale de los mismos movimientos, el mismo grafo y
 * las mismas cadencias que la juzgan, y además se juzga —`songProblem`— antes de
 * entrar en el catálogo. Lo que el modelo pone es el criterio: cuál de estas
 * conviene, con tus directrices delante, y por qué.
 */
export interface SalidaPosible {
  readonly path: PathId;
  /** La canción entera por partes: la tuya delante al continuar, una sola al retocar. */
  readonly secciones: readonly ParteDeSalida[];
  /** Un título que dice lo que es, por si el del modelo no se sostiene. */
  readonly nombre: string;
  /** Lo que hace, en una frase y en grados. Es verdad porque lo escribe quien la construyó. */
  readonly que: string;
  readonly colores: readonly Color[];
  /**
   * Lo que dijo de ella el juez (`juez/`): los puntos que la ordenan y sus
   * motivos, que son hechos de la canción que el porqué puede contar sin
   * inventarse nada. Opcional para que quien monte una a mano no tenga que juzgarla.
   */
  readonly encaje?: Encaje;
}

/** Cuántas salidas posibles se le enseñan al modelo como mucho. */
export const MAX_SALIDAS_POSIBLES = 9;

/**
 * Cuántas tiene que tener el menú como poco, si el dominio sabe construirlas:
 * con menos no hay elección, y elegir es lo que se le pide a quien lo lee. Es
 * también lo que se ve sin desplazar (el `PRIMERAS` del examen).
 */
export const MINIMO_DEL_MENU = 3;

/** Un compás de la canción que se juzga, tal como quedaría. */
export interface PasoJuzgado {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  /** La especie con la que suena; `null` o ausente es la tríada del grado. */
  readonly especie?: EspecieDeBloque | null;
  /** El movimiento que lo justifica, si viene de rearmonizar. */
  readonly move?: MoveId | null;
}

/**
 * Qué es lo que se añade al continuar, según quien lo construyó: **la tuya
 * completada** —el cierre que le falta a tu frase—, **otra parte** —la que dice
 * `PARTE_QUE_SIGUE`— o **la misma otra vez** —una segunda vuelta, otro coro—.
 */
export type LoQueSeAnade = 'tuya' | 'otra' | 'misma';

/** La salida que se juzga: qué camino toma y cómo queda la canción entera. */
export interface CandidataAJuzgar {
  readonly path: PathId;
  readonly cancion: readonly PasoJuzgado[];
  /**
   * Al continuar, qué parte es lo añadido según quien la construyó, que es quien la
   * nombra. Sin él, el juez lo deduce de dónde acaba tu frase.
   */
  readonly loQueSeAnade?: LoQueSeAnade;
  /**
   * El papel de lo añadido según quien lo nombra, si no es el de `PARTE_QUE_SIGUE`:
   * la B de una AABA es un puente aunque lo tuyo sea una estrofa.
   */
  readonly papelNuevo?: SectionRole;
}

/** Lo que mira el juez, uno por criterio musical. */
export type CriterioId =
  | 'sintaxis'
  | 'cadencia'
  | 'frase'
  | 'ritmo-armonico'
  | 'bajo'
  | 'notas-comunes'
  | 'melodia'
  | 'estilo'
  | 'novedad'
  | 'papel'
  | 'forma';

export interface Criterio {
  readonly id: CriterioId;
  /** De -1 (lo estropea) a 1 (es justo lo que pide). 0 es que no dice nada. */
  readonly valor: number;
  /** El hecho que lo justifica, en una frase y en grados. Vacío si no aporta. */
  readonly motivo: string;
}

export interface Encaje {
  /** De 0 a 100: cuánto encaja. Es lo que ordena el menú. */
  readonly puntos: number;
  readonly criterios: readonly Criterio[];
  /**
   * Por qué no debería ofrecerse nunca, si es el caso: una retrogresión en un
   * estilo que no la admite, una frase que queda coja... `null` si puede ir.
   */
  readonly descarte: string | null;
  /**
   * El reparo, si lo hay: lo que la deja por debajo del mínimo sin descartarla —tu
   * tónica del compás 1, tu color, una coda larga—. La red (`salidasPosibles`) mete
   * primero lo que no lo tiene.
   */
  readonly reparo?: string;
}
