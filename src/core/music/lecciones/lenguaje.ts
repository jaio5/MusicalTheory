/**
 * Las lecciones de Lenguaje Musical: lo que se estudia en el grado elemental
 * antes de llegar a los acordes.
 *
 * Las notas van en cifrado anglosajón, como en el resto de la aplicación, pero
 * **con la letra de cada grado** (`spelling.ts`) y no con la tecla que suena.
 * Aquí es donde más importa: una lección que enseña que en una escala cada letra
 * sale una vez no puede escribir la séptima de F# mayor como F, ni la sensible de
 * G# menor como G. Las dos primeras dan también el nombre en castellano, porque
 * es donde se aprende que Sol y G son la misma nota.
 *
 * Lo que depende de la tonalidad se calcula en la de quien estudia; lo que no
 * —figuras, claves— cambia de ejemplo con ella, para que repetir la unidad en
 * otro tono no sea repetir la misma pantalla.
 */

import { keySignature, relativeMajor, relativeMinor } from '../circle-of-fifths';
import { keyName, type KeyMode } from '../keys';
import type { LessonNotes } from '../lessons';
import type { PitchClass } from '../notes';
import { SCALES } from '../scales';
import {
  intervalBetween,
  intervalName,
  intervalNumberName,
  invertInterval,
  keyScale,
  keyTonic,
  letterAt,
  LETTERS,
  spellAt,
  spelledName,
  spelledNote,
  spellScale,
  type Interval,
  type Letter,
  type SpelledNote,
} from '../spelling';
import { choices, homonima, up } from './comun';

type DeLenguaje = 'notas' | 'claves' | 'ritmo' | 'escalaMayor' | 'intervalos' | 'escalasMenores';

const SOLFEO: Readonly<Record<Letter, string>> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** «Sol (G)»: el nombre del conservatorio con la letra que usa la aplicación al lado. */
function conSolfeo(letter: Letter): string {
  return `${SOLFEO[letter]} (${letter})`;
}

const nombre = spelledName;

function serie(notas: readonly SpelledNote[]): string {
  return notas.map(spelledName).join(' · ');
}

/** Subiendo hasta la octava: la escala como se canta, con la tónica repetida arriba. */
function subiendo(notas: readonly SpelledNote[]): string {
  return serie([...notas, notas[0]!]);
}

/** Bajando desde la octava, que es como se lee la melódica de vuelta. */
function bajando(notas: readonly SpelledNote[]): string {
  return serie([notas[0]!, ...notas.slice(1).reverse(), notas[0]!]);
}

