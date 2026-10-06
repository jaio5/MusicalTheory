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
 * ## Lo que se pregunta, y por qué casi nunca notas sueltas
 *
 * El entrenamiento auditivo de manual es «esta nota, ¿cuál es?». Aquí se
 * pregunta sobre todo por **acordes, grados y cadencias**, que es de lo que va
 * esta aplicación: no se compone con notas sueltas, se compone con lo que hace
 * cada acorde dentro de una tonalidad.
 *
 * **La excepción son los intervalos**, y es a propósito: en el conservatorio el
 * oído empieza por ellos, porque un acorde son intervalos apilados y sin oír una
 * tercera mayor no se oye por qué un acorde es mayor. Es la única clase que hace
 * sonar notas sueltas (`EarNotes`).
 *
 * Los tipos suben en dificultad y cada uno se apoya en el anterior:
 *
 * - `interval` —dos notas y la distancia entre ellas— es el ladrillo de todo lo
 *   demás.
 * - `quality` —mayor, menor o disminuido— es lo primero que oye cualquiera sin
 *   haber estudiado nada, y es lo que ancla el resto.
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
 *
 * **Y las opciones salen repartidas**, con la misma baraja sin azar que las
 * lecciones (`baraja.ts`). Se escriben con la buena delante y nadie las movía, así
 * que una unidad de oído se aprobaba entera pulsando la primera sin escuchar.
 */

import { grafiaDeLaFundamental, seventhNotes, seventhSymbol, type SeventhQuality } from './chords';
import { HARMONIC_ROLES } from './harmonic-function';
import { repartidasEnLaUnidad } from './baraja';
import type { Choice } from './lessons';
import type { KeyMode } from './keys';
import { normalizePitchClass, type PitchClass } from './notes';
import { scheduleEvents, voiceForPlayback, type ScheduledStep } from './playback';
import { resolveDegree, type DegreeSymbol } from './progressions';
import { SCALES } from './scales';
import { keyDegree, keyTonic, spellAt, spelledName } from './spelling';

/** De qué va una unidad de oído. */
export type EarKind =
  | 'interval'
  | 'quality'
  | 'degree'
  | 'circle'
  | 'functions'
  | 'cadence'
  | 'sevenths'
  | 'substitutions'
  | 'borrowed'
  | 'modes';

/**
 * Un acorde de un ejercicio: un grado, y con qué especie suena.
 *
 * Casi siempre es el grado a secas y suena como tríada, que es lo que hay que
 * oír. **Cuando la pregunta va sobre la séptima, el grado a secas no vale**: la
 * unidad de cuatríadas decía «el mismo acorde, y luego con una nota más» y
 * `resolveDegree` devuelve tríadas, así que sonaba dos veces lo mismo y la nota
 * por la que preguntaba no llegaba a oírse nunca. Se contestaba razonando el
 * enunciado, que es justo lo contrario de un ejercicio de oído.
 *
 * La especie va escrita en el ejercicio y no deducida de la tonalidad a propósito:
 * quien escribe la pregunta es quien sabe qué quiere que suene, y en menor la
 * dominante no es el quinto grado de la escala sino la del menor armónico.
 */
export interface EarChord {
  readonly degree: DegreeSymbol;
  readonly especie: SeventhQuality;
}

/**
 * Notas sueltas, por su grado en la escala de la tonalidad: 1 es la tónica, 3 la
 * mediante y 8 la tónica una octava más arriba. Si hay más de una, suenan a la vez.
 *
 * **Por grado y no por semitonos**, por dos razones. La primera es la de siempre
 * en este fichero: cambiar de tonalidad cambia lo que suena sin tocar el
 * ejercicio. La segunda es que un intervalo **se cuenta por nombres**: seis
 * semitonos son una cuarta aumentada o una quinta disminuida según qué dos notas
 * sean, y con el grado se sabe cuál —en Fa sostenido mayor, de la sensible a la
 * tónica es Mi sostenido–Fa sostenido, no Fa–Fa sostenido—.
 *
 * En menor, los grados son los de la **menor natural**: es la escala de la
 * armadura, y así cada nota se escribe con la letra que le toca sin inventarse
 * alteraciones accidentales.
 *
 * Un intervalo melódico son dos pasos de una nota; uno armónico, un paso de dos.
 */
export interface EarNotes {
  readonly notes: readonly number[];
}

/** Un paso que es un acorde: el grado a secas, o el grado con su séptima. */
export type EarChordStep = DegreeSymbol | EarChord;

/** Un paso del ejercicio: un acorde, o notas sueltas. */
export type EarStep = EarChordStep | EarNotes;

function esNotas(step: EarStep): step is EarNotes {
  return typeof step !== 'string' && 'notes' in step;
}

/** El grado de un paso de acorde, lleve especie o no. */
export function gradoDe(step: EarChordStep): DegreeSymbol {
  return typeof step === 'string' ? step : step.degree;
}

/** La especie de un paso, o nulo si suena como tríada. */
function especieDe(step: EarChordStep): SeventhQuality | null {
  return typeof step === 'string' ? null : step.especie;
}

/** La escala de la que salen los grados de `EarNotes`: la de la armadura. */
function intervalosDeLaEscala(mode: KeyMode): readonly number[] {
  return SCALES[mode === 'major' ? 'major' : 'naturalMinor'].intervals;
}

/** Semitonos de la tónica a ese grado, contando octavas: el 8 son doce. */
function semitonosDelGrado(grado: number, mode: KeyMode): number {
  const escala = intervalosDeLaEscala(mode);
  const octavas = Math.floor((grado - 1) / 7);
  /* v8 ignore next -- el resto de dividir por siete siempre cae dentro de la escala */
  return (escala[(grado - 1) % 7] ?? 0) + 12 * octavas;
}

/**
 * Cómo se escribe ese grado en esa tonalidad: la letra que le toca y la
 * alteración de la armadura.
 *
 * Con la letra y no con `noteName`, que solo sabe doce nombres: en Fa sostenido
 * mayor el séptimo grado es Mi sostenido, y con doce nombres sale «F», que es otra
 * letra y por tanto **otro intervalo** al contar nombres. Lo escribe `spelling.ts`,
 * el mismo que escribe las lecciones: aquí había un tercer deletreador, sacado de
 * la armadura, que tenía que decir lo mismo que los otros dos.
 */
