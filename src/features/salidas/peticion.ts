/**
 * Lo que se pide al pedir salidas: la forma de la petición y nada más.
 *
 * Aparte del contrato porque la leen el menú y el contrato, y el contrato usa el
 * menú para validar: con la forma dentro del contrato, el menú y él se importaban
 * el uno al otro (adr/0124).
 */

import type {
  DegreeSymbol,
  EspecieDeBloque,
  KeyMode,
  NotaDelCompas,
  NoteName,
  PathKind,
  SectionRole,
  StyleId,
} from '@core/music';

/** Un compás de la progresión que se manda: el grado y lo que dura. */
export interface SalidaStep {
  readonly degree: DegreeSymbol;
  /** Pulsos. Se manda para que la salida respete la forma de la canción. */
  readonly beats: number;
  /**
   * Si ese compás lo leyó el micro y nadie lo ha confirmado.
   *
   * Va porque **no todos los compases valen lo mismo**: uno escrito a mano es lo
   * que alguien quiso poner, y uno oído es la lectura de un croma en una
   * habitación, que puede estar mal —el motor lo dice, con su margen y sus
   * alternativas—. Sin esta marca los dos llegaban iguales al modelo.
   *
   * Ausente cuando se escribió o se confirmó, que es lo normal: solo se manda lo
   * que hay que decir.
   */
  readonly heard?: boolean;
  /**
   * Con qué especie suena: una séptima, una quinta, una suspendida…
   *
   * Sin ella un blues en `I7 IV7 V7` llegaba como `I IV V` y un riff de quintas
   * como tríadas, y la salida volvía con tríadas encima de lo tuyo. Ausente es la
   * tríada del grado, como en un bloque (`Block.especie`).
   */
  readonly especie?: EspecieDeBloque;
  /**
   * Las notas del punteo que suenan durante este compás, cada una una vez.
   *
   * **Van con su compás y no en una lista aparte**: dos listas que hay que tener
   * alineadas son dos maneras de desalinearlas, que es lo mismo que decidió la
   * especie de un bloque. Ausente cuando no hay punteo encima.
   */
  readonly notas?: readonly NotaDelCompas[];
}

/**
 * Cuántas notas del punteo viajan por compás, como mucho.
 *
 * Doce, porque son las doce alturas: cada nota va una vez con su marca de pulso
 * fuerte, y una que suena dos veces no dice nada nuevo sobre si el acorde encaja.
 */
export const MAX_NOTAS_POR_COMPAS = 12;

export interface SalidasRequest {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly progression: readonly SalidaStep[];
  /**
   * Qué se le pide: continuar la canción o retocar estos compases.
   *
   * Se elige antes de pedirlo y no lo decide el modelo, y el motivo es técnico
   * antes que de interfaz: continuar exige al menos dos partes y retocar
   * exactamente una, y un esquema JSON no puede condicionar eso a un campo que el
   * propio modelo rellena. Eligiéndolo antes, el esquema exige lo que el
   * validador comprueba —que es la regla que ya costó una vez, con la función de
   * ideas, ya retirada—.
   */
  readonly kind: PathKind;
  /**
   * Lo que le pides con tus palabras: «que suene a rock lento», «un punteo en el
   * estribillo».
   *
   * Opcional, y ausente cuando no escribes nada: un campo vacío en el prompt es
   * una línea que el modelo tiene que interpretar, y lo que interpreta es que le
   * falta algo.
   */
  readonly directrices?: string;
  /**
   * Qué es lo que le mandas: el estribillo, una estrofa, o solo una idea.
   *
   * Es la diferencia entre pedirle «continúa esto» y pedirle «continúa **el
   * estribillo**», y no es la misma petición: un estribillo tiene que levantar y
   * cerrar, una estrofa tiene que poder repetirse con otra letra, y un puente
   * tiene que irse a otro sitio. Sin esto el modelo solo puede adivinar, y
   * adivina lo mismo siempre.
   *
   * Ausente quiere decir `idea`, que es la respuesta honesta cuando todavía no
   * se ha decidido. **Y `idea` también se le dice**, no se calla: saber que esto
   * aún no tiene sitio en ninguna canción es información, y es la que le permite
   * proponer sitios distintos en vez de continuar por lo obvio.
   *
   * **Es el de la parte que se manda**, no uno elegido aparte: el panel lo lee de
   * la parte y lo escribe en ella (`setPartRole`).
   */
  readonly role?: SectionRole;
  /**
   * El estilo de la barra. Sin él, el bVII valía lo mismo en un jazz que en un
   * rock. Uno que no se reconoce no viaja.
   */
  readonly estilo?: StyleId;
  /** Pulsos de un compás de verdad (3 en un vals). Solo los de `BEATS_PER_BAR`. */
  readonly pulsosPorCompas?: number;
}