function mayuscula(texto: string): string {
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

/** La misma letra, movida `cuanto` semitonos: alterar no cambia el nombre de la nota. */
function alterar(nota: SpelledNote, cuanto: number): SpelledNote {
  return spelledNote(nota.letter, nota.alter + cuanto);
}

/*
  La alteración que se pone de ejemplo es la **última** de la armadura, no la
  primera: la primera es siempre F# o Bb, y así cada tonalidad enseña la suya.
  En las de sostenidos es la sensible de la mayor (C# en D mayor, E# en F#
  mayor) y en las de bemoles el cuarto grado (Eb en Bb mayor). Do mayor y La
  menor no llevan ninguna: en Do vale F#, la primera que aparece en la rueda, y
  en La menor G#, la sensible que le pone su escala armónica.
*/
function alteracionDeEjemplo(tonic: PitchClass, mode: KeyMode) {
  const firma = keySignature(tonic, mode);
  const ultima = firma.letters[firma.letters.length - 1] as Letter | undefined;
  return {
    enArmadura: ultima !== undefined,
    nota:
      ultima === undefined
        ? spelledNote(mode === 'major' ? 'F' : 'G', 1)
        : spelledNote(ultima, firma.accidental === 'sharp' ? 1 : -1),
  };
}

function notasLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const clave = keyName(tonic, mode);
  const tonica = keyTonic(tonic, mode);
  const escala = keyScale(tonic, mode);
  const { enArmadura, nota: alterada } = alteracionDeEjemplo(tonic, mode);
  const sube = alterada.alter > 0;
  const signo = sube ? 'sostenido' : 'bemol';
  const natural = spelledNote(alterada.letter);
  const opuesta = spelledNote(alterada.letter, -alterada.alter);
  // La misma tecla con la letra de al lado: de F#, Gb; de E#, F; de Bb, A#.
  const enarmonica = spellAt(alterada, sube ? 1 : -1, 0);
  const ocupante = escala.find((nota) => nota.letter === enarmonica.letter)!;
  // El semitono de la escala que no se ve en el mástil: III-IV en mayor y II-III
  // en menor. Son dos letras distintas, así que es diatónico.
  const [desde, hasta] = mode === 'major' ? [escala[2]!, escala[3]!] : [escala[1]!, escala[2]!];
  const siguiente = letterAt(tonica.letter, 1);

  return {
    points: [
      'Las notas son siete y van siempre en el mismo orden: Do, Re, Mi, Fa, Sol, La y Si. Después de Si vuelve Do, una octava más aguda. En cifrado anglosajón, que es como las escribe esta aplicación, son C, D, E, F, G, A y B.',
      'El sostenido (#) sube la nota un semitono; el bemol (b) la baja un semitono, y el becuadro anula la alteración y la deja natural. Una alteración escrita en el compás vale hasta la barra. El doble sostenido (##) y el doble bemol (bb) la mueven un tono entero.',
      'El semitono es la distancia más corta —de un traste al siguiente— y el tono son dos semitonos. Entre las notas naturales casi todo son tonos: los dos semitonos están entre Mi y Fa (E-F) y entre Si y Do (B-C).',
      `El semitono es diatónico si une dos notas de nombre distinto, como ${nombre(desde)}–${nombre(hasta)} en ${clave}, y cromático si es la misma nota alterada, como ${nombre(natural)}–${nombre(alterada)}.`,
      enArmadura
        ? `Dos notas son enarmónicas cuando suenan igual y se escriben distinto: ${nombre(alterada)} y ${nombre(enarmonica)}. Cuál se escribe lo decide la tonalidad: ${clave} lleva ${nombre(alterada)}.`
        : `Dos notas son enarmónicas cuando suenan igual y se escriben distinto: ${nombre(alterada)} y ${nombre(enarmonica)}. ${clave} no lleva ninguna en la armadura; cuál se escribe en otras lo decide la tonalidad.`,
    ],
    exercises: [
      {
        prompt: `Subiendo desde ${conSolfeo(tonica.letter)}, ¿qué nota viene después?`,
        choices: choices(conSolfeo(siguiente), [
          conSolfeo(letterAt(tonica.letter, -1)),
          conSolfeo(letterAt(tonica.letter, 2)),
          conSolfeo(letterAt(tonica.letter, 3)),
        ]),
        why: `La serie es Do, Re, Mi, Fa, Sol, La, Si, y vuelve a empezar: después de ${SOLFEO[tonica.letter]} va ${SOLFEO[siguiente]}.`,
      },
      {
        prompt: `${nombre(alterada)} se lee «${SOLFEO[alterada.letter]} ${signo}». ¿Qué le hace el ${signo} a la nota?`,
        choices: sube
          ? choices('La sube un semitono', [
              'La baja un semitono',
              'La sube un tono',
              'La deja natural',
            ])
          : choices('La baja un semitono', [
              'La sube un semitono',
              'La baja un tono',
              'La deja natural',
            ]),
        why: `${nombre(alterada)} está un semitono ${sube ? 'por encima' : 'por debajo'} de ${nombre(natural)}. Lo que deja una nota natural es el becuadro, y lo que la mueve un tono, el doble ${signo}.`,
      },
      {
        prompt: enArmadura
          ? `En ${clave} la armadura pone ${nombre(alterada)}. Si esa nota lleva un becuadro delante, ¿qué suena?`
          : `En un compás aparece ${nombre(alterada)} y, más adelante en el mismo compás, esa nota con becuadro. ¿Qué suena?`,
        choices: choices(`${nombre(natural)}, natural`, [
          `${nombre(alterada)}: ${enArmadura ? 'manda la armadura' : 'lo alterado dura todo el compás'}`,
          `${nombre(opuesta)}: el becuadro hace lo contrario que el ${signo}`,
          `${nombre(enarmonica)}, que suena igual que ${nombre(alterada)}`,
        ]),
        why: `El becuadro anula la alteración, ${enArmadura ? 'también la de la armadura,' : 'la que sea,'} y deja la nota natural: ${nombre(natural)}, hasta el final del compás.`,
      },
      {
        prompt: 'Entre las notas naturales casi todo son tonos. ¿Dónde están los dos semitonos?',
        choices: choices('Mi-Fa y Si-Do', ['Do-Re y Fa-Sol', 'Mi-Fa y La-Si', 'Re-Mi y Sol-La']),
        why: 'Mi-Fa (E-F) y Si-Do (B-C) son las dos parejas de teclas blancas sin negra en medio. Todas las demás están a un tono.',
      },
      {
        prompt: `En ${clave}, ¿qué distancia hay de ${nombre(desde)} a ${nombre(hasta)}?`,
        choices: choices('Un semitono diatónico', [
          'Un semitono cromático',
          'Un tono',
          'Un tono y medio',
        ]),
        why: `De ${nombre(desde)} a ${nombre(hasta)} hay un semitono, y como cambia la letra es diatónico. El cromático no cambia de letra: ${nombre(natural)}–${nombre(alterada)}.`,
      },
      {
        prompt: `¿Qué nota es enarmónica de ${nombre(alterada)}?`,
        choices: choices(nombre(enarmonica), [
          nombre(opuesta),
          nombre(natural),
          nombre(spelledNote(enarmonica.letter, alterada.alter)),
        ]),
        why: enArmadura
          ? `${nombre(alterada)} y ${nombre(enarmonica)} son la misma tecla con dos nombres. ${clave} la escribe ${nombre(alterada)} porque la letra ${enarmonica.letter} ya la usa ${nombre(ocupante)}, y en una escala cada letra sale una sola vez.`
          : `${nombre(alterada)} y ${nombre(enarmonica)} son la misma tecla con dos nombres. Cuál se escribe lo decide la tonalidad: ${
              mode === 'major'
                ? 'G mayor lleva F#, y Db mayor, Gb.'
                : 'la armónica de A menor lleva G#, y Eb mayor, Ab.'
            }`,
      },
    ],
  };
}

/*
  Los sitios del pentagrama, de abajo arriba. La clave de sol pone el Sol en la
  segunda línea, así que la primera es Mi; la de fa pone el Fa en la cuarta, así
  que la primera es Sol. Por eso un mismo sitio se lee dos letras más arriba en
  clave de fa: la primera línea es Mi en sol y Sol en fa.
*/
const LUGARES = [
  'la primera línea',
  'el primer espacio',
  'la segunda línea',
  'el segundo espacio',
  'la tercera línea',
  'el tercer espacio',
  'la cuarta línea',
  'el cuarto espacio',
  'la quinta línea',
] as const;

function lugar(letter: Letter, primeraLinea: Letter): number {
  return (LETTERS.indexOf(letter) - LETTERS.indexOf(primeraLinea) + 7) % 7;
}

function clavesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const clave = keyName(tonic, mode);
  const tonica = keyTonic(tonic, mode);
  const enSol = lugar(tonica.letter, 'E');
  const enFa = lugar(tonica.letter, 'G');
  // La pregunta de la clave de fa va sobre la dominante, para no repetir letra.
  const dominante = letterAt(tonica.letter, 4);
  const sitio = lugar(dominante, 'G');
  const leidaEnSol = letterAt(dominante, -2);
  const alteracion =
    tonica.alter === 0
      ? ''
      : `; el ${tonica.alter > 0 ? 'sostenido' : 'bemol'} se escribe delante y no la mueve de sitio`;
  const doCentral =
    mode === 'major'
      ? {
          prompt: '¿Dónde se escribe el Do central (C4) en clave de sol?',
          choices: choices('En la primera línea adicional por debajo', [
            'En el tercer espacio',
            'En la primera línea adicional por encima',
            'Debajo de la primera línea',
          ]),
          why: 'El Do central queda justo entre las dos claves: una línea adicional por debajo de la de sol y una por encima de la de fa. El del tercer espacio es el Do de una octava más arriba (C5).',
        }
      : {
          prompt: '¿Dónde se escribe el Do central (C4) en clave de fa?',
          choices: choices('En la primera línea adicional por encima', [
            'En el segundo espacio',
            'En la primera línea adicional por debajo',
            'Encima de la quinta línea',
          ]),
          why: 'El Do central queda justo entre las dos claves: una línea adicional por encima de la de fa y una por debajo de la de sol. El del segundo espacio es el Do de una octava más abajo (C3).',
        };

  return {
    points: [
      'El pentagrama son cinco líneas y cuatro espacios, contados de abajo arriba. Cuanto más arriba, más aguda la nota; lo que no cabe se escribe en líneas adicionales, por encima o por debajo.',
      `La clave de sol en segunda línea dice que esa línea es Sol (G4). Desde ahí, las líneas son Mi, Sol, Si, Re y Fa, y los espacios, Fa, La, Do y Mi. La tónica de ${clave}, ${nombre(tonica)}, va en ${LUGARES[enSol]}.`,
      'La clave de fa en cuarta línea dice que esa línea es Fa (F3), por debajo del Do central. Sus líneas son Sol, Si, Re, Fa y La, y sus espacios, La, Do, Mi y Sol: el mismo sitio no es la misma nota en las dos claves.',
      'El Do central (C4) queda entre las dos: en la primera línea adicional por debajo en clave de sol, y en la primera por encima en clave de fa.',
      'La guitarra se escribe en clave de sol, pero suena una octava más grave de lo escrito. Su sexta cuerda al aire es E2, y escrita donde suena pediría la clave de fa o un puñado de líneas adicionales. A veces la clave lleva un 8 pequeño debajo que lo recuerda.',
    ],
    exercises: [
      {
        prompt: `La tónica de ${clave} es ${nombre(tonica)}. En clave de sol, ¿en qué sitio del pentagrama se escribe?`,
        choices: choices(`En ${LUGARES[enSol]}`, [
          `En ${LUGARES[enFa]}`,
          `En ${LUGARES[enSol + 1]}`,
          `En ${LUGARES[enSol + 2]}`,
        ]),
        why: `La clave de sol hace de la segunda línea un Sol, y contando desde ahí ${SOLFEO[tonica.letter]} cae en ${LUGARES[enSol]}${alteracion}. En ${LUGARES[enFa]} iría en clave de fa.`,
      },
      {
        prompt: `En clave de fa en cuarta línea, ¿qué nota va en ${LUGARES[sitio]}?`,
        choices: choices(conSolfeo(dominante), [
          conSolfeo(leidaEnSol),
          conSolfeo(letterAt(dominante, 1)),
          conSolfeo(letterAt(dominante, -1)),
        ]),
        why: `La clave de fa hace de la cuarta línea un Fa, y contando desde ahí en ${LUGARES[sitio]} va ${SOLFEO[dominante]}. En clave de sol ese sitio sería ${SOLFEO[leidaEnSol]}: leer una clave con la otra es el error de siempre.`,
      },
      {
        prompt: '¿Cómo es el pentagrama?',
        choices: choices('Cinco líneas y cuatro espacios, contados de abajo arriba', [
          'Cinco líneas y cuatro espacios, contados de arriba abajo',
          'Cuatro líneas y cinco espacios, contados de abajo arriba',
          'Cinco líneas y seis espacios, contando los de fuera',
        ]),
        why: 'Cinco líneas dejan cuatro espacios entre ellas, y las dos cosas se cuentan desde abajo, que es lo grave. Lo que se sale se escribe en líneas adicionales.',
      },
      doCentral,
      {
        prompt: 'La guitarra se escribe en clave de sol. ¿Cómo suena lo escrito?',
        choices: choices('Una octava más grave', [
          'Tal como está escrito',
          'Una octava más aguda',
          'Una quinta más grave',
        ]),
        why: 'Se escribe una octava más alta para que quepa en la clave de sol sin un bosque de líneas adicionales. Lo que se lee como E4 en la primera línea suena E3.',
      },
      {
        prompt: 'La sexta cuerda al aire suena E2. ¿Dónde se escribe en una partitura de guitarra?',
        choices: choices('Debajo de la tercera línea adicional inferior', [
          'En la primera línea',
          'En la tercera línea adicional inferior',
          'En el cuarto espacio',
        ]),
        why: 'Se escribe una octava más alta, E3, y en clave de sol eso queda debajo de la tercera línea adicional: primera adicional Do, segunda La, tercera Fa, y debajo Mi.',
      },
    ],
  };
}

/** De la redonda a la semicorchea: cada una vale la mitad que la anterior. */
const FIGURAS = [
  { nombre: 'redonda', plural: 'redondas' },
  { nombre: 'blanca', plural: 'blancas' },
  { nombre: 'negra', plural: 'negras' },
  { nombre: 'corchea', plural: 'corcheas' },
  { nombre: 'semicorchea', plural: 'semicorcheas' },
] as const;

/** Las diez parejas de figura grande y pequeña, para preguntar por una distinta en cada tono. */
const PAREJAS = FIGURAS.flatMap((_, grande) =>
  FIGURAS.slice(grande + 1).map((__, i) => [grande, grande + 1 + i] as const),
);

const LIGADURAS = [
  { a: 'blanca', b: 'negra', total: 'tres negras' },
  { a: 'negra', b: 'corchea', total: 'tres corcheas' },
  { a: 'redonda', b: 'blanca', total: 'seis negras' },
] as const;

const COMPASES_SIMPLES = [
  { cifra: '2/4', partes: 'Dos', especie: 'binario' },
  { cifra: '3/4', partes: 'Tres', especie: 'ternario' },
  { cifra: '4/4', partes: 'Cuatro', especie: 'cuaternario' },
] as const;