function grafiaDelGrado(grado: number, tonic: PitchClass, mode: KeyMode): string {
  return spelledName(keyDegree(tonic, mode, ((grado - 1) % 7) + 1));
}

/**
 * La octava en la que suenan las notas sueltas: el Do central.
 *
 * Una octava por encima de los acordes (`PLAYBACK_BASE_MIDI`), porque una nota
 * sola en el registro de acompañar se oye sorda y un intervalo melódico ahí abajo
 * cuesta. Desde el Do central, la tónica más alta (Si) y su octava quedan en la
 * zona de la voz, que es donde se canta un intervalo para reconocerlo.
 */
const NOTAS_BASE_MIDI = 60;

/** Las alturas exactas de un paso: el acorde colocado, o las notas sueltas. */
function alturasDe(step: EarStep, tonic: PitchClass, mode: KeyMode): number[] {
  if (esNotas(step)) {
    return step.notes.map((grado) => NOTAS_BASE_MIDI + tonic + semitonosDelGrado(grado, mode));
  }
  const { root, notes } = sonidoDe(step, tonic, mode);
  return voiceForPlayback(root, notes);
}

/**
 * Cuándo suena cada paso de un ejercicio y con qué alturas, listo para el
 * reproductor.
 *
 * Existe por los intervalos. La pantalla pasaba cada paso por
 * `scheduleProgression`, que coloca las notas **dentro de una octava fija**: vale
 * para un acorde, que se oye igual empiece donde empiece, pero un intervalo no.
 * De La a Fa sostenido es una sexta mayor subiendo, y colocadas en la misma
 * octava el Fa sostenido caía por debajo y sonaba una tercera menor bajando. La
 * octava, además, eran dos clases de altura iguales y sonaba una nota sola.
 *
 * Los acordes salen exactamente como antes —la misma disposición y los mismos
 * pulsos—, así que las demás clases no notan nada.
 */
export function programaDe(
  exercise: EarExercise,
  tonic: PitchClass,
  mode: KeyMode,
  bpm: number,
): ScheduledStep[] {
  return scheduleEvents(
    exercise.degrees.map((step, index) => ({
      startBeat: index * exercise.beats,
      beats: exercise.beats,
      midis: alturasDe(step, tonic, mode),
    })),
    bpm,
  );
}

/**
 * Las notas que suenan en un paso, y el cifrado con el que se escribe.
 *
 * Vive aquí y no en la pantalla porque **la pantalla ya se equivocó una vez**:
 * el cifrado de una cuatríada se escribía pegándole el sufijo al de la tríada, y
 * en las doce tonalidades menores salía «Ammaj7».
 *
 * Con notas sueltas, el «cifrado» son sus nombres. Las clases de altura no dicen
 * la octava: para oírlas en su sitio está `programaDe`.
 */
export function sonidoDe(
  step: EarStep,
  tonic: PitchClass,
  mode: KeyMode,
): { readonly root: PitchClass; readonly notes: readonly PitchClass[]; readonly symbol: string } {
  if (esNotas(step)) {
    const notes = step.notes.map((grado) =>
      normalizePitchClass(tonic + semitonosDelGrado(grado, mode)),
    );
    return {
      /* v8 ignore start -- un paso de notas sueltas lleva al menos una */
      root: notes[0] ?? tonic,
      /* v8 ignore stop */
      notes,
      symbol: step.notes.map((grado) => grafiaDelGrado(grado, tonic, mode)).join(' y '),
    };
  }
  const chord = resolveDegree(tonic, mode, gradoDe(step));
  const especie = especieDe(step);
  if (especie === null) {
    return { root: chord.root, notes: chord.notes, symbol: cifrado(tonic, mode, gradoDe(step)) };
  }
  return {
    root: chord.root,
    notes: seventhNotes(chord.root, especie),
    // La grafía de su tríada, no la de la armadura: en Do mayor el bVII7 es Bb7.
    symbol: seventhSymbol(chord.root, especie, grafiaDeLaFundamental(chord.root, chord.symbol)),
  };
}

