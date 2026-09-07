/**
 * Ejercicios de oído: suena algo y hay que decir qué era.
 *
 * El camino de aprender tenía dos maneras de preguntar y le faltaba la tercera.
 * `theory` se contesta leyendo —«¿cuál es el V grado de Sol?»— y `play` se
 * contesta con la guitarra. Las dos dan por hecho que ya sabes lo que suena.
 *
 * **Reconocer de oído es lo que convierte la teoría en algo que sirve tocando**,
 * y es lo que hace falta para lo que esta aplicación hace de verdad: si el motor
 * de croma dice «Am» y no sabes si suena a Am, no puedes corregirlo cuando se
 * equivoca. La otra mitad de escuchar es saber escuchar.
 *
 * ## Lo que se pregunta, y por qué esto y no notas sueltas
 *
 * El entrenamiento auditivo de manual es «esta nota, ¿cuál es?». Aquí se
 * pregunta por **acordes, grados y cadencias**, que es de lo que va esta
 * aplicación: no se compone con notas sueltas, se compone con lo que hace cada
 * acorde dentro de una tonalidad.
 *
 * Los tres tipos suben en dificultad y cada uno se apoya en el anterior:
 *
 * - `quality` —alegre o triste— es lo primero que oye cualquiera sin haber
 *   estudiado nada, y es lo que ancla el resto.
 * - `degree` pide **la tónica de referencia sonando antes**: un acorde suelto no
 *   tiene grado, lo tiene dentro de una tonalidad, y por eso siempre suena el I
 *   primero. Sin esa referencia la pregunta no tiene respuesta.
 * - `cadence` es lo último porque no se oye un acorde sino **qué pasa entre
 *   dos**, que es lo que hace que una frase suene terminada o colgada.
 *
 * ## Sin azar
 *
 * Los ejercicios salen fijos de la tonalidad, igual que los de `lessons.ts`. Aquí
 * no hay reloj ni sorteo: el mismo tono da los mismos ejercicios, y eso es lo que
 * permite probarlos comparando estructuras.
 */

import type { Choice } from './lessons';
import type { KeyMode } from './keys';
import type { PitchClass } from './notes';
import { resolveDegree, type DegreeSymbol } from './progressions';

/** De qué va una unidad de oído. */
export type EarKind = 'quality' | 'degree' | 'cadence';

export interface EarExercise {
  /**
   * Lo que suena, en grados y en orden.
   *
   * En grados y no en cifrados por lo mismo que el resto del proyecto: cambiar
   * de tonalidad cambia lo que suena sin tocar el ejercicio, y quien practica en
   * Mi bemol oye sus acordes.
   */
  readonly degrees: readonly DegreeSymbol[];
  /** Pulsos que dura cada acorde. */
  readonly beats: number;
  /**
   * Cuántos acordes del principio son la referencia, no la pregunta.
   *
   * Un acorde suelto no tiene grado: lo tiene dentro de una tonalidad. Estos
   * suenan igual pero se enseñan en pantalla, porque la pregunta es sobre lo que
   * viene después.
   */
  readonly reference: number;
  readonly prompt: string;
  readonly choices: readonly Choice[];
  /** Por qué la buena es la buena. Se enseña después de contestar. */
  readonly why: string;
}

function opciones(buena: string, otras: readonly string[]): Choice[] {
  return [{ text: buena, correct: true }, ...otras.map((text) => ({ text, correct: false }))];
}

/** El cifrado de un grado en esta tonalidad, que es lo que se enseña al contestar. */
function cifrado(tonic: PitchClass, mode: KeyMode, degree: DegreeSymbol): string {
  return resolveDegree(tonic, mode, degree).symbol;
}

/**
 * Alegre o triste: la especie del acorde.
 *
 * Es lo primero que oye cualquiera sin haber estudiado nada, y por eso abre. Se
 * usan los tres grados que más suenan de una tonalidad y su relativo, para que
 * la diferencia sea la especie y no el registro.
 */
function quality(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const mayores: DegreeSymbol[] = mode === 'major' ? ['I', 'IV', 'V'] : ['III', 'VI', 'VII'];
  const menores: DegreeSymbol[] = mode === 'major' ? ['vi', 'ii', 'iii'] : ['i', 'iv', 'v'];

  return [
    {
      degrees: [mayores[0]!],
      beats: 4,
      reference: 0,
      prompt: '¿Suena alegre o triste?',
      choices: opciones('Alegre', ['Triste']),
      why: `Es ${cifrado(tonic, mode, mayores[0]!)}, un acorde mayor: la tercera está a dos tonos de la fundamental y eso es lo que se oye abierto.`,
    },
    {
      degrees: [menores[0]!],
      beats: 4,
      reference: 0,
      prompt: '¿Y este?',
      choices: opciones('Triste', ['Alegre']),
      why: `Es ${cifrado(tonic, mode, menores[0]!)}, menor: la misma fundamental y la misma quinta, con la tercera medio tono más abajo. Ese medio tono es toda la diferencia.`,
    },
    {
      degrees: [menores[1]!],
      beats: 4,
      reference: 0,
      prompt: 'Uno más. ¿Mayor o menor?',
      choices: opciones('Menor', ['Mayor']),
      why: `${cifrado(tonic, mode, menores[1]!)} es menor. Con estos dos sonidos en la cabeza ya se puede clasificar cualquier acorde de tres notas.`,
    },
  ];
}

