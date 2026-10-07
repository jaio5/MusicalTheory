/**
 * Teoría para aprender tocando, no leyendo.
 *
 * Cada lección se genera desde la tonalidad en la que estés, así que las
 * preguntas hablan de los acordes que tienes debajo de los dedos ahora mismo y
 * no de un Do mayor de libro. Todo se calcula: aquí no hay respuestas escritas
 * a mano que se puedan desincronizar del resto del dominio.
 */

import { conOpcionesRepartidas } from './baraja';
import { diatonicSevenths, diatonicTriads, type DiatonicChord, type SeventhChord } from './chords';
import { accidentalForKey, keySignature, relativeMajor, relativeMinor } from './circle-of-fifths';
import type { KeyMode } from './keys';
import { keyName } from './keys';
import { noteName, type PitchClass } from './notes';
import { SCALES } from './scales';
import { LECCIONES_DE_ARMONIA } from './lecciones/armonia';
import { choices, dominanteDe, homonima, scaleOf, up } from './lecciones/comun';
import { LECCIONES_DE_LENGUAJE } from './lecciones/lenguaje';
import {
  keyScale,
  keyTonic,
  parseSpelledName,
  spellAbove,
  spellAt,
  spellScaleOf,
  spelledName,
} from './spelling';

export type LessonId =
  | 'degrees'
  | 'qualities'
  | 'circle'
  | 'borrowed'
  | 'scales'
  | 'functions'
  | 'sevenths'
  | 'substitutions'
  | 'modes'
  | 'cadences'
  // Lenguaje Musical, en `lecciones/lenguaje.ts`.
  | 'notas'
  | 'claves'
  | 'ritmo'
  | 'escalaMayor'
  | 'intervalos'
  | 'escalasMenores'
  // Armonía, en `lecciones/armonia.ts`.
  | 'inversiones'
  | 'enlaces'
  | 'septimaDominante'
  | 'secundarias'
  | 'modulacion'
  | 'cromaticos';

export interface Lesson {
  readonly id: LessonId;
  readonly title: string;
  /** De qué va, en una frase. */
  readonly summary: string;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'degrees',
    title: 'Los grados y su cifrado',
    summary: 'Los siete acordes que salen de una tonalidad, cómo se cifran y cuáles la sostienen.',
  },
  {
    id: 'qualities',
    title: 'Las especies de tríada',
    summary:
      'Cómo se apila un acorde por terceras, y por qué sale mayor, menor, disminuido o aumentado.',
  },
  {
    id: 'circle',
    title: 'Armaduras y círculo de quintas',
    summary:
      'El orden de las alteraciones, la tonalidad por su armadura, las vecinas y la relativa.',
  },
  {
    id: 'borrowed',
    title: 'Intercambio modal',
    summary: 'Los acordes que se toman del modo paralelo, el de la misma tónica.',
  },
  {
    id: 'scales',
    title: 'Pentatónicas y blues',
    summary: 'Las escalas sin semitonos, la nota de blues y cuál va encima de cada tonalidad.',
  },
  {
    id: 'functions',
    title: 'Funciones armónicas',
    summary: 'Reposo, salida y tensión: qué hace cada grado, no solo cómo se llama.',
  },
  {
    id: 'sevenths',
    title: 'Las especies de séptima',
    summary:
      'Lo que añade la séptima, cómo se cifra cada especie y por qué cada una lo cambia distinto.',
  },
  {
    id: 'substitutions',
    title: 'Sustituciones',
    summary: 'Por qué un acorde puede ir donde iría otro, y cuándo no.',
  },
  {
    id: 'modes',
    title: 'Los siete modos',
    summary: 'Las mismas notas empezando por otro sitio, y la nota que distingue a cada uno.',
  },
  {
    id: 'cadences',
    title: 'Cadencias',
    summary: 'Perfecta, imperfecta, plagal, semicadencia y rota: cómo se cierra una frase, o no.',
  },
  {
    id: 'notas',
    title: 'Las notas',
    summary: 'Los siete nombres, las alteraciones, el tono y el semitono.',
  },
  {
    id: 'claves',
    title: 'El pentagrama y las claves',
    summary: 'Dónde cae cada nota según la clave.',
  },
  {
    id: 'ritmo',
    title: 'Figuras y compás',
    summary: 'Cuánto dura cada figura y cómo las agrupa el compás.',
  },
  {
    id: 'escalaMayor',
    title: 'La escala mayor',
    summary: 'Su fórmula de tonos y semitonos, y el nombre de cada grado.',
  },
  {
    id: 'intervalos',
    title: 'Intervalos',
    summary: 'Cómo se mide la distancia entre dos notas y cómo se invierte.',
  },
  {
    id: 'escalasMenores',
    title: 'Las escalas menores',
    summary: 'Natural, armónica y melódica: qué sube cada una y por qué.',
  },
  {
    id: 'inversiones',
    title: 'Inversiones',
    summary: 'Qué nota va en el bajo y cómo se cifra.',
  },
  {
    id: 'enlaces',
    title: 'Enlace de acordes',
    summary: 'Cómo se mueven las voces de un acorde al siguiente.',
  },
  {
    id: 'septimaDominante',
    title: 'La séptima de dominante',
    summary: 'Su tritono, su resolución y sus inversiones.',
  },
  {
    id: 'secundarias',
    title: 'Dominantes secundarias',
    summary: 'El V de otro grado, y hacia dónde resuelve.',
  },
  {
    id: 'modulacion',
    title: 'Modulación',
    summary: 'Cambiar de tónica a una tonalidad vecina por un acorde pivote.',
  },
  {
    id: 'cromaticos',
    title: 'Napolitana y sexta aumentada',
    summary: 'Los acordes alterados que preparan la dominante.',
  },
];

export interface Choice {
  readonly text: string;
  readonly correct: boolean;
}

export interface Exercise {
  readonly prompt: string;
  readonly choices: readonly Choice[];
  /** Por qué la buena es la buena. Se enseña después de contestar. */
  readonly why: string;
}

/** Lo que se explica antes de preguntar, en la tonalidad de quien lee. */
export interface LessonNotes {
  readonly points: readonly string[];
  readonly exercises: readonly Exercise[];
}

// ---------------------------------------------------------------------------
// Escribir las notas por su letra, no por su tecla.
// ---------------------------------------------------------------------------

/*
  Los doce nombres de `noteName` no bastan para escribir una tonalidad.

  En Fa# mayor el séptimo grado es **Mi#**, y con doce nombres sale «F»: la
  lección decía que los acordes de Fa# mayor eran «F#, G#m, A#m, B, C#, D#m,
  Fdim», con dos acordes sobre la letra F y ninguno sobre la E. Lo mismo en Re#
  menor, cuyo ii° es Mi#. Y lo prestado no se podía escribir: el bVII de Reb
  mayor es Dob, y la sensible de Sol# menor, Fa doble sostenido.

  La regla es la de siempre: **cada grado tiene su letra**, y la alteración es la
  que haga falta para llegar a la altura. Quien la aplica es `spelling.ts`, el
  mismo que usan las lecciones de `lecciones/` y el glosario del profesor: este
  fichero tenía su propio deletreador, copia del de allí, y dos copias de una
  regla son dos sitios donde puede romperse. Aquí solo quedan los atajos para
  escribir con cadenas, que es como se arman las frases.
*/

/** La nota que queda `semitonos` y `pasos` letras por encima de `raiz`. */
function escribe(raiz: string, semitonos: number, pasos: number): string {
  return spelledName(spellAbove(parseSpelledName(raiz), semitonos, pasos));
}

/** La tónica como la escribe su tonalidad: Bb mayor, no A# mayor. */
function tonicaDe(tonic: PitchClass, mode: KeyMode): string {
  return spelledName(keyTonic(tonic, mode));
}

/** Los siete grados de la escala, una letra por grado. */
function gradosEscritos(tonic: PitchClass, mode: KeyMode): string[] {
  return keyScale(tonic, mode).map(spelledName);
}

/** El mismo cifrado con la fundamental bien escrita: `E#dim` y no `Fdim`. */
function conFundamental(symbol: string, fundamental: string): string {
  return `${fundamental}${symbol.replace(/^[A-G][#b]?/, '')}`;
}

/** Las tríadas de la tonalidad, con su fundamental escrita por grado. */
function triadasDe(tonic: PitchClass, mode: KeyMode): DiatonicChord[] {
  const grados = gradosEscritos(tonic, mode);
  return diatonicTriads(tonic, scaleOf(mode), accidentalForKey(tonic, mode)).map(
    (triada, indice) => ({ ...triada, symbol: conFundamental(triada.symbol, grados[indice]!) }),
  );
}

/** Lo mismo con las cuatríadas. */
function cuatriadasDe(tonic: PitchClass, mode: KeyMode): SeventhChord[] {
  const grados = gradosEscritos(tonic, mode);
  return diatonicSevenths(tonic, scaleOf(mode), accidentalForKey(tonic, mode)).map(
    (cuatriada, indice) => ({
      ...cuatriada,
      symbol: conFundamental(cuatriada.symbol, grados[indice]!),
    }),
  );
}

/** Las notas del acorde de ese grado, apiladas por terceras de la escala: «C E G». */
function notasDelGrado(grados: readonly string[], grado: number, cuantas = 3): string[] {
  return Array.from({ length: cuantas }, (_, salto) => grados[(grado + salto * 2) % 7]!);
}

/** Fundamental, tercera y quinta del acorde de ese grado. */
function tresNotas(grados: readonly string[], grado: number): [string, string, string] {
  const [fundamental, tercera, quinta] = notasDelGrado(grados, grado);
  return [fundamental!, tercera!, quinta!];
}

/** Las notas que comparten dos acordes, en el orden del primero. */
function comunes(una: readonly string[], otra: readonly string[]): string[] {
  return una.filter((nota) => otra.includes(nota));
}