export interface EarExercise {
  /**
   * Lo que suena, en grados y en orden.
   *
   * En grados y no en cifrados por lo mismo que el resto del proyecto: cambiar
   * de tonalidad cambia lo que suena sin tocar el ejercicio, y quien practica en
   * Mi bemol oye sus acordes. Los intervalos, igual, con grados de la escala
   * (`EarNotes`).
   */
  readonly degrees: readonly EarStep[];
  /** Pulsos que dura cada paso. */
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

/**
 * La buena delante y las malas detrás, **solo para escribirlas**: quien las reparte
 * es `earExercises`, al salir.
 */
function opciones(buena: string, otras: readonly string[]): Choice[] {
  return [{ text: buena, correct: true }, ...otras.map((text) => ({ text, correct: false }))];
}

/**
 * La primera letra en minúscula, para seguir una frase con otra que empieza.
 *
 * No `toLowerCase` entero: las frases de `HARMONIC_ROLES` tienen dos oraciones, y
 * la segunda salía en minúscula detrás del punto —«tensión. contiene el
 * tritono»—.
 */
function enMinuscula(frase: string): string {
  return `${frase.charAt(0).toLowerCase()}${frase.slice(1)}`;
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Cuántas letras hay de la tónica a la fundamental de un grado: el bVII, seis; el V/V, una. */
function letrasDelGrado(degree: DegreeSymbol): number {
  const pasos = (grado: string) =>
    ROMANOS.indexOf(
      grado.replace(/^b/, '').replace('°', '').toUpperCase() as (typeof ROMANOS)[number],
    );
  const [grado, destino] = degree.split('/') as [string, string | undefined];
  // Una dominante secundaria está una quinta —cuatro letras— por encima de su destino.
  return destino === undefined ? pasos(grado) : (pasos(destino) + 4) % 7;
}

/**
 * El cifrado de un grado en esta tonalidad, que es lo que se enseña al contestar,
 * con la fundamental en la letra de su grado.
 *
 * `resolveDegree` escribe con doce nombres, y vale para tocar; para enseñar no:
 * en F# mayor el vii° salía «Fdim» mientras la lección de grados, en la unidad de
 * al lado, decía E#dim, y el bVII de Db mayor era «B» aquí y Cb en el intercambio
 * modal. Con la letra del grado las unidades de oído dicen lo mismo que las de
 * teoría, dobles alteraciones incluidas: el bVI de Db mayor es Bbb, como en la
 * lección de la sexta aumentada.
 */
function cifrado(tonic: PitchClass, mode: KeyMode, degree: DegreeSymbol): string {
  const { root, symbol } = resolveDegree(tonic, mode, degree);
  const fundamental = spellAt(
    keyTonic(tonic, mode),
    letrasDelGrado(degree),
    normalizePitchClass(root - tonic),
  );
  return `${spelledName(fundamental)}${symbol.replace(/^[A-G][#b]?/, '')}`;
}

/**
 * Cada número de intervalo simple, con los semitonos de su especie de referencia.
 *
 * La referencia es la justa en la cuarta, la quinta y la octava, y la mayor en los
 * demás: es la regla de clasificar intervalos del conservatorio, y lo que hace que
 * una cuarta pueda ser justa pero nunca mayor.
 */
const NUMEROS: Readonly<
  Record<number, { readonly nombre: string; readonly semitonos: number; readonly justo: boolean }>
> = {
  2: { nombre: 'Segunda', semitonos: 2, justo: false },
  3: { nombre: 'Tercera', semitonos: 4, justo: false },
  4: { nombre: 'Cuarta', semitonos: 5, justo: true },
  5: { nombre: 'Quinta', semitonos: 7, justo: true },
  6: { nombre: 'Sexta', semitonos: 9, justo: false },
  7: { nombre: 'Séptima', semitonos: 11, justo: false },
  8: { nombre: 'Octava', semitonos: 12, justo: true },
};

/** La especie según cuántos semitonos se aparta de la referencia. */
const ESPECIES_JUSTAS: Readonly<Record<number, string>> = {
  [-1]: 'disminuida',
  0: 'justa',
  1: 'aumentada',
};
const ESPECIES_MAYORES: Readonly<Record<number, string>> = {
  [-2]: 'disminuida',
  [-1]: 'menor',
  0: 'mayor',
  1: 'aumentada',
};

/**
 * El nombre de un intervalo simple, como se dice en clase: «Tercera mayor».
 *
 * Se mide en los dos pasos de siempre —cuántos nombres abarca y cuántos semitonos
 * hay— y no con una tabla de semitonos a nombres, porque esa tabla no existe: seis
 * semitonos son una cuarta aumentada o una quinta disminuida, y lo que decide es
 * el número.
 */
export function nombreDelIntervalo(numero: number, semitonos: number): string {
  const referencia = NUMEROS[numero];
  if (referencia === undefined) {
    throw new RangeError(`No es un intervalo simple de segunda a octava: ${numero}.`);
  }
  const especies = referencia.justo ? ESPECIES_JUSTAS : ESPECIES_MAYORES;
  const especie = especies[semitonos - referencia.semitonos];
  if (especie === undefined) {
    throw new RangeError(`Una ${referencia.nombre.toLowerCase()} no mide ${semitonos} semitonos.`);
  }
  return `${referencia.nombre} ${especie}`;
}

/**
 * Qué intervalo ha sonado: dos notas, una detrás de otra o a la vez.
 *
 * Es lo primero que se entrena de oído en el conservatorio, y lo que corresponde
 * a la teoría de 2.º de Elemental: segundas y terceras mayores y menores, cuarta,
 * quinta y octava justas, y la sexta mayor. Las séptimas, los aumentados y los
 * disminuidos se dejan para más adelante: de oído son otra liga.
 *
 * **Las notas salen de la escala de la tonalidad**, como todo lo demás de este
 * fichero: quien practica en Mi bemol oye notas de Mi bemol. Por eso no todo sale
 * de la tónica. En mayor no hay tercera menor sobre la tónica, y en menor no hay
 * tercera mayor, así que cada modo busca la suya donde la tiene —en mayor, del
 * sexto grado a la tónica de arriba; en menor, del tercero al quinto— y el
 * intervalo que se pregunta es el mismo en las veinticuatro.
 *
 * La respuesta buena **no se escribe: se mide** con `nombreDelIntervalo` a partir
 * de los dos grados. Así no puede pasar lo que pasó en otras clases, que el
 * enunciado dijera una cosa y sonara otra.
 *
 * Melódicos casi todos, que es como se empieza, uno bajando —el nombre no cambia
 * con la dirección, y hay que oírlo— y el último armónico: la tercera de la tónica
 * a la mediante, que es la que decide el modo.
 */
function interval(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const mayor = mode === 'major';

  const medir = (desde: number, hasta: number) => {
    const abajo = Math.min(desde, hasta);
    const arriba = Math.max(desde, hasta);
    const semitonos = semitonosDelGrado(arriba, mode) - semitonosDelGrado(abajo, mode);
    const paso = desde <= hasta ? 1 : -1;
    const nombres: string[] = [];
    for (let grado = desde; grado !== hasta + paso; grado += paso) {
      nombres.push(grafiaDelGrado(grado, tonic, mode));
    }
    return { nombre: nombreDelIntervalo(arriba - abajo + 1, semitonos), semitonos, nombres };
  };

  const pregunta = (
    pasos: readonly EarStep[],
    [desde, hasta]: readonly [number, number],
    prompt: string,
    malas: readonly string[],
    pista: string,
  ): EarExercise => {
    const { nombre, semitonos, nombres } = medir(desde, hasta);
    const mide = semitonos === 1 ? 'un semitono' : `${semitonos} semitonos`;
    return {
      degrees: pasos,
      // Una nota suelta necesita más tiempo que un acorde para quedarse en el
      // oído; las dos a la vez, más todavía, porque hay que separarlas.
      beats: pasos.length === 1 ? 4 : 2,
      reference: 0,
      prompt,
      choices: opciones(nombre, malas),
      why: `De ${nombres[0]} a ${nombres.at(-1)} hay ${nombres.length} nombres —${nombres.join(', ')}— y ${mide}: ${nombre.toLowerCase()}. ${pista}`,
    };
  };

  const melodico =
    (desde: number, hasta: number) => (prompt: string, malas: readonly string[], pista: string) =>
      pregunta([{ notes: [desde] }, { notes: [hasta] }], [desde, hasta], prompt, malas, pista);

  // Dónde tiene cada modo el intervalo que no sale de su tónica.
  const segundaMenor: [number, number] = mayor ? [7, 8] : [2, 3];
  const terceraMayor: [number, number] = mayor ? [1, 3] : [3, 5];
  const terceraMenor: [number, number] = mayor ? [6, 8] : [1, 3];
  const sextaMayor: [number, number] = mayor ? [1, 6] : [3, 8];

  return [
    melodico(1, 2)(
      'Suenan dos notas, una detrás de otra. ¿Qué intervalo forman?',
      ['Segunda menor', 'Tercera menor'],
      'Es el paso de la escala, un tono entero.',
    ),
    melodico(...segundaMenor)(
      '¿Y estas dos?',
      ['Segunda mayor', 'Tercera menor'],
      'Medio tono: la distancia más corta entre dos notas de nombre distinto, y por eso roza.',
    ),
    melodico(...terceraMayor)(
      'Otras dos. ¿Qué intervalo es?',
      ['Tercera menor', 'Cuarta justa'],
      'Es la tercera del acorde mayor, la que suena abierta.',
    ),
    melodico(...terceraMenor)(
      '¿Y este?',
      ['Tercera mayor', 'Segunda mayor'],
      'Es la tercera del acorde menor: medio tono más corta que la mayor, y se oye más recogida.',
    ),
    melodico(1, 4)(
      '¿Y ahora?',
      ['Quinta justa', 'Tercera mayor'],
      'Es la que hay entre casi todas las cuerdas al aire de la guitarra: de E a A, de A a D, de D a G y de B a E.',
    ),
    melodico(1, 5)(
      '¿Y este otro?',
      ['Cuarta justa', 'Sexta mayor'],
      'Suena hueca y estable: es la de la fundamental a la quinta de un acorde, y sin la tercera en medio no dice si es mayor o menor.',
    ),
    melodico(...sextaMayor)(
      'Otro más. ¿Qué intervalo forman?',
      ['Quinta justa', 'Sexta menor'],
      'Si cuesta, piensa en su inversión: un intervalo y su inversión suman nueve y cambian de especie, así que la sexta mayor vuelta del revés es una tercera menor.',
    ),
    melodico(1, 8)(
      '¿Y estas?',
      ['Quinta justa', 'Séptima mayor'],
      'Es la misma nota más arriba, y por eso se funden: se parecen tanto que cuesta oír que son dos.',
    ),
    melodico(5, 1)(
      'Ahora bajando. ¿Qué intervalo es?',
      ['Cuarta justa', 'Sexta mayor'],
      'Bajando se llama igual que subiendo: se cuentan los nombres desde la primera nota hasta la segunda, vaya hacia donde vaya.',
    ),
    pregunta(
      [{ notes: [1, 3] }],
      [1, 3],
      'Y ahora las dos a la vez. ¿Qué intervalo forman?',
      [mayor ? 'Tercera menor' : 'Tercera mayor', 'Quinta justa'],
      `Es la tercera de la tónica a la mediante, la que decide el modo: aquí es ${mayor ? 'mayor' : 'menor'}, como la tonalidad.`,
    ),
  ];
}

/**
 * Mayor, menor o disminuido: la especie del acorde.
 *
 * Es lo primero que oye cualquiera sin haber estudiado nada, y por eso abre. Se
 * usan los tres grados que más suenan de una tonalidad y su relativo, para que
 * la diferencia sea la especie y no el registro. Las dos primeras se preguntan
 * como alegre o triste, que es como lo oye quien empieza, y luego por su nombre.
 *
 * La disminuida va la última, y añadida después: la unidad prometía «mayor, menor
 * y disminuido» y solo hacía sonar las dos primeras. Es la tercera especie que da
 * la escala —el séptimo grado en mayor, el segundo en menor— y la que se reconoce
 * por la quinta, no por la tercera.
 */
function quality(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const mayores: DegreeSymbol[] = mode === 'major' ? ['I', 'IV', 'V'] : ['III', 'VI', 'VII'];
  const menores: DegreeSymbol[] = mode === 'major' ? ['vi', 'ii', 'iii'] : ['i', 'iv', 'v'];
  const disminuido: DegreeSymbol = mode === 'major' ? 'vii°' : 'ii°';

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
      // Antes decía «la misma fundamental» que el anterior, y no lo es: el
      // relativo tiene otra. Y luego «la quinta es la misma», que se leía como la
      // misma nota y tampoco lo es: lo que comparten es la especie, justa.
      why: `Es ${cifrado(tonic, mode, menores[0]!)}, un acorde menor: la tercera está a tono y medio de la fundamental, medio tono más cerca que en el mayor, y la quinta es justa en los dos. Ese medio tono es toda la diferencia.`,
    },
    {
      degrees: [menores[1]!],
      beats: 4,
      reference: 0,
      prompt: 'Uno más. ¿Mayor o menor?',
      choices: opciones('Menor', ['Mayor']),
      // «Cualquier acorde de tres notas» era falso: quedaban la disminuida y la
      // aumentada, y la disminuida es la pregunta siguiente.
      why: `${cifrado(tonic, mode, menores[1]!)} es menor. Con estos dos sonidos en la cabeza se distinguen los dos acordes que más suenan; la escala da uno más, y es el siguiente.`,
    },
    {
      degrees: [disminuido],
      beats: 4,
      reference: 0,
      prompt: 'El último. ¿Mayor, menor o disminuido?',
      choices: opciones('Disminuido', ['Menor', 'Mayor']),
      why: `${cifrado(tonic, mode, disminuido)} es una tríada disminuida: dos terceras menores apiladas, así que la quinta queda medio tono más corta que la justa. Esa quinta disminuida es lo que la hace sonar inestable, ni alegre ni triste.`,
    },
  ];
}