/**
 * Qué grado ha sonado, con la tónica delante.
 *
 * Los tres tonales primero —I, IV y V—, que son los que sostienen una canción
 * entera, y el relativo menor después. Es el mismo orden en el que los enseña
 * `teachingRank`, y por la misma razón.
 */
function degree(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const casa: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const quinto: DegreeSymbol = 'V';
  const relativo: DegreeSymbol = mode === 'major' ? 'vi' : 'VI';

  const nombres = (...grados: DegreeSymbol[]) =>
    grados.map((grado) => `${cifrado(tonic, mode, grado)} (${grado})`);

  return [
    {
      degrees: [casa, quinto],
      beats: 3,
      reference: 1,
      prompt: 'Suena la casa y luego otro. ¿Cuál es el segundo?',
      choices: opciones(nombres(quinto)[0]!, nombres(cuarto, relativo)),
      why: 'El V es el que tira de vuelta a casa: se oye que no ha terminado, que pide seguir.',
    },
    {
      degrees: [casa, cuarto],
      beats: 3,
      reference: 1,
      prompt: '¿Y ahora?',
      choices: opciones(nombres(cuarto)[0]!, nombres(quinto, relativo)),
      why: 'El IV se aleja de casa sin tensión. No pide resolver como el V: solo se ha ido.',
    },
    {
      degrees: [casa, relativo],
      beats: 3,
      reference: 1,
      prompt: 'Este cambia de ánimo. ¿Cuál es?',
      choices: opciones(nombres(relativo)[0]!, nombres(cuarto, quinto)),
      why: `${cifrado(tonic, mode, relativo)} comparte dos notas con la casa y suena al mismo sitio con otra luz. Por eso es el relativo.`,
    },
  ];
}

/**
 * Si la frase cierra o se queda colgada.
 *
 * Aquí no se oye un acorde sino **qué pasa entre dos**, que es lo que hace que
 * una frase suene terminada. Es lo último de los tres porque necesita las dos
 * cosas anteriores: saber qué grado suena y qué hace cada uno.
 */
function cadence(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const casa: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const quinto: DegreeSymbol = 'V';

  return [
    {
      degrees: [casa, cuarto, quinto, casa],
      beats: 2,
      reference: 0,
      prompt: '¿Termina o se queda a medias?',
      choices: opciones('Termina', ['Se queda a medias']),
      why: `Acaba en ${cifrado(tonic, mode, casa)} viniendo del V: es la cadencia de toda la vida, y por eso suena a punto final.`,
    },
    {
      degrees: [casa, cuarto, casa, quinto],
      beats: 2,
      reference: 0,
      prompt: '¿Y esta?',
      choices: opciones('Se queda a medias', ['Termina']),
      why: `Acaba en ${cifrado(tonic, mode, quinto)}, que es tensión. Queda colgada a propósito: es lo que se hace al final de una estrofa para que la siguiente entre.`,
    },
    {
      degrees: [casa, quinto, cuarto, casa],
      beats: 2,
      reference: 0,
      prompt: 'Esta también cierra, pero de otra manera. ¿Con cuál?',
      choices: opciones(`Con el IV, ${cifrado(tonic, mode, cuarto)}`, [
        `Con el V, ${cifrado(tonic, mode, quinto)}`,
      ]),
      why: 'Es la cadencia plagal, el «amén». Cierra sin la tensión del V: suena a descanso, no a resolución.',
    },
  ];
}

/** Los ejercicios de oído de esa clase, en esa tonalidad. */
export function earExercises(kind: EarKind, tonic: PitchClass, mode: KeyMode): EarExercise[] {
  if (kind === 'quality') {
    return quality(tonic, mode);
  }
  return kind === 'degree' ? degree(tonic, mode) : cadence(tonic, mode);
}

/** De qué va cada clase, para el rótulo de la unidad. */
export const EAR_KINDS: Readonly<Record<EarKind, { name: string; lead: string }>> = {
  quality: {
    name: 'Alegre o triste',
    lead: 'Un acorde suena. Di si es mayor o menor: es lo primero que se oye sin saber nada.',
  },
  degree: {
    name: 'Qué grado ha sonado',
    lead: 'Primero la casa, luego otro acorde. Di cuál era, con la tónica todavía en el oído.',
  },
  cadence: {
    name: 'Si cierra o se queda colgada',
    lead: 'Cuatro acordes. Lo que se oye no es uno: es qué pasa entre el penúltimo y el último.',
  },
};