/** «C, F y G»: una lista como se dice. */
function enumera(cosas: readonly string[]): string {
  return cosas.length < 2
    ? cosas.join('')
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/** «G mayor», con la tónica escrita como se le pida. */
function tonalidad(tonica: string, mode: KeyMode): string {
  return `${tonica} ${mode === 'major' ? 'mayor' : 'menor'}`;
}

function otroModo(mode: KeyMode): KeyMode {
  return mode === 'major' ? 'minor' : 'major';
}

function degreesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const first = triads[0]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const dominante = dominanteDe(tonic, mode);
  const sensible = escribe(tonica, 11, 6);
  const menor = triads.find((triad) => triad.quality === 'minor')!;
  // Un acorde mayor sobre el segundo grado no sale de ninguna de las dos
  // escalas: pide la cuarta subida, que no es de la tonalidad.
  const deFuera = grados[1]!;

  return {
    points: [
      `En ${keyName(tonic, mode)} los siete acordes son ${triads.map((triad) => `${triad.roman} ${triad.symbol}`).join(', ')}.`,
      'El número romano dice sobre qué grado de la escala se levanta el acorde. En mayúscula, el acorde es mayor; en minúscula, menor; en minúscula y con °, disminuido.',
      /*
        En menor el V tonal es el mayor de la armónica, y lo dice el punto
        siguiente. Este contaba los tonales con el v de la natural —Am, Dm y Em
        en La menor—, y la misma pantalla decía dos cosas distintas de cuál es el
        V. Con el V mayor las notas que se juntan son las de la armónica.
      */
      mode === 'major'
        ? `I, IV y V son los grados tonales: sostienen la tonalidad, y entre ${first.symbol}, ${fourth.symbol} y ${fifth.symbol} tienen las siete notas de la escala. El III y el VI son los modales: los que deciden si suena a mayor o a menor.`
        : `I, IV y V son los grados tonales: sostienen la tonalidad, y entre ${first.symbol}, ${fourth.symbol} y ${dominante.triada} tienen las siete notas de la menor armónica. El III y el VI son los modales: los que deciden si suena a mayor o a menor.`,
      // En menor el primero es el i, en minúscula, y el V que tira de verdad es
      // el mayor de la armónica: decir «el I» y señalar el v de la natural era
      // enseñar mal las dos cosas de las que va esta unidad.
      mode === 'major'
        ? `El I es la casa —${first.symbol}—, el V es el que tira hacia ella —${fifth.symbol}— y el IV es el que te aleja sin salirte —${fourth.symbol}—.`
        : `El i es la casa —${first.symbol}—, el V es el que tira hacia ella —en menor se toca mayor, ${dominante.triada}, con la sensible de la armónica— y el iv es el que te aleja sin salirte —${fourth.symbol}—.`,
    ],
    exercises: [
      {
        // En menor se pregunta por la escala natural, que es la que da los siete
        // acordes de la lista; la dominante mayor se pregunta dos más abajo.
        prompt:
          mode === 'major'
            ? `¿Cuál es el V grado de ${keyName(tonic, mode)}?`
            : `¿Qué acorde da el V grado de ${keyName(tonic, mode)} natural?`,
        choices: choices(fifth.symbol, [fourth.symbol, triads[5]!.symbol, triads[1]!.symbol]),
        why:
          mode === 'major'
            ? `El V es el acorde del quinto grado contando desde ${tonica}: ${fifth.symbol}.`
            : `El V es el acorde del quinto grado contando desde ${tonica}: ${fifth.symbol}, menor en la escala natural. Para cerrar se usa ${dominante.triada}, el de la armónica.`,
      },
      {
        prompt: `¿Qué grado es ${fourth.symbol} en ${keyName(tonic, mode)}?`,
        choices: choices(fourth.roman, [fifth.roman, triads[1]!.roman, triads[6]!.roman]),
        why: `${fourth.symbol} es el ${fourth.roman}: el cuarto grado de la tonalidad.`,
      },
      /*
        En menor la buena era el v de la escala natural, y ése es justo el que no
        tira: en La menor se contestaba «Em», sin sensible, y el `why` decía que
        pedía resolver al I «como en la cadencia de toda la vida». La que tira es
        la dominante mayor de la armónica, y el `Em` se queda como opción mala,
        que es la confusión que hay que deshacer.
      */
      mode === 'major'
        ? {
            prompt: `Estás en ${first.symbol} y quieres el acorde que más tira de vuelta a casa. ¿Cuál?`,
            choices: choices(fifth.symbol, [triads[2]!.symbol, fourth.symbol, triads[5]!.symbol]),
            why: `El V —${fifth.symbol}— es el que pide resolver al I: lleva ${sensible}, la sensible, a medio tono de ${tonica}.`,
          }
        : {
            prompt: `Estás en ${first.symbol} y quieres el acorde que más tira de vuelta a casa. ¿Cuál?`,
            choices: choices(dominante.triada, [fifth.symbol, fourth.symbol, triads[2]!.symbol]),
            why: `${dominante.triada}, el V mayor de la menor armónica: lleva ${sensible}, la sensible, a medio tono de ${tonica}. El ${fifth.symbol} de la natural no la tiene y tira mucho menos.`,
          },
      {
        prompt: `¿Por qué el ${menor.roman} de ${keyName(tonic, mode)} se escribe en minúscula?`,
        choices: choices(`Porque ${menor.symbol} es un acorde menor`, [
          'Porque es un grado menos importante',
          `Porque ${menor.symbol} va invertido`,
          `Porque ${menor.symbol} es disminuido`,
        ]),
        why: `La minúscula dice la especie: ${menor.symbol} tiene la tercera menor. Uno disminuido llevaría además el °, y uno mayor iría en mayúscula.`,
      },
      {
        prompt: '¿Cuáles son los grados tonales?',
        choices: choices('I, IV y V', ['III y VI', 'I, III y V', 'I, II y V']),
        why:
          mode === 'major'
            ? `Los que sostienen la tonalidad: con ${first.symbol}, ${fourth.symbol} y ${fifth.symbol} se armoniza cualquier nota de la escala de ${keyName(tonic, mode)}. El III y el VI son los modales.`
            : `Los que sostienen la tonalidad: con ${first.symbol}, ${fourth.symbol} y ${dominante.triada} se armoniza cualquier nota de la menor armónica de ${keyName(tonic, mode)}. El III y el VI son los modales.`,
      },
      {
        prompt: `¿Cuál de estos acordes no sale de la escala de ${keyName(tonic, mode)}?`,
        choices: choices(deFuera, [triads[1]!.symbol, triads[5]!.symbol, triads[2]!.symbol]),
        why: `Sobre el segundo grado la escala da ${triads[1]!.symbol}. ${deFuera} pide ${escribe(deFuera, 4, 2)} de tercera, y esa nota no está en ${keyName(tonic, mode)}.`,
      },
    ],
  };
}

function qualitiesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const notasDe = (triad: DiatonicChord) => tresNotas(grados, triad.degree - 1);
  const diminished = triads.find((triad) => triad.quality === 'diminished')!;
  const minor = triads.find((triad) => triad.quality === 'minor')!;
  const major = triads.find((triad) => triad.quality === 'major')!;
  const deEspecie = (quality: DiatonicChord['quality']) =>
    enumera(
      triads
        .filter((triad) => triad.quality === quality)
        .map((triad) => `${triad.symbol} (${triad.roman})`),
    );
  /*
    La aumentada no sale de la escala mayor ni de la menor natural: sale del III
    de la menor armónica, que sube la séptima. En una tonalidad mayor es la de su
    relativa, y cae justo sobre la tónica: el III+ de La menor armónica es Caug.
  */
  const aumentada =
    mode === 'major'
      ? {
          notas: [tonica, escribe(tonica, 4, 2), escribe(tonica, 8, 4)],
          donde: `en el III de la menor armónica de su relativa, ${keyName(relativeMinor(tonic), 'minor')}`,
        }
      : {
          notas: [grados[2]!, grados[4]!, escribe(tonica, 11, 6)],
          donde: 'en el III de la menor armónica',
        };
  const aug = `${aumentada.notas[0]}aug`;
  const [m0, m1, m2] = notasDe(minor);
  const [d0, , d2] = notasDe(diminished);
  const [M0, M1, M2] = notasDe(major);
  const [f0, f1, f2] = notasDe(triads[0]!);

  return {
    points: [
      `Una tríada son tres notas apiladas por terceras: la fundamental, que le da el nombre, la tercera y la quinta. ${triads[0]!.symbol} = ${f0}, ${f1} y ${f2}.`,
      'La especie la deciden sus dos terceras. Mayor: una mayor y encima una menor (4 + 3 semitonos). Menor: una menor y encima una mayor (3 + 4). Disminuida: dos menores (3 + 3), con la quinta disminuida. Aumentada: dos mayores (4 + 4), con la quinta aumentada.',
      `En ${keyName(tonic, mode)} son mayores ${deEspecie('major')}; menores, ${deEspecie('minor')}, y disminuida, ${deEspecie('diminished')}.`,
      `La aumentada no sale en la escala ${mode === 'major' ? 'mayor' : 'menor natural'}: aparece ${aumentada.donde}, ${aug} = ${aumentada.notas.join(', ')}.`,
    ],
    exercises: [
      {
        prompt: `¿De qué especie es la tríada ${minor.symbol}?`,
        choices: choices('Menor', ['Mayor', 'Disminuida', 'Aumentada']),
        why: `${minor.symbol} = ${m0}, ${m1}, ${m2}: de ${m0} a ${m1} hay una tercera menor (tres semitonos) y de ${m1} a ${m2}, una mayor (cuatro). Es menor.`,
      },
      /*
        Preguntaba cuál «no se sostiene solo y pide resolver», y entre las malas
        está el V, que es justo el acorde que más pide resolver: quien lo
        elegía razonando por la función fallaba sabiendo armonía. Lo que tiene el
        disminuido y no tienen los otros es una disonancia dentro, y eso no
        depende de lo que venga antes ni después.
      */
      {
        prompt: '¿Cuál de estas tríadas es disonante por sí misma, aunque suene sola?',
        choices: choices(diminished.symbol, [major.symbol, minor.symbol, triads[4]!.symbol]),
        why: `${diminished.symbol} es disminuida: dos terceras menores, y su quinta, ${d0}–${d2}, es disminuida, un tritono. Por eso suena a tensión sin resolver.`,
      },
      /*
        Aquí se preguntaba por la cuatríada del V, y eso es de un curso que
        todavía no ha llegado: esta unidad es de cuarto de Elemental y las
        séptimas se estudian en tercero de Profesional. Lo que la unidad promete
        es qué especie sale sobre cada grado, y eso es lo que se pregunta.
      */
      {
        prompt: `En ${keyName(tonic, mode)}, ¿sobre qué grados salen tríadas mayores?`,
        choices:
          mode === 'major'
            ? choices('I, IV y V', ['II, III y VI', 'III, VI y VII', 'I, V y VII'])
            : choices('III, VI y VII', ['I, IV y V', 'II, III y VI', 'I, V y VII']),
        why:
          mode === 'major'
            ? `Apilando terceras de la escala salen mayores ${deEspecie('major')}. Los menores son ii, iii y vi, y el vii, disminuido.`
            : `Apilando terceras de la menor natural salen mayores ${deEspecie('major')}. Los menores son i, iv y v, y el ii, disminuido.`,
      },
      {
        prompt: '¿Qué terceras forman una tríada aumentada?',
        choices: choices('Dos terceras mayores', [
          'Dos terceras menores',
          'Una mayor y encima una menor',
          'Una menor y encima una mayor',
        ]),
        why: `Dos mayores, 4 + 4 semitonos, y la quinta queda aumentada: ${aug} = ${aumentada.notas.join(', ')}. No sale en la escala mayor ni en la menor natural; sí en el III de la menor armónica.`,
      },
      {
        prompt: `${major.symbol} es mayor. ¿Cómo están apiladas sus terceras, de abajo arriba?`,
        choices: choices('Una mayor y encima una menor', [
          'Una menor y encima una mayor',
          'Dos terceras mayores',
          'Dos terceras menores',
        ]),
        why: `${M0}–${M1} es una tercera mayor (cuatro semitonos) y ${M1}–${M2}, una menor (tres). Juntas dan la quinta justa ${M0}–${M2}.`,
      },
      {
        prompt: `En ${triads[0]!.symbol} —${f0}, ${f1}, ${f2}—, ¿cuál es la quinta?`,
        choices: choices(f2, [f0, f1, grados[3]!]),
        why: `${f2}: la fundamental es ${f0}, que le da el nombre; ${f1} está una tercera por encima, y ${f2}, otra tercera más arriba, a una quinta de ${f0}.`,
      },
    ],
  };
}

