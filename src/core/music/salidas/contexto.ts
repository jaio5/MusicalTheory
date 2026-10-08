/**
 * Lo que las salidas saben de tu canción además de sus grados.
 *
 * Hasta aquí una salida se construía con el modo, el tipo de petición y una lista
 * de grados con sus pulsos, y nada más. Un blues en `I7 IV7 V7` llegaba como
 * `I IV V`, un riff de quintas como tríadas, un estribillo como «una idea», y el
 * estilo que tenías elegido en la barra no llegaba: el bVII valía lo mismo en un
 * jazz que en un rock. Sin eso no hay manera de saber si un acorde **encaja**,
 * solo si está permitido.
 *
 * **Todo lo que hay aquí son símbolos**: enumerados, números y alturas relativas a
 * la tónica. Ni audio, que no sale del dispositivo, ni texto libre, que tiene sus
 * dos canales y solo esos (adr/0015).
 *
 * **Y entra entero en la petición.** El menú se construye al escribir el prompt y
 * otra vez al validar la respuesta, y el modelo contesta por número: si el
 * contexto se leyera de otro sitio en una de las dos veces, el número señalaría
 * otra salida.
 */

import type { EspecieDeBloque } from '../chords';
import type { SectionRole } from '../song';
import type { StyleId } from '../styles';

/**
 * Una nota del punteo que suena durante un compás de la canción.
 *
 * Por su altura sobre la tónica y no por su nombre, como el resto del punteo
 * (`melody.ts`): así el contexto no depende de en qué tonalidad se escriba.
 */
export interface NotaDelCompas {
  /** Semitonos sobre la tónica, de 0 a 11. */
  readonly nota: number;
  /** Si cae en un pulso fuerte del compás: es la que más tiene que encajar. */
  readonly fuerte: boolean;
}

/**
 * El contexto de lo que llevas, **compás a compás en el mismo orden** que los
 * grados que se mandan, y lo que vale para toda la canción.
 *
 * Todo es opcional: una petición vieja, o una toma sin nada más que grados,
 * tiene que seguir dando salidas. Lo que falte se juzga sin ello, no se inventa.
 */
export interface ContextoDeSalidas {
  /** El estilo elegido en la barra. Sin él, no se premia ni se castiga ningún idioma. */
  readonly estilo?: StyleId;
  /** Pulsos de un compás de verdad (3 en un vals), para medir frases y ritmo armónico. */
  readonly pulsosPorCompas?: number;
  /** El papel de la parte que se continúa o se retoca: el suyo, no uno elegido aparte. */
  readonly papel?: SectionRole;
  /** La especie de cada compás —séptima, quinta, sus…—; `null` es la tríada del grado. */
  readonly especies?: readonly (EspecieDeBloque | null)[];
  /** Lo que el micro leyó con duda: no se construye encima como si fuera seguro. */
  readonly dudosos?: readonly boolean[];
  /** Las notas del punteo que suenan en cada compás, si hay punteo. */
  readonly melodia?: readonly (readonly NotaDelCompas[])[];
}

export const SIN_CONTEXTO: ContextoDeSalidas = {};