/**
 * Qué grado ha sonado, con la tónica delante.
 *
 * Los tres tonales primero —I, IV y V—, que son los que sostienen una canción
 * entera, y el de la relativa después. Es el mismo orden en el que los enseña
 * `teachingRank`, y por la misma razón.
 *
 * En menor, el de la relativa es el III y no el VI. Era el VI, y el porqué decía
 * «por eso es el relativo» de un acorde que no lo es: la relativa de La menor es
 * Do mayor, la de la misma armadura.
 */
function degree(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const casa: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const quinto: DegreeSymbol = 'V';
  const relativo: DegreeSymbol = mode === 'major' ? 'vi' : 'III';

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
      why: `El ${cuarto} se aleja de casa sin tensión. No pide resolver como el V: solo se ha ido.`,
    },
    {
      degrees: [casa, relativo],
      beats: 3,
      reference: 1,
      prompt: 'Este cambia de ánimo. ¿Cuál es?',
      choices: opciones(nombres(relativo)[0]!, nombres(cuarto, quinto)),
      why: `${cifrado(tonic, mode, relativo)} comparte dos notas con la casa y suena al mismo sitio con otra luz: es el acorde de la tonalidad relativa, la de la misma armadura.`,
    },
  ];
}

/**
 * Si la frase cierra o se queda colgada.
 *
 * Aquí no se oye un acorde sino **qué pasa entre dos**, que es lo que hace que
 * una frase suene terminada. Es lo último de los tres porque necesita las dos
 * cosas anteriores: saber qué grado suena y qué hace cada uno.
 *
 * Con los nombres del conservatorio: perfecta (V–I), semicadencia (acaba en el
 * V), plagal (IV–I) y rota (V–VI), que se añadió la última.
 */