/** El orden fijo de las alteraciones, como se recita en el conservatorio. */
const ORDEN_DE_SOSTENIDOS = 'Fa, Do, Sol, Re, La, Mi, Si';
const ORDEN_DE_BEMOLES = 'Si, Mi, La, Re, Sol, Do, Fa';

function circleLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const relative =
    mode === 'major'
      ? { tonic: relativeMinor(tonic), mode: 'minor' as const }
      : { tonic: relativeMajor(tonic), mode: 'major' as const };
  const fifthUp = up(tonic, 7);
  const fifthDown = up(tonic, 5);
  /*
    Las vecinas se escriben con la alteración de **esta** tonalidad, no con la
    suya. Con `keyName`, la vecina de arriba de F# mayor salía «Db mayor»: suena
    igual, pero una quinta por encima de Fa# es Do#, y es la pregunta que se
    estaba haciendo.
  */
  const vecina = (nota: PitchClass, modo: KeyMode = mode) =>
    tonalidad(noteName(nota, accidental), modo);
  /*
    La armadura de la **tonalidad**, no la posición de su nota en la rueda.

    Aquí se preguntaba por `circlePosition(tonic)`, y eso es otra cosa: la nota
    La está en la mitad de sostenidos de la rueda, pero La **menor** no lleva
    ninguna alteración. De las veinticuatro tonalidades, ocho contestaban mal
    —entre ellas Do mayor y La menor, que son con las que arranca la aplicación—,
    y a quien acertaba se le decía que no.
  */
  const firma = keySignature(tonic, mode);
  const armadura =
    firma.letters.length === 0
      ? 'Sin alteraciones'
      : firma.accidental === 'sharp'
        ? 'Con sostenidos'
        : 'Con bemoles';
  const otras = ['Sin alteraciones', 'Con sostenidos', 'Con bemoles', 'Con los dos'].filter(
    (opcion) => opcion !== armadura,
  );
  const signo = firma.accidental === 'sharp' ? '#' : 'b';
  const cuantas = firma.letters.length;
  // «Un bemol», no «1 bemol»: se lee en voz alta, y así se dice.
  const lleva = `${cuantas === 1 ? 'un' : cuantas} ${firma.accidental === 'sharp' ? (cuantas === 1 ? 'sostenido' : 'sostenidos') : cuantas === 1 ? 'bemol' : 'bemoles'}: ${firma.letters.map((letra) => `${letra}${signo}`).join(', ')}`;
  const mayorDeLaArmadura = noteName(mode === 'major' ? tonic : relativeMajor(tonic), accidental);
  /*
    Cómo se sabe la tonalidad mirando la armadura, que es la regla que se
    aprende en el conservatorio: con sostenidos, medio tono por encima del
    último; con bemoles, el penúltimo, y con uno solo, Fa. La menor es la
    relativa, una tercera menor por debajo.
  */
  const comoSeSabe =
    cuantas === 0
      ? `Sin alteraciones solo hay dos: C mayor y su relativa, A menor.`
      : firma.accidental === 'sharp'
        ? `El último sostenido es ${firma.letters[cuantas - 1]}#, y medio tono por encima está ${mayorDeLaArmadura}: ${mayorDeLaArmadura} mayor.`
        : cuantas === 1
          ? 'Con un solo bemol, Bb, es F mayor.'
          : `El penúltimo bemol, ${firma.letters[cuantas - 2]}b, es la tónica: ${mayorDeLaArmadura} mayor.`;
  const homonimaDeEsta = homonima(tonic, mode);
  const yLaMenor =
    mode === 'minor' && cuantas > 0
      ? ` ${keyName(tonic, mode)} es su relativa, una tercera menor por debajo.`
      : '';

  return {
    points: [
      `La armadura son las alteraciones que van al principio de cada pentagrama y valen para toda la obra. Los sostenidos entran siempre en este orden: ${ORDEN_DE_SOSTENIDOS}. Los bemoles, al revés: ${ORDEN_DE_BEMOLES}.`,
      `${keyName(tonic, mode)} ${cuantas === 0 ? 'no lleva alteraciones' : `lleva ${lleva}`}. Para saber la tonalidad: con sostenidos, la mayor está medio tono por encima del último; con bemoles, es el penúltimo —con uno solo, Fa mayor—. La menor, una tercera menor por debajo de su mayor.`,
      `La rueda ordena las tonalidades por quintas: cada paso a la derecha añade un sostenido o quita un bemol. ${keyName(tonic, mode)} tiene al lado ${vecina(fifthUp)} y ${vecina(fifthDown)}, que se diferencian de ella en una sola alteración.`,
      `Su relativa es ${keyName(relative.tonic, relative.mode)}: la misma armadura con otro centro. La menor está una tercera menor por debajo de su relativa mayor.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es la relativa de ${keyName(tonic, mode)}?`,
        choices: choices(keyName(relative.tonic, relative.mode), [
          keyName(fifthUp, otroModo(mode)),
          keyName(fifthDown, otroModo(mode)),
          homonimaDeEsta.nombre,
        ]),
        why: `${keyName(relative.tonic, relative.mode)} tiene la misma armadura y las mismas notas: cambia dónde está la casa. ${homonimaDeEsta.nombre} tiene la misma tónica, pero es otra tonalidad.${homonimaDeEsta.aclaracion}`,
      },
      /*
        La pregunta era por una tonalidad y las opciones eran notas sueltas: en La
        menor se contestaba «E» cuando la vecina es «E menor». Ahora se contesta
        con la tonalidad entera, y en el mismo modo.
      */
      {
        prompt: `Desde ${keyName(tonic, mode)}, ¿qué tonalidad está una quinta arriba?`,
        choices: choices(vecina(fifthUp), [
          vecina(fifthDown),
          // Las malas, como las escribe la rueda: una tonalidad de nueve
          // sostenidos no la ha visto nadie, y no se le puede pedir a nadie que
          // la descarte por absurda.
          keyName(up(tonic, 2), mode),
          keyName(up(tonic, 4), mode),
        ]),
        why: `Una quinta justa son siete semitonos: de ${noteName(tonic, accidental)} se llega a ${noteName(fifthUp, accidental)}. En la rueda está justo a la derecha: un sostenido más o un bemol menos.`,
      },
      {
        prompt: `¿Con qué se escribe ${keyName(tonic, mode)}?`,
        choices: choices(armadura, otras),
        why:
          cuantas === 0
            ? 'No lleva ninguna: es el punto de partida de la rueda, y de ahí salen todas las demás.'
            : `Su armadura lleva ${lleva}.`,
      },
      firma.accidental === 'sharp'
        ? {
            prompt: '¿En qué orden entran los sostenidos en la armadura?',
            choices: choices(ORDEN_DE_SOSTENIDOS, [
              'Do, Sol, Re, La, Mi, Si, Fa',
              ORDEN_DE_BEMOLES,
              'Fa, Sol, La, Si, Do, Re, Mi',
            ]),
            why: `${ORDEN_DE_SOSTENIDOS} —en cifrado, F C G D A E B—: cada sostenido está una quinta por encima del anterior. ${keyName(tonic, mode)} ${cuantas === 0 ? 'no lleva ninguno' : `lleva ${lleva}`}.`,
          }
        : {
            prompt: '¿En qué orden entran los bemoles en la armadura?',
            choices: choices(ORDEN_DE_BEMOLES, [
              ORDEN_DE_SOSTENIDOS,
              'Fa, Si, Mi, La, Re, Sol, Do',
              'Si, La, Sol, Fa, Mi, Re, Do',
            ]),
            why: `${ORDEN_DE_BEMOLES} —en cifrado, B E A D G C F—: el de los sostenidos al revés, cada bemol una quinta por debajo del anterior. ${keyName(tonic, mode)} lleva ${lleva}.`,
          },
      {
        prompt: `Una armadura ${cuantas === 0 ? 'sin alteraciones' : `con ${lleva}`}. ¿De qué tonalidad ${mode === 'major' ? 'mayor' : 'menor'} es?`,
        choices: choices(keyName(tonic, mode), [
          keyName(fifthUp, mode),
          keyName(fifthDown, mode),
          keyName(up(tonic, 2), mode),
        ]),
        why: `${comoSeSabe}${yLaMenor}`,
      },
      {
        prompt: `Entre ${keyName(tonic, mode)} y ${vecina(fifthUp)}, ¿cuántas notas cambian?`,
        choices: choices('Una', ['Ninguna', 'Dos', 'Tres']),
        why: 'Una sola: cada paso por la rueda añade un sostenido o quita un bemol. Por eso son vecinas: comparten seis de sus siete notas.',
      },
    ],
  };
}

function borrowedLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const dominante = dominanteDe(tonic, mode);
  /*
    El modo paralelo se escribe con **la misma tónica**, letra incluida: es lo
    que lo define. `keyName` habría llamado «Db mayor» al paralelo de C# menor.
  */
  const paralelo = tonalidad(tonica, otroModo(mode));
  // Un grado rebajado se escribe con su letra aunque la tonalidad vaya de
  // sostenidos: el bVII de C es Bb, nunca A#, y el de Db es Cb.
  const flatSeven = escribe(tonica, 10, 6);
  const cuartoMayor = escribe(tonica, 5, 3);
  const cuartoMenor = `${cuartoMayor}m`;
  const sextaMenor = escribe(tonica, 8, 5);
  const sensible = escribe(tonica, 11, 6);
  /*
    El préstamo que se enseña **no es el mismo en los dos modos**, y antes lo era.

    En mayor, el préstamo de casa es el bVII, traído del menor. En menor eso no
    tiene sentido: el séptimo grado del menor natural **ya** está un tono por
    debajo de la tónica, así que se preguntaba por un acorde que la tonalidad ya
    tiene, y la respuesta buena salía además como opción mala. En diez de las
    doce tonalidades menores la misma opción aparecía dos veces, y quien pulsaba
    la otra fallaba con el acorde correcto en la mano.

    Después se enseñó como préstamo del menor la dominante **mayor**, y eso
    tampoco lo es: el V mayor no se toma del paralelo, es el de la propia
    tonalidad menor, que la armónica consigue subiendo el séptimo grado. Lo
    enseñan así los grados, las funciones y las cadencias, y esta lección decía
    lo contrario que las otras tres: que E se «presta» a La menor desde La mayor.

    El préstamo de verdad del menor es la **tónica mayor**, la tercera de
    picardía: cerrar en menor con la tercera de la homónima mayor. Es el que
    suena en la unidad de oído de este mismo curso, y el que no tiene otra
    explicación que el modo paralelo.
  */
  const terceraMayor = escribe(tonica, 4, 2);
  const prestado =
    mode === 'major'
      ? {
          symbol: flatSeven,
          punto: `En mayor se toman sobre todo los del menor: el iv menor —${cuartoMenor}, con la sexta rebajada— y el bVII —${flatSeven}—, que en rock es más normal que el propio vii°.`,
          prompt: `En ${keyName(tonic, mode)}, ¿qué acorde es el bVII?`,
          malas: [triads[6]!.symbol, triads[5]!.symbol, escribe(tonica, 11, 6)],
          why: `El bVII está un tono por debajo de la tónica: ${flatSeven}. Es el VII de ${paralelo}.`,
          nota: flatSeven,
          notasMalas: [escribe(tonica, 11, 6), escribe(tonica, 2, 1), cuartoMayor],
          porQueLaNota: `${flatSeven}: ${keyName(tonic, mode)} tiene ${escribe(tonica, 11, 6)}. Es el séptimo grado de ${paralelo}, y es lo que hace sonar a préstamo al ${flatSeven}.`,
        }
      : {
          symbol: tonica,
          punto: `En menor el préstamo va al revés: de ${paralelo} se toma sobre todo su tónica, ${tonica}, la de la tercera mayor. Terminar con ella una obra en menor es la tercera de picardía. La dominante mayor, ${dominante.triada}, no es un préstamo: es la de ${keyName(tonic, mode)}, que la armónica tiene subiendo la sensible.`,
          prompt: `En ${keyName(tonic, mode)}, ¿qué acorde se toma de ${paralelo} para terminar con la tercera de picardía?`,
          malas: [triads[0]!.symbol, dominante.triada, triads[2]!.symbol],
          why: `${tonica}: la misma tónica con la tercera mayor de ${paralelo}. ${dominante.triada} no se toma de ningún sitio, es la dominante de ${keyName(tonic, mode)} con la sensible de la armónica, y ${triads[2]!.symbol} es la relativa, que ya es de casa.`,
          nota: terceraMayor,
          notasMalas: [grados[2]!, grados[4]!, sensible],
          porQueLaNota: `${terceraMayor}, la tercera mayor: ${keyName(tonic, mode)} tiene ${grados[2]!} en sus tres escalas, la natural, la armónica y la melódica. ${terceraMayor} es la mediante de ${paralelo}, y es la nota que vuelve mayor la casa sin moverla de sitio.`,
        };

  return {
    points: [
      `El modo paralelo es el de la misma tónica: el de ${keyName(tonic, mode)} es ${paralelo} —en el conservatorio, tonalidades homónimas—. No es la relativa, que comparte las notas pero no la tónica.`,
      prestado.punto,
      'Intercambio modal es usar en una tonalidad acordes de su homónima. Que una nota se salga de la tonalidad no la convierte en un error: media música vive de eso.',
      // Las dominantes secundarias tienen su unidad: aquí solo se dice que existen.
      'Las dominantes secundarias también traen notas de fuera, pero son otra cosa: no se toman del paralelo, se fabrican para un grado.',
    ],
    exercises: [
      {
        prompt: prestado.prompt,
        choices: choices(prestado.symbol, prestado.malas),
        why: prestado.why,
      },
      /*
        Aquí se preguntaba por una dominante secundaria, que ahora tiene su
        propia unidad. Lo que esta promete y no preguntaba es el iv menor.
      */
      mode === 'major'
        ? {
            prompt: `En ${keyName(tonic, mode)}, ¿qué acorde es el iv menor que se toma de ${paralelo}?`,
            choices: choices(cuartoMenor, [cuartoMayor, triads[1]!.symbol, flatSeven]),
            why: `El IV de ${keyName(tonic, mode)} es ${cuartoMayor}; en ${paralelo} el cuarto grado es menor —${cuartoMayor}, ${sextaMenor}, ${tonica}— y trae ${sextaMenor}, la sexta rebajada. Suena más oscuro, y ${cuartoMenor} → ${triads[0]!.symbol} es la plagal menor.`,
          }
        : {
            prompt: `En ${paralelo}, ¿qué acorde de ${keyName(tonic, mode)} se toma prestado como iv menor?`,
            choices: choices(cuartoMenor, [cuartoMayor, `${grados[1]!}m`, triads[6]!.symbol]),
            why: `${cuartoMenor} es tu iv. En ${paralelo} el IV es ${cuartoMayor}, y una canción en ${paralelo} que toca ${cuartoMenor} lo está tomando de aquí: trae ${sextaMenor}, la sexta menor.`,
          },
      {
        prompt: 'Un acorde con una nota de fuera de la tonalidad, ¿qué es?',
        choices: choices('Depende de si tiene un uso conocido', [
          'Siempre un error',
          'Siempre válido',
          'Solo vale en jazz',
        ]),
        why: 'Lo que separa un color de un choque es si ese acorde tiene un uso reconocido —un préstamo del paralelo, una dominante secundaria—, no si se sale.',
      },
      {
        prompt: `¿Cuál es el modo paralelo de ${keyName(tonic, mode)}?`,
        choices: choices(paralelo, [
          keyName(relativaDe(tonic, mode), otroModo(mode)),
          keyName(up(tonic, 7), otroModo(mode)),
          keyName(up(tonic, 5), otroModo(mode)),
        ]),
        why: `El de la misma tónica con el otro modo: ${paralelo}. No es la relativa, ${keyName(relativaDe(tonic, mode), otroModo(mode))}, que comparte las notas pero no la tónica. Del paralelo salen los préstamos.`,
      },
      {
        // «Trae el acorde»: en menor el prestado es la tónica, y «¿qué nota de
        // fuera de A menor trae A?» se leía como si A fuera una nota.
        prompt: `¿Qué nota de fuera de ${keyName(tonic, mode)} trae el acorde ${prestado.symbol}?`,
        choices: choices(prestado.nota, prestado.notasMalas),
        why: prestado.porQueLaNota,
      },
    ],
  };
}

/** La relativa de una tonalidad, sea del modo que sea. */
function relativaDe(tonic: PitchClass, mode: KeyMode): PitchClass {
  return mode === 'major' ? relativeMinor(tonic) : relativeMajor(tonic);
}

/**
 * Pentatónicas y blues. Era «qué escala tocar» y se preguntaba por la mixolidia,
 * que es de la unidad de los modos; ahora va donde lo pone el temario, en
 * quinto de Profesional, con la teoría que ya se tiene para explicarlas.
 */
function scalesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const pentatonic = mode === 'major' ? 'majorPentatonic' : 'minorPentatonic';
  const otra = mode === 'major' ? 'minorPentatonic' : 'majorPentatonic';
  const nombre = SCALES[pentatonic].name.toLowerCase();
  /*
    La pentatónica es la escala de siete sin los dos grados que formaban sus
    semitonos: el IV y el VII en la mayor —E–F y B–C en Do—, el II y el VI en la
    menor —B–C y E–F en La—. Se saca de la escala ya escrita, así que sus notas
    se llaman como en la tonalidad.
  */
  const sinSemitonos =
    mode === 'major'
      ? {
          indices: [0, 1, 2, 4, 5],
          quitados: 'el IV y el VII',
          semitonos: [`${grados[2]}–${grados[3]}`, `${grados[6]}–${grados[0]}`],
        }
      : {
          indices: [0, 2, 3, 4, 6],
          quitados: 'el II y el VI',
          semitonos: [`${grados[1]}–${grados[2]}`, `${grados[4]}–${grados[5]}`],
        };
  const penta = sinSemitonos.indices.map((indice) => grados[indice]!).join(', ');
  // La relativa tiene la otra pentatónica con las mismas cinco notas.
  const relativa = mode === 'major' ? grados[5]! : grados[2]!;
  /*
    La nota de blues está a seis semitonos de la tónica y se llama quinta bemol,
    así que se escribe como quinta disminuida: Gb en Do, Eb en La. Salvo cuando
    eso pide un doble bemol —sobre Db, Eb y Ab—, que se escribe como cuarta
    aumentada. La regla y su porqué viven en `bluesNote`, porque la unidad de
    tocar la escala de blues la escribe también y tiene que decir la misma nota.
  */
  const sobreLaTonica = parseSpelledName(tonica);
  const quinta = spellAt(sobreLaTonica, 4, 6);
  // La de blues va sobre la tónica en los dos modos, con las letras de su menor.
  const blues = spellScaleOf(sobreLaTonica, 'blues').map(spelledName);
  const notaDeBlues = blues[3]!;
  const comoCuarta = notaDeBlues !== spelledName(quinta);
  const intervaloDeBlues = comoCuarta ? 'cuarta aumentada' : 'quinta disminuida';
  const suEnarmonico = comoCuarta ? 'quinta disminuida' : 'cuarta aumentada';
  // Las malas de «qué nota añade», sin dobles bemoles: en Db eran Ebb y Bbb, que
  // no se descartan por ser de otra escala sino por no saber leerlas.
  const sinDobles = (nombre: string) => {
    const nota = parseSpelledName(nombre);
    return Math.abs(nota.alter) >= 2
      ? spelledName(spellAt(nota, Math.sign(nota.alter), 0))
      : nombre;
  };
  const terceraMenor = escribe(tonica, 3, 2);
  const sextaMenor = sinDobles(escribe(tonica, 8, 5));
  const segundaMenor = sinDobles(escribe(tonica, 1, 1));
  // La nota que delata a la pentatónica del otro modo sobre la misma tónica.
  const deFuera = mode === 'major' ? escribe(tonica, 3, 2) : escribe(tonica, 4, 2);

  return {
    points: [
      `La ${nombre} de ${tonica} son cinco notas: ${penta}. Es la escala de ${keyName(tonic, mode)} sin ${sinSemitonos.quitados}, los dos grados que formaban sus semitonos —${enumera(sinSemitonos.semitonos)}—, así que entre sus notas no queda ninguno.`,
      `La ${SCALES[otra].name.toLowerCase()} de ${relativa} tiene esas mismas cinco notas empezando por otra: como con las tonalidades relativas, solo cambia el centro.`,
      `La escala de blues es la pentatónica menor con una nota más, a tres tonos de la tónica: la quinta disminuida, o la cuarta aumentada, que suena igual. Sobre ${tonica}: ${blues.join(', ')}; ${notaDeBlues} va de paso, entre la cuarta y la quinta.${comoCuarta ? ` Aquí se escribe como cuarta aumentada: como quinta disminuida sería ${spelledName(quinta)}, con doble bemol, y una nota de paso que sube se escribe como la de abajo alterada hacia arriba.` : ''}`,
      'Encima de una tonalidad mayor va su pentatónica mayor, y encima de una menor, su pentatónica menor: ninguna trae notas de fuera. Sobre un blues se toca la pentatónica menor o la de blues de la tónica aunque los acordes sean mayores, y ese roce con la tercera mayor es el color del género.',
    ],
    exercises: [
      {
        prompt: `¿Cuántas notas tiene la ${nombre}?`,
        choices: choices('Cinco', ['Seis', 'Siete', 'Ocho']),
        why: `Penta es cinco: ${penta}. Quita los dos grados que formaban los semitonos de la escala, y por eso no roza.`,
      },
      {
        prompt: `¿Qué pentatónica encaja encima de ${keyName(tonic, mode)} sin ninguna nota de fuera?`,
        choices: choices(`${SCALES[pentatonic].name} de ${tonica}`, [
          `${SCALES[otra].name} de ${tonica}`,
          `${SCALES[pentatonic].name} de ${escribe(tonica, 2, 1)}`,
          `${SCALES[pentatonic].name} de ${escribe(tonica, 10, 6)}`,
        ]),
        why: `La ${nombre} de ${tonica} —${penta}— sale de la propia escala de ${keyName(tonic, mode)}. La ${SCALES[otra].name.toLowerCase()} de ${tonica} trae ${deFuera}, que no es de la tonalidad.`,
      },
      /*
        La pregunta no decía cómo se escribe la nota, y sin letras un intervalo
        de seis semitonos es tanto una quinta disminuida como una cuarta
        aumentada: la respuesta buena dependía de una ortografía que no estaba en
        el enunciado. Ahora la nota va escrita, y la enarmónica es una de las
        malas, que es la trampa que enseña la unidad de intervalos.
      */
      {
        prompt: `Sobre ${tonica}, la escala de blues añade ${notaDeBlues} a la pentatónica menor. ¿Qué intervalo forma con la tónica?`,
        choices: choices(`Una ${intervaloDeBlues}`, [
          `Una ${suEnarmonico}`,
          'Una cuarta justa',
          'Una quinta justa',
        ]),
        why: `De ${tonica} a ${notaDeBlues} hay ${comoCuarta ? 'cuatro letras' : 'cinco letras'} y seis semitonos: una ${intervaloDeBlues}. La ${suEnarmonico} suena igual, pero abarca otro número de letras. Son tres tonos, el mismo tritono que tensa la dominante, y se toca de paso entre ${blues[2]} y ${blues[4]}.`,
      },
      {
        prompt: `En la ${nombre} de ${tonica} —${penta}—, ¿qué hay entre cada nota y la siguiente?`,
        choices: choices('Un tono o una tercera menor, nunca un semitono', [
          'Siempre un tono',
          'Siempre una tercera menor',
          'Un semitono entre la tercera y la cuarta nota',
        ]),
        why: `Al quitar ${sinSemitonos.quitados} se van los dos semitonos de la escala (${enumera(sinSemitonos.semitonos)}). Quedan tonos y terceras menores, y por eso no hay nota que roce.`,
      },
      {
        prompt: `¿Qué nota añade la escala de blues de ${tonica} a su pentatónica menor?`,
        choices: choices(notaDeBlues, [terceraMenor, sextaMenor, segundaMenor]),
        why: `${notaDeBlues}, la ${intervaloDeBlues}: ${blues.join(', ')}. ${terceraMenor} ya estaba en la pentatónica menor, y ${sextaMenor} y ${segundaMenor} no son de la de blues.`,
      },
      {
        prompt: `¿Qué ${SCALES[otra].name.toLowerCase()} tiene las mismas notas que la ${nombre} de ${tonica}?`,
        choices: choices(
          `La de ${relativa}`,
          mode === 'major'
            ? [`La de ${tonica}`, `La de ${grados[2]}`, `La de ${grados[1]}`]
            : [`La de ${tonica}`, `La de ${grados[4]}`, `La de ${grados[3]}`],
        ),
        why: `La de ${relativa}: son las mismas cinco notas —${penta}— con otro centro, igual que ${keyName(tonic, mode)} y su relativa.`,
      },
    ],
  };
}

/**
 * Funciones armónicas. Es la lección que le faltaba a la aplicación: la pantalla
 * de componer lleva las letras T, S y D desde que se reordenaron las
 * sugerencias, y hasta ahora no había dónde aprender qué significan.
 */
function functionsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const first = triads[0]!;
  const second = triads[1]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  const dominante = dominanteDe(tonic, mode);
  const sensible = escribe(tonica, 11, 6);
  const septima = escribe(tonica, 5, 3);
  const deTonica = comunes(notasDelGrado(grados, 0), notasDelGrado(grados, 5));
  const deSubdominante = comunes(notasDelGrado(grados, 3), notasDelGrado(grados, 1));
  // La dominante que aprieta: en menor, la mayor de la armónica.
  const quinto = mode === 'major' ? fifth.symbol : dominante.triada;

  return {
    points: [
      'Tres papeles y nada más: la tónica reposa, la subdominante sale de casa y la dominante aprieta para volver.',
      /*
        En menor se decía que aprietan el v y el VII de la natural, que son
        justo los que no tienen sensible. Los de dominante en menor son el V
        mayor y el vii° de la armónica, los dos con la séptima subida.
      */
      mode === 'major'
        ? `En ${keyName(tonic, mode)} reposan ${first.symbol}, ${triads[2]!.symbol} y ${sixth.symbol}; salen ${second.symbol} y ${fourth.symbol}; y aprietan ${fifth.symbol} y ${triads[6]!.symbol}.`
        : `En ${keyName(tonic, mode)} reposan ${first.symbol}, ${triads[2]!.symbol} y ${sixth.symbol}; salen ${second.symbol} y ${fourth.symbol}; y aprietan ${dominante.triada} y ${sensible}dim, los de la menor armónica, que sube el séptimo grado.`,
      `No es una etiqueta puesta a dedo: ${first.symbol} y ${sixth.symbol} comparten ${enumera(deTonica)}, y por eso el VI puede hacer de tónica. Y ${second.symbol} comparte ${enumera(deSubdominante)} con ${fourth.symbol}: el II hace de subdominante.`,
      /*
        «La dominante es la única que lleva el tritono» no era verdad: la tríada
        del V no lo tiene —le falta la séptima— y el vii° sí. Lo que lo llevan
        son los acordes de función de dominante.
      */
      mode === 'major'
        ? `El tritono —${sensible}–${septima}— solo lo llevan los acordes de dominante: ${dominante.cuatriada}, en cuanto lleva la séptima, y ${triads[6]!.symbol}. Ahí está su prisa por resolver.`
        : `En el menor natural ${fifth.symbol} no tiene ni sensible ni tritono. La dominante se trae del menor armónico: ${dominante.cuatriada} lleva ${sensible}–${septima}, el tritono, y por eso aprieta.`,
    ],
    exercises: [
      {
        prompt: `¿Qué papel hace ${quinto} en ${keyName(tonic, mode)}?`,
        choices: choices('Dominante: aprieta y pide volver a la tónica', [
          'Tónica: es donde la frase reposa',
          'Subdominante: sale de casa sin tensión',
          'Ninguno: está fuera de la tonalidad',
        ]),
        why:
          mode === 'major'
            ? `${fifth.symbol} es el V. Lleva el tritono con la séptima y es el que más tira hacia ${first.symbol}.`
            : // «Con la séptima de la escala subida» se leía como la séptima del
              // acorde, que es otra cosa y en la tríada no está.
              `${dominante.triada} es el V con el séptimo grado de la escala subido —${sensible}, la sensible— y es el que tira hacia ${first.symbol}. El ${fifth.symbol} de la natural hace el mismo papel, mucho más flojo.`,
      },
      {
        prompt: `¿Cuál de estos reposa igual que ${first.symbol}?`,
        choices: choices(sixth.symbol, [fourth.symbol, fifth.symbol, second.symbol]),
        // El relativo de una mayor es su sexto grado; el de una menor es el
        // tercero, así que en menor esto nombraba relativo a quien no lo es.
        why: `${sixth.symbol} comparte ${enumera(deTonica)} con ${first.symbol} y hace el mismo papel de reposo: es ${mode === 'major' ? 'su relativo' : 'el sexto grado'}.`,
      },
      {
        prompt: '¿Qué suele venir después de una subdominante?',
        choices: choices('La dominante', [
          'Otra subdominante, siempre',
          'Nada: la subdominante cierra la frase',
          'El acorde disminuido',
        ]),
        why: 'El camino de siempre es tónica, subdominante, dominante y vuelta a la tónica. La subdominante prepara la tensión.',
      },
      {
        prompt: 'Quieres terminar una frase de forma que suene cerrada. ¿En cuál la dejas?',
        // La dominante que aprieta, la misma que nombra el porqué: en menor la
        // opción era el v de la natural y el porqué hablaba del V mayor.
        choices: choices(first.symbol, [quinto, second.symbol, triads[6]!.symbol]),
        why: `Solo la tónica cierra. Dejarla en ${quinto} deja la frase preguntando.`,
      },
      {
        prompt: `¿Por qué ${second.symbol} puede hacer de subdominante en ${keyName(tonic, mode)}?`,
        choices: choices(`Porque comparte ${enumera(deSubdominante)} con ${fourth.symbol}`, [
          'Porque es un acorde menor',
          'Porque lleva la sensible',
          `Porque está una quinta por encima de ${first.symbol}`,
        ]),
        why: `${second.symbol} —${notasDelGrado(grados, 1).join(', ')}— y ${fourth.symbol} —${notasDelGrado(grados, 3).join(', ')}— comparten dos notas, y los dos salen de casa hacia la dominante: ${second.symbol} → ${quinto} hace lo mismo que ${fourth.symbol} → ${quinto}.`,
      },
      {
        prompt: `¿Entre qué dos notas de ${dominante.cuatriada} está el tritono?`,
        choices: choices(`${sensible} y ${septima}`, [
          `${grados[4]} y ${grados[1]}`,
          `${grados[4]} y ${sensible}`,
          `${grados[1]} y ${septima}`,
        ]),
        why: `${sensible}–${septima}: tres tonos, seis semitonos. ${sensible} es la sensible y sube a ${tonica}; ${septima} es la séptima y baja a ${grados[2]}. Esa doble atracción es la prisa de la dominante.`,
      },
    ],
  };
}

/** Cuatríadas: qué añade la séptima y por qué cada especie la cambia distinto. */
function seventhsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const sevenths = cuatriadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const first = sevenths[0]!;
  const fifth = sevenths[4]!;
  const second = sevenths[1]!;
  const dominante = dominanteDe(tonic, mode);
  /*
    Dos cosas que **no están en el mismo grado en los dos modos**, y aquí se
    daban por fijas.

    El semidisminuido es el vii en mayor y el ii en menor: preguntando siempre
    por el séptimo, en menor la pregunta decía que `G7` —una dominante de pleno
    derecho— lleva la quinta bemol.

    Y la cuatríada de séptima mayor es el I en mayor pero el III en menor: en La
    menor, `Am7` salía de ejemplo de «séptima mayor» siendo un menor con séptima
    menor.
  */
  const semidisminuido = mode === 'major' ? sevenths[6]! : second;
  const septimaMayor = mode === 'major' ? first : sevenths[2]!;
  // La menor séptima que se pregunta: el ii en mayor, el iv en menor.
  const menorSeptima = mode === 'major' ? second : sevenths[3]!;
  const notasDe = (chord: SeventhChord) => notasDelGrado(grados, chord.degree - 1, 4);
  /*
    La séptima disminuida no sale de la escala mayor ni de la menor natural: es
    el VII de la menor armónica, tres terceras menores desde la sensible. En
    mayor se toma de la homónima menor, y por eso es la misma en Do mayor y en
    Do menor: B, D, F, Ab.
  */
  const sensible = escribe(tonica, 11, 6);
  const disminuida = [
    sensible,
    escribe(tonica, 2, 1),
    escribe(tonica, 5, 3),
    escribe(tonica, 8, 5),
  ];
  const romanoBase = semidisminuido.roman.replace('ø7', '');

  return {
    points: [
      `Apilar una tercera más sobre cada grado da las cuatríadas: ${sevenths.map((chord) => chord.symbol).join(', ')}.`,
      'Cinco especies, por la tríada y la séptima que lleven, y así se cifran. Séptima mayor: tríada mayor y 7.ª mayor (maj7). De dominante: mayor y 7.ª menor (7). Menor: menor y 7.ª menor (m7). Semidisminuida: disminuida y 7.ª menor (m7b5, o ø7 en grados). Disminuida: disminuida y 7.ª disminuida (dim7, o °7).',
      `La séptima no es un adorno: en ${dominante.cuatriada} aparece el tritono, y eso es lo que le hace pedir resolver. Por eso ${septimaMayor.symbol} suena abierto y ${dominante.cuatriada} suena a que falta algo.`,
      mode === 'major'
        ? 'Un acorde de dominante solo hay uno en la tonalidad, y está sobre el quinto grado.'
        : // «No hay ninguno» a secas era falso: el VII7 del menor natural es de
          // la especie de dominante. Lo que no es es la dominante de esta tónica.
          `En el menor natural el V no aprieta: ${fifth.symbol} es menor. ${sevenths[6]!.symbol} tiene la forma de una dominante, pero es la de ${triads[2]!.symbol}, la relativa. La de verdad se trae del menor armónico subiendo la séptima: ${dominante.cuatriada}.`,
      mode === 'major'
        ? `La disminuida no sale de la escala mayor: es el vii°7 de ${tonalidad(tonica, 'minor')} armónica, que también se usa en mayor. ${sensible}dim7 = ${disminuida.join(', ')}: tres terceras menores.`
        : `La disminuida no sale de la menor natural: es el vii°7 de la armónica. ${sensible}dim7 = ${disminuida.join(', ')}: tres terceras menores.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál de estas cuatríadas aprieta como una dominante en ${keyName(tonic, mode)}?`,
        choices: choices(dominante.cuatriada, [
          first.symbol,
          second.symbol,
          // En menor la mejor opción mala es la cuatríada del quinto grado, que
          // es justo la que se confunde con la dominante; en mayor esa es la
          // buena, así que ahí entra el cuarto.
          mode === 'major' ? sevenths[3]!.symbol : fifth.symbol,
        ]),
        why:
          mode === 'major'
            ? `${dominante.cuatriada} está sobre el quinto grado y es la única con tercera mayor y séptima menor: eso es una dominante.`
            : `${dominante.cuatriada} es la única con tercera mayor y séptima menor. No sale del menor natural —${fifth.symbol} es menor—: se trae del menor armónico, que sube la séptima para tener sensible.`,
      },
      {
        prompt: `¿Qué le pasa a ${triads[0]!.symbol} cuando le añades la séptima de la tonalidad?`,
        choices: choices(`Se convierte en ${first.symbol}`, [
          `Se convierte en ${fifth.symbol}`,
          'Deja de ser el primer grado',
          'Cambia de mayor a menor',
        ]),
        why: `La séptima de la escala sobre ${triads[0]!.symbol} da ${first.symbol}: el mismo grado y el mismo papel, con una nota más.`,
      },
      /*
        «El disminuido entero llevaría la séptima también bemol» no lo dice nadie
        así: la semidisminuida ya tiene la séptima menor, y la disminuida la baja
        otro semitono más. En el conservatorio se llama séptima disminuida.
      */
      {
        prompt: `${semidisminuido.symbol} lleva la quinta bemol. ¿Cómo se llama esa especie?`,
        choices: choices('Semidisminuido', [
          'De séptima disminuida',
          'Menor con séptima mayor',
          'Aumentado',
        ]),
        why: `Semidisminuido: tríada disminuida y séptima menor, ${notasDe(semidisminuido).join(', ')}. El de séptima disminuida baja la séptima un semitono más —tres terceras menores— y se cifra °7; éste, ø7 o m7b5.${mode === 'major' ? ' Sobre el VII de la mayor también se le llama séptima de sensible.' : ''}`,
      },
      {
        prompt: `¿Qué especie es ${menorSeptima.symbol}?`,
        choices: choices('Menor: tríada menor y séptima menor', [
          'Séptima mayor: tríada mayor y séptima mayor',
          'De dominante: tríada mayor y séptima menor',
          'Semidisminuida: tríada disminuida y séptima menor',
        ]),
        why: `${menorSeptima.symbol} = ${notasDe(menorSeptima).join(', ')}: tríada menor y, encima, la séptima menor de ${notasDe(menorSeptima)[0]}. Se cifra m7.`,
      },
      {
        prompt: `¿Cómo está hecho ${sensible}dim7, el acorde de séptima disminuida?`,
        choices: choices('Tres terceras menores seguidas', [
          'Dos terceras menores y una mayor',
          'Una tercera mayor y dos menores',
          'Tres terceras mayores',
        ]),
        why: `${disminuida.join(', ')}: tres terceras menores, y la séptima ${sensible}–${disminuida[3]} es disminuida. Sale del VII de la menor armónica y se cifra °7 o dim7. Dos menores y una mayor es la semidisminuida; una mayor y dos menores, la de dominante.`,
      },
      {
        prompt: `¿Cómo se escribe en grados ${semidisminuido.symbol}?`,
        choices: choices(semidisminuido.roman, [
          `${romanoBase}°7`,
          `${romanoBase.toUpperCase()}7`,
          `${romanoBase}7`,
        ]),
        why: `${semidisminuido.roman}: minúscula porque la tríada es disminuida, y ø7 porque la séptima es menor. Con la séptima disminuida sería ${romanoBase}°7.`,
      },
    ],
  };
}

