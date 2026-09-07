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
export type EarKind = 'quality' | 'degree' | 'cadence' | 'sevenths' | 'borrowed' | 'modes';

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

/**
 * Qué añade la séptima, y qué cambia según la especie.
 *
 * La tríada suena antes en cada pregunta, y no es adorno: lo que hay que oír no
 * es el acorde entero sino **la nota que se le ha añadido**. Sin la tríada
 * delante habría que reconocer dos cosas a la vez, y esta unidad va de una.
 */
function sevenths(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cinco: DegreeSymbol = 'V';

  return [
    {
      degrees: [uno, uno],
      beats: 3,
      reference: 1,
      prompt: 'El mismo acorde, y luego con una nota más. ¿Cómo suena la de más?',
      choices: opciones('Suave, casi dulce', ['Áspera, pide resolver']),
      why: `Es la séptima mayor: ${cifrado(tonic, mode, uno)}maj7. Está a medio tono de la fundamental y roza sin empujar. De ahí que suene a calma y no a tensión.`,
    },
    {
      degrees: [cinco, cinco],
      beats: 3,
      reference: 1,
      prompt: '¿Y esta otra?',
      choices: opciones('Áspera, pide resolver', ['Suave, casi dulce']),
      why: `Es la séptima menor sobre el V: ${cifrado(tonic, mode, cinco)}7. Con la sensible dentro forma un tritono, y eso es lo que empuja hacia la tónica.`,
    },
    {
      degrees: [uno, cinco],
      beats: 3,
      reference: 0,
      prompt: 'De estos dos, ¿cuál pide seguir?',
      choices: opciones('El segundo', ['El primero', 'Ninguno de los dos']),
      why: 'La séptima del V es la que tensa. La misma nota añadida cambia de papel según sobre qué grado caiga: no es la séptima, es dónde está.',
    },
  ];
}

/**
 * Reconocer un acorde que no es de la tonalidad.
 *
 * Con la casa delante, como los grados: un préstamo solo suena a préstamo si hay
 * un sitio del que salirse. La pregunta no es cuál es, sino **si pertenece**, que
 * es lo primero que hay que oír y lo que avisa de que la tonalidad detectada
 * puede estar mal.
 */
function borrowed(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuatro: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const prestado: DegreeSymbol = mode === 'major' ? 'bVII' : 'VII';
  const oscuro: DegreeSymbol = mode === 'major' ? 'bVI' : 'VI';

  return [
    {
      degrees: [uno, cuatro],
      beats: 3,
      reference: 1,
      prompt: '¿El segundo es de la tonalidad o viene de fuera?',
      choices: opciones('De la tonalidad', ['De fuera']),
      why: `${cifrado(tonic, mode, cuatro)} es el IV, uno de los siete de casa. No hay ninguna nota que no estuviera ya.`,
    },
    {
      degrees: [uno, prestado],
      beats: 3,
      reference: 1,
      prompt: '¿Y este?',
      choices: opciones('De fuera', ['De la tonalidad']),
      why: `${cifrado(tonic, mode, prestado)} trae una nota que no está en la escala. Suena a riff justo por eso: se sale y vuelve.`,
    },
    {
      degrees: [uno, oscuro],
      beats: 3,
      reference: 1,
      prompt: 'Este también se sale. ¿Aclara o oscurece?',
      choices: opciones('Oscurece', ['Aclara']),
      why: `${cifrado(tonic, mode, oscuro)} viene del modo menor. Baja media escala de golpe y por eso ensombrece sin cambiar de centro.`,
    },
  ];
}

/**
 * Distinguir dos modos por lo que los separa.
 *
 * Se comparan sobre la misma tónica y no en abstracto: dos modos se parecen
 * mucho, y lo que los distingue es **una nota**. Se oye el acorde que la lleva.
 */
function modes(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const quinto: DegreeSymbol = 'V';
  const prestado: DegreeSymbol = mode === 'major' ? 'bVII' : 'VII';
  const cuatro: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';

  return [
    {
      degrees: [uno, quinto, uno],
      beats: 2,
      reference: 0,
      prompt: '¿El de en medio tiene sensible, esa nota que empuja al final?',
      choices: opciones('Sí', ['No']),
      why: `Con el V mayor hay sensible, y eso es lo que hace que el cierre suene clásico. Es lo que distingue el modo jónico de los demás.`,
    },
    {
      degrees: [uno, prestado, uno],
      beats: 2,
      reference: 0,
      prompt: 'Aquí en medio hay otro. ¿Empuja igual?',
      choices: opciones('No, llega más plano', ['Sí, igual de fuerte']),
      why: `${cifrado(tonic, mode, prestado)} está un tono entero por debajo, no medio: no hay sensible. Es el sonido del mixolidio, y de medio repertorio de rock.`,
    },
    {
      degrees: [uno, cuatro, uno],
      beats: 2,
      reference: 0,
      prompt: 'Y este, ¿suena más brillante o más apagado que el anterior?',
      choices: opciones('Más apagado', ['Más brillante']),
      why: 'El cuarto grado no tensa: aleja. Sin sensible y sin tritono, el cierre llega por descanso y no por resolución.',
    },
  ];
}

/** Los ejercicios de oído de esa clase, en esa tonalidad. */
export function earExercises(kind: EarKind, tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const catalogo: Readonly<Record<EarKind, (t: PitchClass, m: KeyMode) => EarExercise[]>> = {
    quality,
    degree,
    cadence,
    sevenths,
    borrowed,
    modes,
  };
  return catalogo[kind](tonic, mode);
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
  sevenths: {
    name: 'Qué añade la séptima',
    lead: 'Primero la tríada y luego la misma con una nota más. Lo que hay que oír es la de más.',
  },
  borrowed: {
    name: 'Si el acorde es de casa o viene de fuera',
    lead: 'La casa y luego otro acorde. Di si pertenece a la tonalidad o se ha traído de otro sitio.',
  },
  modes: {
    name: 'Con sensible y sin ella',
    lead: 'Tres acordes que vuelven a casa por caminos distintos. Lo que cambia es una sola nota.',
  },
};