// El ritmo no depende de la tonalidad, pero el ejemplo sí cambia con ella: si
// no, repetir la unidad en otro tono sería repetir la misma pantalla.
function ritmoLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const [grande, pequena] = PAREJAS[(tonic + (mode === 'minor' ? 5 : 0)) % PAREJAS.length]!;
  const pasos = pequena - grande;
  const caben = 2 ** pasos;
  // El modo también cuenta: si no, Do mayor y La menor —las dos con que arranca
  // la aplicación— daban las mismas tres preguntas.
  const vuelta = tonic + (mode === 'minor' ? 1 : 0);
  const conPuntillo = vuelta % 3;
  const mitad = FIGURAS[conPuntillo + 1]!;
  const ligadura = LIGADURAS[vuelta % 3]!;
  const compas = COMPASES_SIMPLES[(vuelta + 1) % 3]!;
  const silencio =
    mode === 'major'
      ? {
          prompt: 'El silencio que cuelga de la cuarta línea, ¿de qué figura es?',
          choices: choices('De redonda', ['De blanca', 'De negra', 'De corchea']),
        }
      : {
          prompt: 'El silencio que se apoya sobre la tercera línea, ¿de qué figura es?',
          choices: choices('De blanca', ['De redonda', 'De negra', 'De corchea']),
        };

  return {
    points: [
      'Las figuras se dividen siempre por la mitad: la redonda vale cuatro negras; la blanca, dos; la negra, una; la corchea, media, y la semicorchea, un cuarto. Una redonda son dieciséis semicorcheas.',
      'Cada figura tiene su silencio, que dura lo mismo que ella. Los de redonda y blanca son el mismo rectángulo: el de redonda cuelga de la cuarta línea y el de blanca se apoya sobre la tercera.',
      'El puntillo suma a la figura la mitad de lo que vale: una negra con puntillo es una negra y una corchea. La ligadura une dos notas de la misma altura en un solo sonido, y es la manera de que una nota pase la barra de compás.',
      'En un compás simple cada parte se divide en dos. El número de arriba dice cuántas partes hay y el de abajo qué figura vale una, y el 4 es la negra: 2/4, 3/4 y 4/4 son dos, tres y cuatro partes de negra.',
      'En un compás compuesto cada parte se divide en tres, así que vale una figura con puntillo. El 6/8 son dos partes de negra con puntillo, de tres corcheas cada una: las mismas seis corcheas que el 3/4, agrupadas de otra manera.',
    ],
    exercises: [
      {
        prompt: `¿Cuántas ${FIGURAS[pequena]!.plural} caben en una ${FIGURAS[grande]!.nombre}?`,
        choices: choices(String(caben), [
          String(caben / 2),
          String(caben * 2),
          String((caben * 3) / 2),
        ]),
        why: `Cada figura vale la mitad que la anterior. De la ${FIGURAS[grande]!.nombre} a la ${FIGURAS[pequena]!.nombre} hay ${pasos === 1 ? 'un paso' : `${pasos} pasos`}, y en cada uno caben el doble: ${caben}.`,
      },
      {
        prompt: `¿Cuánto dura una ${FIGURAS[conPuntillo]!.nombre} con puntillo?`,
        choices: choices(`Tres ${mitad.plural}`, [
          `Dos ${mitad.plural}`,
          `Cuatro ${mitad.plural}`,
          `Tres ${FIGURAS[conPuntillo + 2]!.plural}`,
        ]),
        why: `Una ${FIGURAS[conPuntillo]!.nombre} son dos ${mitad.plural}, y el puntillo le suma la mitad de lo que vale: una ${mitad.nombre} más, tres en total.`,
      },
      {
        ...silencio,
        why: 'Los dos son el mismo rectángulo y se distinguen por el sitio: el de redonda cuelga de la cuarta línea y el de blanca se apoya sobre la tercera. Cada silencio dura lo mismo que su figura.',
      },
      {
        prompt: `Una ${ligadura.a} ligada a una ${ligadura.b} de la misma nota, ¿cómo se toca?`,
        choices: choices(`Un solo sonido que dura ${ligadura.total}`, [
          'Dos sonidos seguidos, sin cortar entre ellos',
          `Un solo sonido que dura lo que la ${ligadura.a}`,
          `Dos sonidos, y la ${ligadura.b} más suave`,
        ]),
        why: `La ligadura une dos notas de la misma altura: se ataca la primera y se sostiene ${ligadura.total}. Si las notas fueran distintas, la curva sería una ligadura de expresión, que pide tocarlas sin cortar.`,
      },
      {
        prompt: 'En un compás de 6/8, ¿cuántas partes hay y qué figura vale cada una?',
        choices: choices('Dos partes de negra con puntillo', [
          'Seis partes de corchea',
          'Tres partes de negra',
          'Dos partes de negra',
        ]),
        why: 'El 6/8 es compuesto: las seis corcheas se agrupan de tres en tres, así que son dos partes y cada una vale una negra con puntillo. Tres partes de negra sería el 3/4.',
      },
      {
        prompt: `¿Qué dice un compás de ${compas.cifra}?`,
        choices: choices(`${compas.partes} partes de negra: es simple ${compas.especie}`, [
          `${compas.partes} partes de corchea: es simple ${compas.especie}`,
          `${compas.partes} partes de blanca: es simple ${compas.especie}`,
          `${compas.partes} partes de negra con puntillo: es compuesto`,
        ]),
        why: `El número de arriba cuenta las partes y el de abajo dice qué figura vale una: el 4 es la negra, la redonda dividida en cuatro. Cada parte se divide en dos corcheas, y por eso es simple.`,
      },
    ],
  };
}

const NOMBRES_DE_GRADO = [
  'tónica',
  'supertónica',
  'mediante',
  'subdominante',
  'dominante',
  'superdominante',
  'sensible',
] as const;

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Cuántas alteraciones lleva una escala escrita, contando dos por cada doble. */
function alteraciones(notas: readonly SpelledNote[]): number {
  return notas.reduce((total, nota) => total + Math.abs(nota.alter), 0);
}

function escalaMayorLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  /*
    La mayor se estudia sobre **la misma tónica**, también en una tonalidad
    menor: es la de La en La menor, y no la de Do. La relativa ya la enseña la
    lección de las menores.

    Tres tónicas menores no se escriben igual en mayor: C#, G# y D# mayor
    necesitarían siete, ocho y nueve sostenidos —dobles incluidos—, y se escriben
    como Db, Ab y Eb, que suenan igual y llevan cinco, cuatro y tres bemoles. Se
    dice, porque si no el cambio de nombre parece una errata.
  */
  const clave = keyName(tonic, 'major');
  const tonica = keyTonic(tonic, 'major');
  const notas = spellScale(tonica, SCALES.major.intervals);
  const firma = keySignature(tonic, 'major');
  const tonicaMenor = keyTonic(tonic, mode);
  const enMenor =
    mode === 'major'
      ? ''
      : tonicaMenor.letter === tonica.letter
        ? `Tu tonalidad es menor; la mayor se estudia sobre la misma tónica: ${clave}. `
        : `Tu tonalidad es menor; la mayor se estudia sobre la misma tónica, que en mayor se escribe ${nombre(tonica)}: ${nombre(tonicaMenor)} mayor llevaría ${alteraciones(spellScale(tonicaMenor, SCALES.major.intervals))} sostenidos. `;
  const cuantas = firma.letters.length;
  const deSostenidos = firma.accidental === 'sharp';
  const grado = tonic % 7;
  const ejemplo = alteracionDeEjemplo(tonic, 'major').nota;
  /*
    Por qué hace falta la alteración: en las de sostenidos el que se altera el
    último es el VII, para quedar a un semitono de la tónica; en las de bemoles es
    el IV, para quedar a un semitono del III. Son los dos semitonos de la fórmula.
  */
  const porQue =
    cuantas === 0
      ? {
          prompt: `¿Por qué ${clave} no lleva ninguna alteración?`,
          choices: choices(
            'Porque sus semitonos naturales, E-F y B-C, caen donde la fórmula los pide',
            [
              'Porque es la primera escala que se estudia',
              'Porque todas las escalas mayores van sin alteraciones',
              'Porque empieza en la nota más grave',
            ],
          ),
          why: 'La fórmula pide los semitonos entre el III y el IV y entre el VII y la octava. Empezando en C son E-F y B-C, los dos semitonos que ya tienen las notas naturales.',
        }
      : deSostenidos
        ? {
            prompt: `En ${clave}, ¿por qué el VII es ${nombre(notas[6]!)} y no ${nombre(alterar(notas[6]!, -1))}?`,
            choices: choices(
              `Porque del VII a la tónica la fórmula pide un semitono, y de ${nombre(alterar(notas[6]!, -1))} a ${nombre(tonica)} hay un tono`,
              [
                'Para no repetir letra en la escala',
                'Porque toda escala mayor lleva al menos un sostenido',
                'Porque del VI al VII la fórmula pide un semitono',
              ],
            ),
            why: `La fórmula termina en semitono: del VII a la octava. Sin alterar, ${nombre(alterar(notas[6]!, -1))} quedaría a un tono de ${nombre(tonica)}, y el sostenido lo arrima.`,
          }
        : {
            prompt: `En ${clave}, ¿por qué el IV es ${nombre(notas[3]!)} y no ${nombre(alterar(notas[3]!, 1))}?`,
            choices: choices(
              `Porque del III al IV la fórmula pide un semitono, y de ${nombre(notas[2]!)} a ${nombre(alterar(notas[3]!, 1))} hay un tono`,
              [
                'Para no repetir letra en la escala',
                'Porque toda escala mayor lleva al menos un bemol',
                'Porque del IV al V la fórmula pide un semitono',
              ],
            ),
            why: `La fórmula pide un semitono del III al IV. Sin alterar, ${nombre(alterar(notas[3]!, 1))} quedaría a un tono de ${nombre(notas[2]!)}, y el bemol lo arrima.`,
          };
  /*
    Una opción mala hecha con la misma escala escrita con la otra alteración —en
    G mayor, G A B C D E Gb—: suena igual y repite letra. En Do mayor no hay nada
    que reescribir, y ahí entra la menor natural.
  */
  const malEscrita =
    cuantas === 0
      ? serie(spellScale(tonica, SCALES.naturalMinor.intervals))
      : serie(
          notas.map((nota) =>
            nota.alter === 0 ? nota : spellAt(nota, nota.alter > 0 ? 1 : -1, 0),
          ),
        );
  const tonales = `I, IV y V: ${nombre(notas[0]!)}, ${nombre(notas[3]!)} y ${nombre(notas[4]!)}`;
  const modales = `III y VI: ${nombre(notas[2]!)} y ${nombre(notas[5]!)}`;
  const triada = `I, III y V: ${nombre(notas[0]!)}, ${nombre(notas[2]!)} y ${nombre(notas[4]!)}`;
  const otros = `II y VII: ${nombre(notas[1]!)} y ${nombre(notas[6]!)}`;

  return {
    points: [
      'La escala mayor sigue siempre la misma fórmula de tonos (T) y semitonos (S): T-T-S-T-T-T-S. Los dos semitonos caen entre el III y el IV y entre el VII y la octava.',
      `${enMenor}${
        cuantas === 0
          ? 'Empezando en C sale sin alteraciones, porque sus semitonos naturales, E-F y B-C, caen justo donde la fórmula los pide. Sobre cualquier otra nota hay que alterar alguna para que cuadre.'
          : `Sobre cualquier nota que no sea C hay que alterar alguna para que cuadre la fórmula: ${clave} es ${serie(notas)}, con ${cuantas === 1 ? `un ${deSostenidos ? 'sostenido' : 'bemol'}` : `${cuantas} ${deSostenidos ? 'sostenidos' : 'bemoles'}`}. Cada letra sale una sola vez: por eso es ${nombre(ejemplo)} y no ${nombre(spellAt(ejemplo, deSostenidos ? 1 : -1, 0))}.`
      }`,
      `Cada grado tiene nombre: ${NOMBRES_DE_GRADO.map((gradoNombre, i) => `${ROMANOS[i]} ${gradoNombre} (${nombre(notas[i]!)})`).join(', ')}.`,
      'El VII se llama sensible porque está a un semitono de la tónica y tiende a subir a ella. Cuando está a un tono, como en la menor natural, se llama subtónica.',
      'Los grados tonales son el I, el IV y el V, los que sostienen la tonalidad. Los modales son el III y el VI, los que deciden si el modo es mayor o menor.',
    ],
    exercises: [
      {
        prompt: '¿Cuál es la fórmula de la escala mayor? (T es tono y S, semitono)',
        choices: choices('T-T-S-T-T-T-S', ['T-S-T-T-S-T-T', 'T-T-T-S-T-T-S', 'T-T-S-T-T-S-T']),
        why: 'Tono, tono, semitono, tono, tono, tono, semitono. T-S-T-T-S-T-T es la menor natural; las otras dos son los modos lidio y mixolidio.',
      },
      {
        prompt: `¿Cuál es la escala de ${clave}?`,
        choices: choices(serie(notas), [
          serie(spellScale(tonica, SCALES.mixolydian.intervals)),
          serie(spellScale(tonica, [0, 2, 4, 6, 7, 9, 11])),
          malEscrita,
        ]),
        why: `Aplicando T-T-S-T-T-T-S desde ${nombre(tonica)} y con una letra por grado sale ${serie(notas)}. Bajar el VII o subir el IV rompe la fórmula, ${
          cuantas === 0
            ? 'y bajar el III, el VI y el VII da la menor natural.'
            : 'y cambiar una nota por su enarmónica repite letra.'
        }`,
      },
      {
        prompt: `En ${clave}, ${nombre(notas[grado]!)} es el grado ${ROMANOS[grado]}. ¿Cómo se llama ese grado?`,
        choices: choices(mayuscula(NOMBRES_DE_GRADO[grado]!), [
          mayuscula(NOMBRES_DE_GRADO[(grado + 1) % 7]!),
          mayuscula(NOMBRES_DE_GRADO[(grado + 6) % 7]!),
          mayuscula(NOMBRES_DE_GRADO[(grado + 4) % 7]!),
        ]),
        why: `Los siete por orden: ${NOMBRES_DE_GRADO.join(', ')}. El ${ROMANOS[grado]} es la ${NOMBRES_DE_GRADO[grado]}.`,
      },
      {
        prompt: `En ${clave} el VII es ${nombre(notas[6]!)}. ¿Por qué ese grado se llama sensible?`,
        choices: choices('Porque está a un semitono de la tónica y tiende a subir a ella', [
          'Porque es la nota más aguda de la escala',
          'Porque está a un tono de la tónica',
          'Porque siempre lleva una alteración',
        ]),
        why: `De ${nombre(notas[6]!)} a ${nombre(tonica)} hay un semitono, y el oído pide resolverlo. Cuando el VII está a un tono, como en la menor natural, no tira igual y se llama subtónica.`,
      },
      mode === 'major'
        ? {
            prompt: `¿Cuáles son los grados tonales de ${clave}?`,
            choices: choices(tonales, [modales, triada, otros]),
            why: `Los tonales son el I, el IV y el V —${nombre(notas[0]!)}, ${nombre(notas[3]!)} y ${nombre(notas[4]!)}—: sobre ellos se apoya la tonalidad. El III y el VI son los modales.`,
          }
        : {
            prompt: `¿Cuáles son los grados modales de ${clave}?`,
            choices: choices(modales, [tonales, triada, otros]),
            why: `Los modales son el III y el VI —${nombre(notas[2]!)} y ${nombre(notas[5]!)}—: son los que dicen el modo, mayor o menor. El I, el IV y el V son los tonales.`,
          },
      porQue,
    ],
  };
}