/** Sustituciones: por qué un acorde ocupa el sitio de otro. */
function substitutionsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const tonica = grados[0]!;
  const first = triads[0]!;
  const second = triads[1]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  const dominante = dominanteDe(tonic, mode);
  // La dominante que aprieta: en menor, la mayor de la armónica.
  const quinto = mode === 'major' ? fifth.symbol : dominante.triada;
  /*
    El bII se escribe con bemol aunque la tonalidad vaya de sostenidos, igual que
    el bVII: el sustituto tritonal de G7 en Do es Db7, nunca C#7. En Db mayor
    sería en rigor un Ebb7, y se escribe D7, que es como lo cifra todo el mundo:
    el sustituto se nombra por la nota que está a un tritono de la dominante.
  */
  const tritone = noteName(up(tonic, 1), 'flat');
  const deTonica = comunes(notasDelGrado(grados, 0), notasDelGrado(grados, 5));
  const deSubdominante = comunes(notasDelGrado(grados, 3), notasDelGrado(grados, 1));

  return {
    points: [
      'Dos acordes se pueden cambiar el uno por el otro cuando hacen el mismo papel y comparten notas. No hay más misterio.',
      `${sixth.symbol} va donde iría ${first.symbol}: comparten ${enumera(deTonica)} y el mismo reposo. Es el VI por el I.`,
      `${second.symbol} va donde iría ${fourth.symbol}: comparten ${enumera(deSubdominante)} y la misma salida. Es el II por el IV.`,
      `El sustituto tritonal es otra cosa: ${tritone}7 lleva el mismo tritono que ${dominante.cuatriada}, así que aprieta igual aunque la fundamental esté a un tritono.`,
    ],
    exercises: [
      {
        prompt: `Quieres cambiar ${first.symbol} por algo que repose igual pero suene menos obvio. ¿Cuál?`,
        choices: choices(sixth.symbol, [fifth.symbol, triads[6]!.symbol, second.symbol]),
        // En mayor el sexto grado **es** el relativo menor; en menor es el VI y
        // el relativo es otro —el III—, así que decirlo era falso en las doce.
        why: `${sixth.symbol} es ${mode === 'major' ? 'el relativo menor' : 'el sexto grado'}: comparte ${enumera(deTonica)} con ${first.symbol} y hace el mismo papel.`,
      },
      {
        prompt: '¿Qué comparten una dominante y su sustituto tritonal?',
        choices: choices('El tritono', [
          'La fundamental',
          'Las cuatro notas',
          'Nada: es una licencia sin explicación',
        ]),
        why: 'El tritono es simétrico: el mismo par de notas sirve a dos dominantes distintas, con la tercera de una haciendo de séptima de la otra. Por eso una puede ir por la otra.',
      },
      // En menor se preguntaba por el v de la natural, que no aprieta: la
      // comparación tiene sentido con la dominante de verdad.
      {
        prompt: `¿Se puede sustituir ${quinto} por ${fourth.symbol} sin más?`,
        choices: choices('No: uno aprieta y el otro no, hacen papeles distintos', [
          'Sí: los dos están en la tonalidad',
          'Sí: comparten dos notas',
          'Solo en modo menor',
        ]),
        why: `${quinto} es dominante y ${fourth.symbol} subdominante, y no comparten ni una nota. Estar en la tonalidad no basta: la sustitución va por función, no por vecindad.`,
      },
      {
        prompt: `¿Qué acorde puede ir donde iría ${fourth.symbol}?`,
        choices: choices(second.symbol, [quinto, triads[2]!.symbol, first.symbol]),
        why: `${second.symbol} —${notasDelGrado(grados, 1).join(', ')}— comparte ${enumera(deSubdominante)} con ${fourth.symbol}, y los dos preparan la dominante: es el II por el IV.`,
      },
      {
        prompt: '¿Qué hace falta para que un acorde sustituya a otro?',
        choices: choices('Que haga la misma función y comparta notas con él', [
          'Que esté en la misma tonalidad',
          'Que tenga la misma fundamental',
          'Que sea de la misma especie',
        ]),
        why: `Función y notas comunes. ${sixth.symbol} por ${first.symbol} funciona aunque uno sea mayor y el otro menor; ${fourth.symbol} por ${quinto} no, aunque los dos sean de la tonalidad.`,
      },
      {
        prompt: `¿Cuál es el sustituto tritonal de ${dominante.cuatriada}?`,
        choices: choices(`${tritone}7`, [
          `${escribe(tonica, 2, 1)}7`,
          `${escribe(tonica, 5, 3)}7`,
          `${noteName(up(tonic, 8), 'flat')}7`,
        ]),
        why: `${tritone} está a un tritono de ${dominante.triada}, y ${tritone}7 lleva las dos notas del tritono de ${dominante.cuatriada} con los papeles cambiados. Resuelve a ${first.symbol} con el bajo bajando medio tono.`,
      },
    ],
  };
}

/** Los siete modos, en el orden de los grados de la mayor de la que salen. */
const MODOS = ['jónico', 'dórico', 'frigio', 'lidio', 'mixolidio', 'eólico', 'locrio'] as const;