function cadence(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const casa: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const quinto: DegreeSymbol = 'V';
  const sexto: DegreeSymbol = mode === 'major' ? 'vi' : 'VI';

  return [
    {
      degrees: [casa, cuarto, quinto, casa],
      beats: 2,
      reference: 0,
      prompt: '¿Termina o se queda a medias?',
      choices: opciones('Termina', ['Se queda a medias']),
      why: `Acaba en ${cifrado(tonic, mode, casa)} viniendo del V: del V al ${casa} es la cadencia perfecta, y por eso suena a punto final.`,
    },
    {
      degrees: [casa, cuarto, casa, quinto],
      beats: 2,
      reference: 0,
      prompt: '¿Y esta?',
      choices: opciones('Se queda a medias', ['Termina']),
      why: `Acaba en ${cifrado(tonic, mode, quinto)}, que es tensión: es una semicadencia, la frase se para en el V. Queda colgada a propósito: es lo que se hace al final de una estrofa para que la siguiente entre.`,
    },
    {
      degrees: [casa, quinto, cuarto, casa],
      beats: 2,
      reference: 0,
      prompt: 'Esta también cierra, pero de otra manera. ¿Con cuál?',
      // El grado como se escribe en su modo: en menor el cuarto es `iv`, y decir
      // «el IV» de un acorde menor es decir otro acorde.
      choices: opciones(`Con el ${cuarto}, ${cifrado(tonic, mode, cuarto)}`, [
        `Con el V, ${cifrado(tonic, mode, quinto)}`,
      ]),
      why: `Es la cadencia plagal, del ${cuarto} al ${casa}: el «amén» del final de los himnos. Cierra sin la tensión del V: suena a descanso, no a resolución.`,
    },
    {
      degrees: [casa, cuarto, quinto, sexto],
      beats: 2,
      reference: 0,
      prompt: 'El V pide volver a casa. ¿Llega?',
      choices: opciones('No: cae en otro acorde', ['Sí, cierra en la casa', 'Se queda en el V']),
      why: `Del V va a ${cifrado(tonic, mode, sexto)} en vez de a ${cifrado(tonic, mode, casa)}: es la cadencia rota. El oído esperaba la tónica y le llega el ${sexto}, que comparte dos notas con ella: por eso sorprende sin sonar a error.`,
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
  // La séptima que le toca al primer grado en su modo: mayor sobre el I de una
  // tonalidad mayor, menor sobre el i de una menor. Es la que sale de la escala.
  const septimaDelUno: SeventhQuality = mode === 'major' ? 'major7' : 'minor7';

  // El acorde suena dos veces: la tríada, y la misma con la nota de más. Antes
  // los dos pasos eran el mismo grado a secas y sonaba dos veces lo mismo.
  const conSeptima = (degree: DegreeSymbol, especie: SeventhQuality): EarChord => ({
    degree,
    especie,
  });

  const cifradoDeUno = sonidoDe(conSeptima(uno, septimaDelUno), tonic, mode).symbol;
  const cifradoDeCinco = sonidoDe(conSeptima(cinco, 'dominant7'), tonic, mode).symbol;
  // A qué distancia queda la séptima de la octava. Decía «medio tono» también en
  // menor, y la séptima menor está a un tono entero.
  const roce =
    mode === 'major'
      ? 'Esa séptima mayor queda medio tono por debajo de la fundamental de arriba y roza sin empujar'
      : 'Esa séptima menor queda un tono por debajo de la fundamental de arriba y apenas roza';

  return [
    {
      degrees: [uno, conSeptima(uno, septimaDelUno)],
      beats: 3,
      reference: 1,
      prompt: 'El mismo acorde, y luego con una nota más. ¿Cómo suena la de más?',
      choices: opciones('Suave, casi dulce', ['Áspera, pide resolver']),
      why: `Es ${cifradoDeUno}. ${roce}: de ahí que suene a calma y no a tensión.`,
    },
    {
      degrees: [cinco, conSeptima(cinco, 'dominant7')],
      beats: 3,
      reference: 1,
      prompt: '¿Y esta otra?',
      choices: opciones('Áspera, pide resolver', ['Suave, casi dulce']),
      why: `Es ${cifradoDeCinco}. La nota añadida forma un tritono con la sensible, que ya estaba en la tríada, y ese tritono es lo que empuja hacia la tónica.`,
    },
    {
      // Las dos cuatríadas seguidas, sin tríadas de por medio: lo que se compara
      // ahora es una séptima contra otra, que es la pregunta de verdad.
      degrees: [conSeptima(uno, septimaDelUno), conSeptima(cinco, 'dominant7')],
      beats: 3,
      reference: 0,
      prompt: 'De estos dos, ¿cuál pide seguir?',
      choices: opciones('El segundo', ['El primero', 'Ninguno de los dos']),
      why: `La misma nota añadida cambia de papel según sobre qué grado caiga: en ${cifradoDeUno} descansa y en ${cifradoDeCinco} tensa. No es la séptima, es dónde está.`,
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
 *
 * **En menor, lo de fuera es otra cosa.** Sonaban el VII y el VI, y los dos son
 * de la menor natural: en La menor, Sol y Fa mayor no traen ninguna nota de
 * fuera, y la unidad decía que sí. Ahora en menor se sale con el napolitano —el
 * segundo grado rebajado— y con el I mayor, el préstamo del modo mayor, que
 * **aclara** en vez de oscurecer: lo que se trae del paralelo va en la dirección
 * contraria según de dónde se salga.
 */
function borrowed(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const mayor = mode === 'major';
  const uno: DegreeSymbol = mayor ? 'I' : 'i';
  const cuatro: DegreeSymbol = mayor ? 'IV' : 'iv';
  const prestado: DegreeSymbol = mayor ? 'bVII' : 'bII';
  // En menor, el I mayor: en la tabla es `V/iv`, que es el mismo acorde.
  const delParalelo: DegreeSymbol = mayor ? 'bVI' : 'V/iv';

  return [
    {
      degrees: [uno, cuatro],
      beats: 3,
      reference: 1,
      prompt: '¿El segundo es de la tonalidad o viene de fuera?',
      choices: opciones('De la tonalidad', ['De fuera']),
      why: `${cifrado(tonic, mode, cuatro)} es el ${cuatro}, uno de los siete de casa. No hay ninguna nota que no estuviera ya.`,
    },
    {
      degrees: [uno, prestado],
      beats: 3,
      reference: 1,
      prompt: '¿Y este?',
      choices: opciones('De fuera', ['De la tonalidad']),
      why: mayor
        ? `${cifrado(tonic, mode, prestado)} trae una nota que no está en la escala: el séptimo grado rebajado, prestado del modo menor. Suena a riff justo por eso: se sale y vuelve.`
        : // La napolitana se estudia en el curso siguiente: aquí se anuncia, no se da por sabida.
          `${cifrado(tonic, mode, prestado)} trae una nota que no está en la escala: el segundo grado rebajado medio tono, el color frigio. En el curso que viene se estudia como napolitana; aquí basta con oír que se sale.`,
    },
    {
      degrees: [uno, delParalelo],
      beats: 3,
      reference: 1,
      prompt: 'Este también se sale. ¿Aclara u oscurece?',
      choices: mayor ? opciones('Oscurece', ['Aclara']) : opciones('Aclara', ['Oscurece']),
      // «Baja media escala de golpe» no quería decir nada: lo que baja son dos
      // notas concretas, y se dicen.
      why: mayor
        ? `${cifrado(tonic, mode, delParalelo)} viene del modo menor: trae la tercera y la sexta rebajadas medio tono, y por eso ensombrece sin cambiar de centro.`
        : `${cifrado(tonic, mode, delParalelo)} es la misma tónica con la tercera mayor, prestada del modo mayor: esa nota sube medio tono y la casa se ilumina sin cambiar de centro. Cerrando una obra en menor se llama tercera de picardía.`,
    },
  ];
}

/**
 * Distinguir dos modos por lo que los separa.
 *
 * Se comparan sobre la misma tónica y no en abstracto: dos modos se parecen
 * mucho, y lo que los distingue es **una nota**. Se oye el acorde que la lleva.
 *
 * En mayor, la sensible separa el jónico del mixolidio; en menor, el menor
 * armónico del eólico. Los porqués decían «jónico» y «mixolidio» también en menor,
 * donde no suena ninguno de los dos.
 */
function modes(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const mayor = mode === 'major';
  const uno: DegreeSymbol = mayor ? 'I' : 'i';
  const quinto: DegreeSymbol = 'V';
  const prestado: DegreeSymbol = mayor ? 'bVII' : 'VII';
  const cuatro: DegreeSymbol = mayor ? 'IV' : 'iv';

  return [
    {
      degrees: [uno, quinto, uno],
      beats: 2,
      reference: 0,
      prompt: '¿El de en medio tiene sensible, esa nota que empuja al final?',
      choices: opciones('Sí', ['No']),
      // No «lo que distingue el jónico de los demás»: el lidio también tiene
      // sensible.
      why: mayor
        ? 'Con el V mayor hay sensible, medio tono por debajo de la tónica, y eso es lo que hace que el cierre suene clásico. Es lo que separa el jónico, el modo mayor, del mixolidio.'
        : 'Con el V mayor hay sensible, medio tono por debajo de la tónica: es la séptima subida del menor armónico, y lo que hace que el cierre suene clásico. Sin ella, el menor es el eólico.',
    },
    {
      degrees: [uno, prestado, uno],
      beats: 2,
      reference: 0,
      prompt: 'Aquí en medio hay otro. ¿Empuja igual?',
      choices: opciones('No, llega más plano', ['Sí, igual de fuerte']),
      why: `${cifrado(tonic, mode, prestado)} está un tono entero por debajo de la tónica, no medio: no hay sensible. Es el sonido del ${mayor ? 'mixolidio' : 'eólico, el menor natural'}, y de medio repertorio de rock.`,
    },
    {
      degrees: [uno, cuatro, uno],
      beats: 2,
      reference: 0,
      // Preguntaba si sonaba «más apagado» que el anterior, y en mayor era al
      // revés: el bVII es el que oscurece, el IV es de casa. Lo que sí es verdad
      // en los dos modos es lo que dice el porqué, y eso es lo que se pregunta.
      prompt: 'Y este, ¿empuja hacia la casa como el V?',
      choices: opciones('No, vuelve por descanso', ['Sí, igual que el V']),
      why: 'El cuarto grado no tensa: aleja. Sin sensible y sin tritono, el cierre llega por descanso y no por resolución: es la cadencia plagal.',
    },
  ];
}

/**
 * Qué papel hace un acorde: reposo, salida o tensión.
 *
 * Es la unidad que le faltaba a **Funciones armónicas**, que era el único curso
 * con dos lecciones de teoría y nada que oír. Y la función es lo que menos se
 * puede estudiar leyendo: un grado no «es» tenso, tensa *respecto a la tónica*,
 * así que sin la casa sonando antes la pregunta no tiene respuesta. Por eso los
 * tres llevan referencia.
 *
 * El tercero es el que enseña algo: el sexto grado tiene **la especie contraria a
 * la de la tónica y reposa igual** —en mayor el vi es menor; en menor el VI es
 * mayor—. Es el sitio donde alegre o triste deja de servir y hay que oír la
 * función. Si alguien falla uno de los tres, que sea ese.
 *
 * La dominante suena con su séptima. El porqué dice que «contiene el tritono», y
 * la tríada del V no lo tiene: el tritono es de la sensible a la séptima.
 */
function functions(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuatro: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  const cinco: EarChord = { degree: 'V', especie: 'dominant7' };
  const seis: DegreeSymbol = mode === 'major' ? 'vi' : 'VI';

  const REPOSA = 'Reposa';
  const SALE = 'Sale de casa, sin tensión';
  const TENSA = 'Tensa, pide volver';

  return [
    {
      degrees: [uno, cuatro],
      beats: 3,
      reference: 1,
      prompt: 'Primero la casa. El segundo, ¿qué hace?',
      choices: opciones(SALE, [REPOSA, TENSA]),
      why: `${cifrado(tonic, mode, cuatro)} es la subdominante: ${enMinuscula(HARMONIC_ROLES.subdominant.what)}`,
    },
    {
      degrees: [uno, cinco],
      beats: 3,
      reference: 1,
      prompt: '¿Y este otro?',
      choices: opciones(TENSA, [REPOSA, SALE]),
      why: `${sonidoDe(cinco, tonic, mode).symbol} es la dominante: ${enMinuscula(HARMONIC_ROLES.dominant.what)} Es ese tritono, de la sensible a la séptima, lo que se oye apretar.`,
    },
    {
      degrees: [uno, seis],
      beats: 3,
      reference: 1,
      // En menor el VI es mayor: decir «suena triste» era decir lo que no suena.
      prompt:
        mode === 'major'
          ? 'Este suena triste. Pero ¿reposa, sale o tensa?'
          : 'Este suena alegre. Pero ¿reposa, sale o tensa?',
      choices: opciones(REPOSA, [SALE, TENSA]),
      why: `${cifrado(tonic, mode, seis)} es ${mode === 'major' ? 'menor' : 'mayor'} y aun así hace de tónica: comparte dos notas con ${cifrado(tonic, mode, uno)} y descansa igual. **Alegre o triste no es lo mismo que el papel**, y este es el grado donde se ve.`,
    },
  ];
}

/**
 * Oír que un acorde va donde iría otro.
 *
 * Es la unidad que le faltaba a **Sustituciones**, que era el curso más flojo del
 * temario: dos lecciones de teoría y nada más. Y la sustitución es de lo que menos
 * se puede estudiar leyendo, porque lo único que la justifica es que **suene igual
 * de bien en ese sitio**: en el papel, cambiar un acorde por otro con otra
 * fundamental no se distingue de una equivocación.
 *
 * Las dos maneras de sustituir se oyen distinto, y por eso van separadas:
 *
 * - Por **notas compartidas**: el relativo hace el mismo reposo con dos de las
 *   tres notas. Se oye como un final que llega pero no cierra del todo.
 * - Por **tritono**: dos dominantes a un tritono de distancia llevan el mismo par
 *   de notas apretando, así que aprietan igual aunque la fundamental esté en otro
 *   sitio. Esta **hay que oírla con la séptima puesta**: la tríada de `bII` no
 *   tiene tritono, y sin él la pregunta ni se puede contestar ni es verdad
 *   ([adr/0044](../../../docs/adr/0044-un-ejercicio-de-oido-se-contesta-de-oido.md)).
 */
function substitutions(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuatro: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  // El que hace el papel de la tónica sin serlo, y el que llega del V: el sexto
  // grado, que en los dos modos comparte dos notas con la tónica y es tónica en
  // `harmonic-function.ts`. En menor era el III, y del V al III no es una
  // cadencia que escriba nadie —en La menor, el Sol sostenido cae a Sol natural
  // en la voz de al lado—; del V al VI es la cadencia rota de manual.
  const relativo: DegreeSymbol = mode === 'major' ? 'vi' : 'VI';
  const tritonal: EarChord = { degree: 'bII', especie: 'dominant7' };
  const dominante: EarChord = { degree: 'V', especie: 'dominant7' };

  const LA_CASA = 'La casa';
  const UN_SUSTITUTO = 'Otro que hace su papel';

  return [
    {
      degrees: [uno, cuatro, 'V', uno],
      beats: 2,
      reference: 0,
      prompt: 'Cuatro acordes. El último, ¿es la casa o algo que hace su papel?',
      choices: opciones(LA_CASA, [UN_SUSTITUTO]),
      why: `Cierra en ${cifrado(tonic, mode, uno)}, la tónica. Es el final que no deja nada pendiente, y sirve de referencia para el siguiente.`,
    },
    {
      degrees: [uno, cuatro, 'V', relativo],
      beats: 2,
      reference: 0,
      prompt: 'Los tres primeros son los mismos. ¿Y el último?',
      choices: opciones(UN_SUSTITUTO, [LA_CASA]),
      why: `Es ${cifrado(tonic, mode, relativo)}: comparte dos de sus tres notas con ${cifrado(tonic, mode, uno)} y hace el mismo reposo. Del V a él es la cadencia rota: el final llega, pero no cierra del todo.`,
    },
    {
      // Las dos dominantes con su séptima, que es donde vive el tritono: con las
      // tríadas a secas esta pregunta ni se puede contestar ni sería cierta.
      degrees: [dominante, uno, tritonal, uno],
      beats: 2,
      reference: 0,
      prompt: 'Dos maneras de llegar a casa. ¿La segunda aprieta como la primera?',
      choices: opciones('Sí, las dos aprietan igual', [
        'Solo aprieta la primera',
        'Solo aprieta la segunda',
      ]),
      why: `${sonidoDe(tritonal, tonic, mode).symbol} lleva dentro el mismo tritono que ${sonidoDe(dominante, tonic, mode).symbol}, y el tritono es simétrico: el mismo par de notas sirve a dos dominantes separadas por un tritono. Cambia la fundamental, no la tensión.`,
    },
  ];
}

/**
 * La relativa y la vecina, oyéndolas.
 *
 * Es la unidad que le faltaba a **La rueda de quintas**. La rueda se estudia
 * mirándola y es un dibujo bonito que no se sostiene en el oído, y sin embargo lo
 * que dice se oye perfectamente: la relativa **son las mismas notas con otro
 * centro** —no suena a haber cambiado de sitio, suena a haberse sentado en otra
 * silla de la misma casa— y a la vecina **solo se llega trayendo una nota que
 * aquí no está**.
 *
 * Por eso la vecina se presenta con su dominante secundaria y no con el quinto
 * grado: el V de esta tonalidad es de casa y no trae nada nuevo. El `V/V` es
 * literalmente la puerta, porque lleva la nota que separa esta tonalidad de la de
 * al lado: en Do mayor es su tercera, el Fa sostenido; en La menor es su quinta,
 * también el Fa sostenido, y su tercera es la sensible de Mi menor.
 */
function circle(tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const uno: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const relativo: DegreeSymbol = mode === 'major' ? 'vi' : 'III';
  const cinco: DegreeSymbol = 'V';

  const DE_CASA = 'Las mismas notas, otro centro';
  const DE_FUERA = 'Trae una nota que aquí no está';

  return [
    {
      degrees: [uno, relativo],
      beats: 3,
      reference: 1,
      prompt: 'Primero la casa. El segundo, ¿se ha ido de la tonalidad?',
      choices: opciones(DE_CASA, [DE_FUERA]),
      why: `${cifrado(tonic, mode, relativo)} es la relativa: **la misma armadura**, las mismas siete notas, y solo cambia cuál manda. En la rueda están pegadas una dentro de la otra por eso.`,
    },
    {
      degrees: [uno, 'V/V'],
      beats: 3,
      reference: 1,
      prompt: '¿Y este otro?',
      choices: opciones(DE_FUERA, [DE_CASA]),
      // En menor decía lo mismo que en mayor, y su tercera no es la que separa:
      // en La menor el V/V es B, y lo que lleva a Mi menor es el F#, su quinta.
      why:
        mode === 'major'
          ? 'Es la dominante de la vecina, y su tercera no está en tu escala. Esa nota de más es exactamente lo que separa tu tonalidad de la de al lado en la rueda: una sola.'
          : 'Es la dominante de la vecina y trae dos notas que no están en tu escala: su quinta es la que separa tu tonalidad de la de al lado en la rueda, y su tercera es la sensible de esa vecina.',
    },
    {
      degrees: [uno, 'V/V', cinco, uno],
      beats: 2,
      reference: 0,
      prompt: 'Cuatro acordes. El segundo, ¿a dónde empujaba?',
      choices: opciones('Al tercero', ['A la casa', 'A ningún sitio']),
      // Esta unidad es de tercero de Elemental y las dominantes secundarias son de
      // cuarto de Profesional: se explicaba con un nombre que todavía no se tiene.
      // Lo que sí se tiene es la sensible, y con eso basta.
      why: `Empuja al ${cifrado(tonic, mode, cinco)}, no a la casa: su tercera es la sensible de ${cifrado(tonic, mode, cinco)}, medio tono por debajo, y tira hacia él. Es el paseo por la rueda: se asoma a la vecina y vuelve, en cuatro acordes.`,
    },
  ];
}

/**
 * Los ejercicios de oído de esa clase, en esa tonalidad, con las opciones ya
 * repartidas.
 *
 * Aquí y no en cada clase por lo mismo que `lessonNotes`: es la única puerta por la
 * que salen, la usan la unidad y el repaso, y quien escriba mañana otra clase no
 * tiene que acordarse de barajar. La tonalidad entra en la semilla porque aquí los
 * textos no cambian con ella —«Sí» y «No» son los mismos en Do que en Mi bemol—, y
 * sin ella cada pregunta caería en el mismo sitio en las veinticuatro.
 */
export function earExercises(kind: EarKind, tonic: PitchClass, mode: KeyMode): EarExercise[] {
  const catalogo: Readonly<Record<EarKind, (t: PitchClass, m: KeyMode) => EarExercise[]>> = {
    interval,
    quality,
    degree,
    circle,
    functions,
    cadence,
    substitutions,
    sevenths,
    borrowed,
    modes,
  };
  return repartidasEnLaUnidad(catalogo[kind](tonic, mode), `${kind}|${tonic}|${mode}`);
}

/** De qué va cada clase, para el rótulo de la unidad. */
export const EAR_KINDS: Readonly<Record<EarKind, { name: string; lead: string }>> = {
  interval: {
    name: 'Reconocer intervalos',
    lead: 'Suenan dos notas, una detrás de otra o a la vez. Di qué intervalo forman: cuántos nombres abarcan y de qué especie es.',
  },
  quality: {
    name: 'Mayor, menor o disminuido',
    lead: 'Un acorde suena. Di de qué especie es: primero alegre o triste, que es lo que se oye sin saber nada, y luego por su nombre.',
  },
  degree: {
    name: 'Qué grado ha sonado',
    lead: 'Primero la tónica, luego otro acorde. Di cuál era, con la tónica todavía en el oído.',
  },
  circle: {
    name: 'La relativa y la vecina',
    lead: 'La casa y luego otro acorde. Di si sigue siendo la misma tonalidad o ha traído una nota de fuera.',
  },
  functions: {
    name: 'Reposo, salida o tensión',
    lead: 'Primero la casa y luego otro acorde. No digas cuál es: di qué hace.',
  },
  cadence: {
    name: 'Cadencias: si cierra o se queda colgada',
    lead: 'Cuatro acordes. Lo que se oye no es uno: es qué pasa entre el penúltimo y el último. Perfecta, semicadencia, plagal o rota.',
  },
  sevenths: {
    name: 'Qué añade la séptima',
    lead: 'Primero la tríada y luego la misma con una nota más. Lo que hay que oír es la de más.',
  },
  substitutions: {
    name: 'Si es el acorde o el que hace su papel',
    lead: 'Progresiones que acaban distinto. Lo que hay que oír no es cuál suena, sino qué papel hace.',
  },
  borrowed: {
    name: 'Si el acorde es de casa o viene de fuera',
    lead: 'La casa y luego otro acorde. Di si pertenece a la tonalidad o se ha traído de otro sitio.',
  },
  modes: {
    name: 'Con sensible y sin ella',
    lead: 'Tres acordes que vuelven a casa por caminos distintos. Lo que hay que oír es una sola nota: la sensible, medio tono por debajo de la tónica.',
  },
};