/** Lo que se confunde con cada especie: la otra del mismo número y la enarmónica. */
function confusiones(intervalo: Interval): Interval[] {
  const n = intervalo.number;
  if (intervalo.quality === 'major') {
    return [
      { number: n, quality: 'minor' },
      { number: n + 1, quality: 'diminished' },
      { number: n, quality: 'augmented' },
    ];
  }
  if (intervalo.quality === 'minor') {
    return [
      { number: n, quality: 'major' },
      { number: n - 1, quality: 'augmented' },
      { number: n, quality: 'diminished' },
    ];
  }
  // Justa: aquí solo llegan la cuarta y la quinta de la tonalidad.
  return [
    { number: n, quality: 'augmented' },
    { number: n, quality: 'diminished' },
    n === 4 ? { number: 3, quality: 'augmented' } : { number: 6, quality: 'diminished' },
  ];
}

/*
  Lo que pasa al mover un semitono la nota de arriba sin cambiarle la letra.
  Las malas son las equivocaciones de verdad: llamar «menor» a una justa, o
  nombrarla por la enarmónica, que suena igual y tiene otro número.
*/
const CAMBIOS_DE_ESPECIE = [
  {
    prompt: 'A una quinta justa se le quita un semitono sin cambiar las letras. ¿Qué queda?',
    choices: choices('Una quinta disminuida', [
      'Una quinta menor',
      'Una cuarta aumentada',
      'Una cuarta justa',
    ]),
    why: 'Las justas no tienen mayor ni menor: con un semitono menos pasan a disminuidas. La cuarta aumentada suena igual, pero abarca una letra menos.',
  },
  {
    prompt: 'A una cuarta justa se le añade un semitono sin cambiar las letras. ¿Qué queda?',
    choices: choices('Una cuarta aumentada', [
      'Una cuarta mayor',
      'Una quinta disminuida',
      'Una quinta justa',
    ]),
    why: 'Las justas no tienen mayor ni menor: con un semitono más pasan a aumentadas. La quinta disminuida suena igual, pero abarca una letra más.',
  },
  {
    prompt: 'A una tercera mayor se le quita un semitono sin cambiar las letras. ¿Qué queda?',
    choices: choices('Una tercera menor', [
      'Una tercera disminuida',
      'Una segunda aumentada',
      'Una segunda mayor',
    ]),
    why: 'Mayor menos un semitono es menor; solo otro semitono menos la haría disminuida. La segunda aumentada suena igual que la tercera menor, pero abarca una letra menos.',
  },
  {
    prompt: 'A una sexta menor se le añade un semitono sin cambiar las letras. ¿Qué queda?',
    choices: choices('Una sexta mayor', [
      'Una sexta aumentada',
      'Una séptima disminuida',
      'Una quinta aumentada',
    ]),
    why: 'Menor más un semitono es mayor; solo otro semitono más la haría aumentada. La séptima disminuida suena igual que la sexta mayor, pero abarca una letra más.',
  },
] as const;

/** El intervalo de dos notas, dicho como se lee: «C–E (tercera mayor)». */
function dicho(abajo: SpelledNote, arriba: SpelledNote, intervalo: Interval): string {
  return `${nombre(abajo)}–${nombre(arriba)} (${intervalName(intervalo)})`;
}

function intervalosLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const clave = keyName(tonic, mode);
  const tonica = keyTonic(tonic, mode);
  const escala = keyScale(tonic, mode);
  const desdeTonica = escala.map((nota) => intervalBetween(tonica, nota));
  const conSemitonos = (grado: number) =>
    `${nombre(escala[grado - 1]!)} es una ${intervalName(desdeTonica[grado - 1]!)} (${(escala[grado - 1]!.pitch - tonica.pitch + 12) % 12} semitonos)`;

  // Tres grados distintos según la tonalidad, para no preguntar siempre la tercera.
  const contado = 3 + (tonic % 5);
  const especie = ([2, 4, 5, 6, 7] as const)[(tonic + 2) % 5]!;
  const construido = ([3, 6, 2, 7, 4, 5] as const)[tonic % 6]!;

  const deEspecie = desdeTonica[especie - 1]!;
  const notaDeEspecie = escala[especie - 1]!;
  const semitonosDeEspecie = (notaDeEspecie.pitch - tonica.pitch + 12) % 12;

  const buena = escala[construido - 1]!;
  const deConstruido = desdeTonica[construido - 1]!;
  /*
    Las malas de «qué nota está a tal intervalo» son las que se escriben de
    verdad al equivocarse: la enarmónica —suena igual con otra letra—, la otra
    especie con la misma letra y los grados de al lado. Una opción con doble
    alteración no la escribe nadie que esté aprendiendo, así que se descarta y
    entra la siguiente.
  */
  const candidatas = [
    spellAt(buena, 1, 0),
    spellAt(buena, -1, 0),
    alterar(buena, deConstruido.quality === 'major' ? -1 : 1),
    escala[construido - 2]!,
    escala[construido % 7]!,
  ]
    .filter((nota) => Math.abs(nota.alter) <= 1)
    .map(nombre)
    .filter((texto, i, todas) => texto !== nombre(buena) && todas.indexOf(texto) === i)
    .slice(0, 3);

  const tercera = escala[2]!;
  const deTercera = desdeTonica[2]!;
  const invertida = invertInterval(deTercera);

  const octava: Interval = { number: 8, quality: 'perfect' };
  const intervaloDe = (grado: number) => dicho(tonica, escala[grado - 1]!, desdeTonica[grado - 1]!);
  const consonancia = [
    {
      clase: 'una consonancia perfecta',
      buena: intervaloDe(5),
      malas: [intervaloDe(3), intervaloDe(6), intervaloDe(2)],
    },
    {
      clase: 'una consonancia imperfecta',
      buena: intervaloDe(mode === 'major' ? 3 : 6),
      malas: [intervaloDe(5), dicho(tonica, tonica, octava), intervaloDe(7)],
    },
    {
      clase: 'una disonancia',
      buena: intervaloDe(mode === 'major' ? 7 : 2),
      malas: [intervaloDe(3), intervaloDe(5), intervaloDe(6)],
    },
  ][tonic % 3]!;

  return {
    points: [
      `Un intervalo se nombra primero por el número: se cuentan las letras que abarca, contando las dos de los extremos. De ${nombre(tonica)} a ${nombre(tercera)} hay una tercera: ${serie(escala.slice(0, 3))}.`,
      'Luego por la especie, que la dan los semitonos. El unísono, la cuarta, la quinta y la octava son justas; las segundas, terceras, sextas y séptimas, mayores o menores. Un semitono más que la justa o la mayor la hace aumentada; uno menos que la justa o la menor, disminuida.',
      `En ${clave}, desde ${nombre(tonica)}: ${conSemitonos(3)}, ${conSemitonos(5)} y ${conSemitonos(7)}.`,
      'Invertir es subir la nota de abajo una octava. Los números suman nueve —la tercera se vuelve sexta— y la especie se da la vuelta: mayor por menor y aumentada por disminuida. La justa sigue justa.',
      'Consonancias perfectas: unísono, cuarta, quinta y octava justas. Imperfectas: terceras y sextas, mayores o menores. Disonancias: segundas, séptimas y todos los aumentados y disminuidos. La cuarta justa, en armonía, se trata aparte cuando va sobre el bajo.',
    ],
    exercises: [
      {
        prompt: `Contando solo el número, ¿qué intervalo hay de ${nombre(tonica)} a ${nombre(escala[contado - 1]!)}, subiendo?`,
        choices: choices(mayuscula(intervalNumberName(contado)), [
          mayuscula(intervalNumberName(contado - 1)),
          mayuscula(intervalNumberName(contado + 1)),
          mayuscula(intervalNumberName(contado + 2 <= 8 ? contado + 2 : contado - 2)),
        ]),
        why: `Se cuentan las letras, las dos de los extremos incluidas: ${serie(escala.slice(0, contado))}. Son ${contado}: una ${intervalNumberName(contado)}.`,
      },
      {
        prompt: `¿Qué intervalo hay de ${nombre(tonica)} a ${nombre(notaDeEspecie)}, subiendo?`,
        choices: choices(
          mayuscula(intervalName(deEspecie)),
          confusiones(deEspecie).map((intervalo) => mayuscula(intervalName(intervalo))),
        ),
        why: `${especie} letras y ${semitonosDeEspecie} semitonos: una ${intervalName(deEspecie)}. Con los mismos semitonos y otro número de letras tendría otro nombre, por eso se cuentan primero las letras.`,
      },
      {
        prompt: `¿Qué nota está una ${intervalName(deConstruido)} por encima de ${nombre(tonica)}?`,
        choices: choices(nombre(buena), candidatas),
        why: `La letra la da el número: ${construido} letras desde ${nombre(tonica)} llevan a ${buena.letter}. La alteración la dan los semitonos: ${(buena.pitch - tonica.pitch + 12) % 12} desde ${nombre(tonica)} es ${nombre(buena)}. Una nota de otra letra que suene igual sería otro intervalo.`,
      },
      CAMBIOS_DE_ESPECIE[(tonic + (mode === 'minor' ? 1 : 0)) % CAMBIOS_DE_ESPECIE.length]!,
      {
        prompt: `De ${nombre(tonica)} a ${nombre(tercera)} hay una ${intervalName(deTercera)}. Si ${nombre(tonica)} sube una octava, ¿qué intervalo queda de ${nombre(tercera)} a ${nombre(tonica)}?`,
        choices: choices(mayuscula(intervalName(invertida)), [
          mayuscula(intervalName({ number: 6, quality: deTercera.quality })),
          mayuscula(intervalName({ number: 5, quality: 'perfect' })),
          mayuscula(intervalName({ number: 3, quality: invertida.quality })),
        ]),
        why: `Al invertir, los números suman nueve —3 y 6— y la especie se da la vuelta: la ${intervalName(deTercera)} pasa a ${intervalName(invertida)}.`,
      },
      {
        prompt: `¿Cuál de estos intervalos de ${clave} es ${consonancia.clase}?`,
        choices: choices(consonancia.buena, consonancia.malas),
        why: `${consonancia.buena} es ${consonancia.clase}. Las justas son consonancias perfectas; terceras y sextas, imperfectas, y segundas y séptimas, disonancias.`,
      },
    ],
  };
}