/** Modos: las mismas notas empezando por otro sitio. */
function modesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  /*
    Un modo se escribe con la armadura de **su mayor de origen**, no con la de la
    tonalidad en la que estás.

    El dórico de Do sale de Sib mayor, así que su tercera es Mib y su séptima
    Sib. Escritos con la alteración de Do mayor salían Re# y La#: suenan igual y
    no lo escribe nadie así, que es el mismo fallo que este proyecto ya arregló
    una vez con el bVII del lienzo. En Do, el frigio llegaba a tener cuatro notas
    mal escritas de siete.

    **La raíz también**, y no la de la tonalidad: mezclando las dos, cuatro
    tonalidades nombraban la misma nota de dos maneras dentro de la misma frase
    —«Dórico sobre Db: C# · D# · …»—, que es peor que elegir cualquiera de las
    dos.

    **Y cada grado con su letra**: con los doce nombres, el mixolidio de C# —que
    sale de F# mayor— escribía su tercera como «F», al lado del F# de su cuarta.

    Así que se prueban las dos maneras de llamar a la raíz y se queda la que
    menos alteraciones necesita: el mixolidio de Db (seis bemoles) y no el de C#
    (siete sostenidos). Si empatan, la de la tonalidad en la que estás: en Bb
    menor el frigio sale sobre Bb y no sobre A#, que tiene las mismas seis.
  */
  const escrito = (intervalos: readonly number[]) => {
    const deEstaTonalidad = tonicaDe(tonic, mode);
    const formas = [deEstaTonalidad, noteName(tonic, 'sharp'), noteName(tonic, 'flat')].map(
      (raiz) => {
        const notas = intervalos.map((semitonos, grado) => escribe(raiz, semitonos, grado));
        return { raiz, notas, alteraciones: notas.join('').replace(/[A-G]/g, '').length };
      },
    );
    // `sort` es estable: en un empate gana la primera, que es la de la tonalidad.
    const mejor = [...formas].sort((a, b) => a.alteraciones - b.alteraciones)[0]!;
    return { raiz: mejor.raiz, notas: mejor.notas.join(' · ') };
  };
  const dorico = escrito(SCALES.dorian.intervals);
  const mixolidio = escrito(SCALES.mixolydian.intervals);
  const frigio = escrito(SCALES.phrygian.intervals);
  // La mayor de la que salen los modos de la tonalidad en la que estás.
  const origen = mode === 'major' ? tonic : relativeMajor(tonic);
  const deOrigen = gradosEscritos(origen, 'major');

  return {
    points: [
      `Un modo son las siete notas de la escala mayor tomando otra como centro. Con las de ${keyName(origen, 'major')}: ${MODOS.map((modo, grado) => `${deOrigen[grado]} ${modo}`).join(', ')}.`,
      'Los mayores, con tercera mayor, son el jónico —la escala mayor—, el lidio —cuarta aumentada— y el mixolidio —séptima menor—. Los menores, el eólico —la menor natural—, el dórico —sexta mayor—, el frigio —segunda menor— y el locrio —segunda menor y quinta disminuida—. Esa nota es la característica de cada uno.',
      `Dórico sobre ${dorico.raiz}: ${dorico.notas}. Es un menor con la sexta mayor, así que suena menos triste.`,
      `Mixolidio sobre ${mixolidio.raiz}: ${mixolidio.notas}. Mayor con la séptima menor: de ahí sale el bVII del rock.`,
      `Frigio sobre ${frigio.raiz}: ${frigio.notas}. Menor con el segundo grado bemol, el semitono pegado a la tónica.`,
    ],
    exercises: [
      {
        prompt: '¿Qué distingue al dórico de la menor natural?',
        choices: choices('La sexta, que es mayor', [
          'La tercera, que es mayor',
          'La séptima, que es mayor',
          'Nada: son la misma escala',
        ]),
        why: 'Dórico y menor natural solo se diferencian en la sexta. Ese semitono es todo el color dórico.',
      },
      {
        prompt: '¿De qué modo sale el bVII que usa medio repertorio de rock?',
        choices: choices('Mixolidio', ['Frigio', 'Dórico', 'Lidio']),
        why: 'El mixolidio es mayor con séptima menor. Sobre esa séptima se arma el bVII, que vuelve a la tónica sin sensible.',
      },
      {
        prompt: '¿Cuál es el modo del semitono pegado encima de la tónica?',
        choices: choices('Frigio', ['Mixolidio', 'Dórico', 'Jónico']),
        why: 'El frigio tiene el segundo grado bemol: un semitono desde la tónica. Es el color del metal y del flamenco.',
      },
      {
        prompt: '¿Qué nota distingue al lidio de la escala mayor?',
        choices: choices('La cuarta, que es aumentada', [
          'La séptima, que es menor',
          'La segunda, que es menor',
          'La sexta, que es menor',
        ]),
        why: `Es la mayor con la cuarta subida medio tono. Con las notas de ${keyName(origen, 'major')} empieza en ${deOrigen[3]}, y su cuarta, ${deOrigen[6]}, está a tres tonos.`,
      },
      {
        prompt: '¿Cuáles son los modos mayores?',
        choices: choices('Jónico, lidio y mixolidio', [
          'Jónico, dórico y eólico',
          'Dórico, frigio y eólico',
          'Lidio, mixolidio y locrio',
        ]),
        why: 'Los tres con la tercera mayor: el jónico, que es la escala mayor, el lidio y el mixolidio. Los otros cuatro tienen la tercera menor.',
      },
      {
        prompt: `Con las notas de ${keyName(origen, 'major')}, ¿qué modo empieza en ${deOrigen[6]}?`,
        choices: choices('Locrio', ['Lidio', 'Frigio', 'Eólico']),
        why: `${deOrigen[6]} es el séptimo grado de ${keyName(origen, 'major')}, y de ahí sale el locrio: el único con la quinta disminuida —${deOrigen[6]}–${deOrigen[3]}—, así que su tónica no tiene una tríada estable.`,
      },
    ],
  };
}

/** Cadencias: cómo se cierra una frase, con los nombres del conservatorio. */
function cadencesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = triadasDe(tonic, mode);
  const grados = gradosEscritos(tonic, mode);
  const first = triads[0]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  /*
    La cadencia perfecta pide **la dominante**, y en menor esa no es el quinto
    grado de la escala.

    Aquí se escribía `Em a Am` «porque la sensible sube medio tono a la tónica»,
    y en La menor no hay tal sensible: el Em de la escala trae un Sol natural, a
    un tono entero de La. La que cierra es la mayor prestada del menor armónico,
    y es lo mismo que enseña la lección de intercambio modal.
  */
  const dominante = dominanteDe(tonic, mode);
  const V = dominante.triada;
  /*
    Y se llamaba «auténtica», que es como la llaman los libros en inglés. En el
    conservatorio español el V–I es **perfecta** si los dos acordes van en estado
    fundamental y la tónica está arriba, e **imperfecta** si no; y lo que se para
    en el V es una **semicadencia**. La unidad promete esos nombres, y la lección
    no tenía ni la imperfecta ni la semicadencia.

    La pregunta de la cadencia del rock, bVII–I, deja su sitio a la
    semicadencia: no es ninguna de las cinco, y el bVII ya se cuenta en los
    modos y en el intercambio modal.
  */

  return {
    points: [
      mode === 'major'
        ? `Cadencia perfecta: ${V} → ${first.symbol}, los dos en estado fundamental y con la tónica en la voz de arriba. Es la más conclusiva: la sensible sube medio tono a la tónica. En inglés se llama auténtica.`
        : `Cadencia perfecta: ${V} → ${first.symbol}, los dos en estado fundamental y con la tónica arriba, y con el V mayor de la armónica: el ${fifth.symbol} de la escala no tiene sensible que subir a la tónica. En inglés se llama auténtica.`,
      `Cadencia imperfecta: el mismo ${V} → ${first.symbol}, pero con alguno de los dos invertido o sin la tónica arriba. Cierra, con menos peso.`,
      `Cadencia plagal: ${fourth.symbol} → ${first.symbol}. Cierra, pero con menos empuje: no hay sensible que resolver.`,
      `Semicadencia: la frase se para en la dominante, ${V}, venga de ${first.symbol} o de ${fourth.symbol}. Suena a pregunta y pide otra frase que la conteste.`,
      `Cadencia rota: ${V} → ${sixth.symbol}. Prepara el cierre y no lo da: el VI comparte dos notas con la tónica y la sustituye.`,
    ],
    exercises: [
      {
        prompt: '¿Cuál de estas cierra con más fuerza?',
        choices: choices(`${V} → ${first.symbol}`, [
          `${fourth.symbol} → ${first.symbol}`,
          `${V} → ${sixth.symbol}`,
          `${first.symbol} → ${fourth.symbol}`,
        ]),
        why:
          mode === 'major'
            ? 'La perfecta, V → I: la sensible sube medio tono a la tónica y eso es lo que suena a punto final.'
            : `La perfecta, V → i, con el V mayor: la sensible sube medio tono a la tónica y eso es lo que suena a punto final. Con ${fifth.symbol} no la hay, y por eso cierra menos.`,
      },
      // «Se desvía al relativo» solo es verdad en mayor: en menor el VI no es
      // el relativo, que es el III.
      {
        prompt: `¿Cómo se llama ir de ${V} a ${sixth.symbol} en vez de a ${first.symbol}?`,
        choices: choices('Cadencia rota', ['Cadencia plagal', 'Cadencia perfecta', 'Semicadencia']),
        why: `Rota: la dominante prepara el cierre y se desvía al VI, ${sixth.symbol}, que comparte dos notas con ${first.symbol}. Deja la frase abierta a propósito.`,
      },
      {
        prompt: `Una frase acaba en ${V}, después de ${fourth.symbol}. ¿Qué cadencia hace?`,
        choices: choices('Semicadencia', ['Cadencia plagal', 'Cadencia perfecta', 'Cadencia rota']),
        why: `Se para en la dominante: es una semicadencia, suspensiva. La frase queda preguntando, y la siguiente suele contestarla con ${V} → ${first.symbol}.`,
      },
      {
        prompt: `¿Qué cadencia es ${fourth.symbol} → ${first.symbol}?`,
        choices: choices('Plagal', ['Perfecta', 'Imperfecta', 'Semicadencia']),
        why: `${fourth.roman} → ${first.roman}: la plagal. Cierra sin sensible, más suave; es la del «amén» del final de los himnos.`,
      },
      {
        prompt: `${V} → ${first.symbol}, pero con ${first.symbol} en primera inversión (${first.symbol}/${grados[2]}). ¿Qué cadencia es?`,
        choices: choices('Imperfecta', ['Perfecta', 'Rota', 'Plagal']),
        why: 'Para que sea perfecta los dos acordes van en estado fundamental y con la tónica en la voz de arriba. Con uno invertido, el mismo enlace es una cadencia imperfecta: cierra, pero con menos peso.',
      },
      {
        prompt: `¿Qué hace falta para que ${V} → ${first.symbol} sea una cadencia perfecta?`,
        choices: choices('Los dos en estado fundamental y la tónica en la voz de arriba', [
          'Que el V lleve la séptima',
          'Que vaya después del IV',
          'Que el I esté en primera inversión',
        ]),
        why: `Estado fundamental y la tónica arriba. La séptima la refuerza pero no hace falta, y venir del IV es lo más normal, no una condición. Si falta algo de eso, es imperfecta.`,
      },
    ],
  };
}

const BUILDERS: Readonly<Record<LessonId, (tonic: PitchClass, mode: KeyMode) => LessonNotes>> = {
  degrees: degreesLesson,
  qualities: qualitiesLesson,
  circle: circleLesson,
  borrowed: borrowedLesson,
  scales: scalesLesson,
  functions: functionsLesson,
  sevenths: seventhsLesson,
  substitutions: substitutionsLesson,
  modes: modesLesson,
  cadences: cadencesLesson,
  ...LECCIONES_DE_LENGUAJE,
  ...LECCIONES_DE_ARMONIA,
};

/**
 * La lección en tu tonalidad, con las opciones ya repartidas.
 *
 * El reparto se hace aquí, en la única puerta por la que salen las lecciones, y no
 * en cada uno de los cien ejercicios: escribirlos con la buena delante es lo que
 * los hace legibles, y quien lo haga mañana no tiene que acordarse de nada.
 */
export function lessonNotes(id: LessonId, tonic: PitchClass, mode: KeyMode): LessonNotes {
  const notes = BUILDERS[id](tonic, mode);
  return {
    ...notes,
    exercises: notes.exercises.map((exercise) => conOpcionesRepartidas(exercise)),
  };
}