/** La menor melódica al subir: la natural con el VI y el VII subidos. */
const MENOR_MELODICA: readonly number[] = [0, 2, 3, 5, 7, 9, 11];

function escalasMenoresLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  // En una tonalidad mayor se estudian sobre su relativa: así son las mismas
  // notas que ya conoce, con otro centro.
  const tonicaMenor = mode === 'minor' ? tonic : relativeMinor(tonic);
  const relativa = relativeMajor(tonicaMenor);
  const clave = keyName(tonicaMenor, 'minor');
  const claveRelativa = keyName(relativa, 'major');
  const t = keyTonic(tonicaMenor, 'minor');
  const natural = spellScale(t, SCALES.naturalMinor.intervals);
  const armonica = spellScale(t, SCALES.harmonicMinor.intervals);
  const melodica = spellScale(t, MENOR_MELODICA);
  const dorica = spellScale(t, SCALES.dorian.intervals);
  const sexto = natural[5]!;
  const septimo = natural[6]!;
  const sensible = armonica[6]!;
  const laHomonima = homonima(tonicaMenor, 'minor');

  return {
    points: [
      `La menor natural es la de la armadura: ${clave} tiene las mismas notas que su relativa mayor, ${claveRelativa}, empezando una tercera menor más abajo: ${serie(natural)}. Su fórmula es T-S-T-T-S-T-T, y su VII está a un tono de la tónica: es subtónica, no sensible.`,
      `La armónica sube el VII un semitono para tener sensible: ${serie(armonica)}. Entre el VI y el VII queda una segunda aumentada, ${nombre(sexto)}–${nombre(sensible)}, de tres semitonos: el salto que le da su color.`,
      `La melódica sube también el VI, para no tener que dar ese salto: ${subiendo(melodica)}. Al bajar, en el uso tradicional, los dos vuelven a su sitio y queda la natural: ${bajando(natural)}.`,
      `Lo que hace mayor o menor una escala es la tercera sobre la tónica. En ${clave}, de ${nombre(t)} a ${nombre(natural[2]!)} hay tres semitonos, una tercera menor, y las tres menores la comparten: lo que cambian entre ellas es el VI y el VII.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es la relativa mayor de ${clave}?`,
        // La homónima con la letra de la tónica: en D# menor salía «Eb mayor
        // comparte la tónica», con otra letra delante (`comun.ts`, `homonima`).
        choices: choices(claveRelativa, [
          laHomonima.nombre,
          keyName(up(tonicaMenor, 9), 'major'),
          keyName(up(tonicaMenor, 7), 'major'),
        ]),
        why: `${claveRelativa} empieza una tercera menor por encima de ${nombre(t)} y lleva la misma armadura. ${laHomonima.nombre} comparte la tónica, pero no la armadura: es la homónima, no la relativa.${laHomonima.aclaracion}`,
      },
      {
        prompt: `¿Qué cambia la menor armónica de ${nombre(t)} respecto a la natural?`,
        choices: choices(`Sube el VII: ${nombre(septimo)} pasa a ${nombre(sensible)}`, [
          `Sube el VI y el VII: ${nombre(sexto)} pasa a ${nombre(alterar(sexto, 1))} y ${nombre(septimo)} a ${nombre(sensible)}`,
          `Sube el VI: ${nombre(sexto)} pasa a ${nombre(alterar(sexto, 1))}`,
          `Sube el III: ${nombre(natural[2]!)} pasa a ${nombre(alterar(natural[2]!, 1))}`,
        ]),
        why: `La armónica solo sube el VII, para que quede a un semitono de la tónica y haga de sensible. Subir también el VI es la melódica, y subir el III la convertiría en mayor.`,
      },
      {
        prompt: `En la menor armónica de ${nombre(t)}, ¿qué intervalo hay de ${nombre(sexto)} a ${nombre(sensible)}?`,
        choices: choices('Una segunda aumentada, de tres semitonos', [
          'Una tercera menor, de tres semitonos',
          'Una segunda mayor, de dos semitonos',
          'Una segunda menor, de un semitono',
        ]),
        why: `${sexto.letter} y ${sensible.letter} son letras vecinas, así que es una segunda, aunque mida tres semitonos como una tercera menor. Es el salto que la melódica evita subiendo también el VI.`,
      },
      {
        prompt: `¿Cómo es la menor melódica de ${nombre(t)} al subir?`,
        choices: choices(subiendo(melodica), [
          subiendo(natural),
          subiendo(armonica),
          subiendo(dorica),
        ]),
        why: `Al subir lleva el VI y el VII subidos: ${nombre(melodica[5]!)} y ${nombre(melodica[6]!)}. Así llega a la tónica con sensible y sin el salto de segunda aumentada.`,
      },
      {
        prompt: `¿Cómo baja la menor melódica de ${nombre(t)}, en el uso tradicional?`,
        choices: choices(bajando(natural), [bajando(melodica), bajando(armonica), bajando(dorica)]),
        why: `Bajando ya no hace falta sensible, y el VI y el VII vuelven a su sitio: queda la natural, ${bajando(natural)}.`,
      },
      {
        prompt: `¿Qué hace que ${clave} sea una tonalidad menor?`,
        choices: choices(
          `La tercera sobre la tónica: de ${nombre(t)} a ${nombre(natural[2]!)} hay tres semitonos`,
          [
            'Que la armadura lleve bemoles',
            'Que su VII esté a un tono de la tónica',
            'Que su sexta sea menor',
          ],
        ),
        why: `Lo que decide el modo es la tercera: menor, tres semitonos; mayor, cuatro. El VI y el VII no lo deciden —la melódica los sube y sigue siendo menor—, y la armadura de ${clave} es la misma que la de ${claveRelativa}.`,
      },
    ],
  };
}

export const LECCIONES_DE_LENGUAJE: Readonly<
  Record<DeLenguaje, (tonic: PitchClass, mode: KeyMode) => LessonNotes>
> = {
  notas: notasLesson,
  claves: clavesLesson,
  ritmo: ritmoLesson,
  escalaMayor: escalaMayorLesson,
  intervalos: intervalosLesson,
  escalasMenores: escalasMenoresLesson,
};
