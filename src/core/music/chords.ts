/**
 * Los acordes que salen de armonizar una escala de siete notas apilando terceras
 * de la propia escala —tríadas y cuatríadas—, y las especies sueltas que un
 * bloque sabe guardar encima de su grado.
 */

import {
  noteName,
  normalizePitchClass,
  type Accidental,
  type NoteName,
  type PitchClass,
} from './notes';
import { scaleNotes, type HeptatonicScaleId } from './scales';

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';

/** Grado dentro de la escala, contado desde 1 en la tónica. */
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];

export interface DiatonicChord {
  readonly degree: Degree;
  readonly root: PitchClass;
  readonly quality: ChordQuality;
  /** Cifrado anglosajón: Am, C, Bdim, Caug. */
  readonly symbol: string;
  /** Grado en números romanos: mayúscula si es mayor, minúscula si es menor. */
  readonly roman: string;
  /** Las tres notas, desde la fundamental. */
  readonly notes: readonly PitchClass[];
}

const QUALITY_SUFFIX: Readonly<Record<ChordQuality, string>> = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
};

const ROMAN_NUMERALS: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Las cuatro tríadas, por lo que miden su tercera y su quinta.
 *
 * **Escrito una sola vez**, y esto es lo que arregla: estaba aquí como cuatro
 * `if` y otra vez en `capture.ts` como una tabla, las dos diciendo lo mismo —que
 * un acorde mayor es 0-4-7— en dos ficheros que no se miran. Dos sitios donde
 * vive un hecho musical son dos sitios que se pueden contradecir.
 *
 * **El orden importa**, y no es alfabético ni casual: `major` va antes que
 * `minor` porque quien busca la tríada que hay *dentro* de un acorde con
 * tensiones se queda con la primera que encaja, y un `7#9` lleva dentro la
 * tercera mayor y la menor. Es un acorde mayor con una tensión, no uno menor.
 */
export const TRIADS: ReadonlyArray<{
  readonly third: number;
  readonly fifth: number;
  readonly quality: ChordQuality;
}> = [
  { third: 4, fifth: 7, quality: 'major' },
  { third: 3, fifth: 7, quality: 'minor' },
  { third: 3, fifth: 6, quality: 'diminished' },
  { third: 4, fifth: 8, quality: 'augmented' },
];

/**
 * Deduce la especie a partir de los dos intervalos que forman la tríada.
 * Cualquier otra combinación no es una tríada por terceras y es un error de
 * quien la construyó, no una entrada del usuario.
 */
function qualityFromIntervals(third: number, fifth: number): ChordQuality {
  const triada = TRIADS.find((candidate) => candidate.third === third && candidate.fifth === fifth);
  /* v8 ignore next 3 -- las siete escalas de siete notas apilan las cuatro triadas y ninguna rara, y hay prueba de ello */
  if (triada === undefined) {
    throw new RangeError(`Los intervalos ${third} y ${fifth} no forman una tríada por terceras.`);
  }
  return triada.quality;
}

export function chordSymbol(
  root: PitchClass,
  quality: ChordQuality,
  accidental: Accidental = 'sharp',
): string {
  return `${noteName(root, accidental)}${QUALITY_SUFFIX[quality]}`;
}

/**
 * Con qué alteración está escrita la fundamental de un cifrado ya hecho.
 *
 * Existe para que **lo que se escribe encima de un grado use la grafía del
 * grado**. `resolveDegree` ya decide cómo se escribe cada fundamental —un grado
 * que se llama «b» algo va con bemol, valga lo que valga la armadura—, y la
 * cuatríada o la especie de ese grado tienen que decir la misma nota. Volver a
 * decidirlo con `accidentalForKey` daba el `bVII` de Do mayor como `Bb` en la
 * tríada y `A#7` en la cuatríada. Preguntándoselo al cifrado de la tríada no hay
 * una segunda regla que pueda contradecir a la primera.
 *
 * Una fundamental natural se escribe igual con las dos, así que da lo mismo cuál
 * salga.
 */
export function grafiaDeLaFundamental(root: PitchClass, symbol: string): Accidental {
  return symbol.startsWith(noteName(root, 'flat')) ? 'flat' : 'sharp';
}

export function romanNumeral(degree: Degree, quality: ChordQuality): string {
  const numeral = ROMAN_NUMERALS[degree - 1];
  if (numeral === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  switch (quality) {
    case 'major':
      return numeral;
    case 'augmented':
      return `${numeral}+`;
    case 'minor':
      return numeral.toLowerCase();
    case 'diminished':
      return `${numeral.toLowerCase()}°`;
  }
}

export function triadNotes(root: PitchClass, quality: ChordQuality): PitchClass[] {
  switch (quality) {
    case 'major':
      return [root, normalizePitchClass(root + 4), normalizePitchClass(root + 7)];
    case 'minor':
      return [root, normalizePitchClass(root + 3), normalizePitchClass(root + 7)];
    case 'diminished':
      return [root, normalizePitchClass(root + 3), normalizePitchClass(root + 6)];
    case 'augmented':
      return [root, normalizePitchClass(root + 4), normalizePitchClass(root + 8)];
  }
}

export function chordNoteNames(
  chord: DiatonicChord | SeventhChord,
  accidental: Accidental = 'sharp',
): NoteName[] {
  return chord.notes.map((note) => noteName(note, accidental));
}

/**
 * La nota que queda `salto` terceras por encima de un grado de la escala.
 *
 * Es lo único que compartían las tríadas y las cuatríadas, y era la parte con
 * trampa de las dos: subir de dos en dos escalones **dando la vuelta** al llegar
 * al final —el V grado coge su séptima del IV, una octava más arriba— y
 * comprobar que la escala tenga los siete escalones que eso da por hecho.
 * Estaba escrito dos veces, con la única diferencia de si se paraba en la quinta
 * o en la séptima.
 *
 * Devuelve una nota y no `PitchClass | undefined`: la comprobación vive aquí, y
 * así quien apila terceras no tiene que repetirla por cada nota que apila.
 */
function escalon(
  notes: readonly PitchClass[],
  scaleId: HeptatonicScaleId,
  degree: Degree,
  salto: number,
): PitchClass {
  const nota = notes[(degree - 1 + salto * 2) % notes.length];
  /* v8 ignore next 3 -- `HeptatonicScaleId` ya deja fuera las que no tienen siete */
  if (nota === undefined) {
    throw new RangeError(`La escala ${scaleId} no tiene siete notas.`);
  }
  return nota;
}

/**
 * Las siete tríadas de una tonalidad, en orden de grado.
 *
 * Solo acepta escalas de siete notas: apilar terceras sobre una pentatónica
 * daría acordes que nadie toca.
 */
export function diatonicTriads(
  tonic: PitchClass,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): DiatonicChord[] {
  const notes = scaleNotes(tonic, scaleId);

  return DEGREES.map((degree) => {
    const root = escalon(notes, scaleId, degree, 0);
    const third = escalon(notes, scaleId, degree, 1);
    const fifth = escalon(notes, scaleId, degree, 2);

    const quality = qualityFromIntervals(
      normalizePitchClass(third - root),
      normalizePitchClass(fifth - root),
    );

    return {
      degree,
      root,
      quality,
      symbol: chordSymbol(root, quality, accidental),
      roman: romanNumeral(degree, quality),
      notes: [root, third, fifth],
    };
  });
}

export function chordForDegree(
  tonic: PitchClass,
  degree: Degree,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): DiatonicChord {
  const chord = diatonicTriads(tonic, scaleId, accidental)[degree - 1];
  if (chord === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  return chord;
}

/**
 * Cuatríadas: la tríada más la nota que está dos posiciones más arriba en la
 * escala. Es lo que pide el modo componer cuando la tríada se queda sosa.
 */
export type SeventhQuality =
  | 'major7'
  | 'dominant7'
  | 'minor7'
  | 'halfDiminished7'
  | 'diminished7'
  | 'minorMajor7'
  | 'augmentedMajor7';

const SEVENTH_SUFFIX: Readonly<Record<SeventhQuality, string>> = {
  major7: 'maj7',
  dominant7: '7',
  minor7: 'm7',
  halfDiminished7: 'm7b5',
  diminished7: 'dim7',
  minorMajor7: 'mMaj7',
  augmentedMajor7: 'maj7#5',
};

/**
 * La especie de séptima de un sufijo de cifrado, si es una.
 *
 * Es el puente entre lo que alguien escribe —`E7`, `Cmaj7`, `Am7`— y lo que el
 * montaje guarda. Sale de **invertir** `SEVENTH_SUFFIX` y no de una lista nueva,
 * para que no haya dos tablas que se puedan desincronizar.
 */
export function seventhFromSuffix(suffix: string): SeventhQuality | null {
  const encontrada = (Object.entries(SEVENTH_SUFFIX) as Array<[SeventhQuality, string]>).find(
    ([, escrito]) => escrito === suffix,
  );
  return encontrada?.[0] ?? null;
}

/**
 * Si un valor cualquiera es una de las especies que este proyecto sabe guardar.
 *
 * Hace falta al **leer lo que llega de fuera** —una canción guardada por una
 * versión anterior, o tocada a mano—: lo que no reconozca no es una séptima, es
 * una tríada, y eso es lo que se guarda.
 */
/**
 * Las tríadas que **no se pueden localizar por su calidad**, y la quinta.
 *
 * El grado de un bloque sale de la tríada: un `Am` en Do mayor es el `vi` porque
 * hay un `vi` menor sobre esa fundamental. Estas cinco no tienen dónde caer —el
 * catálogo no guarda un menor sobre el I, ni un disminuido sobre cualquier
 * grado, y una suspendida ni siquiera tiene tercera con la que buscar—, así que
 * **el grado lo pone la fundamental y la especie dice lo que es**. Es el mismo
 * trato que ya tenía `quinta`
 * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 *
 * Con esto, escribir `Csus4`, `Cdim`, `Caug` o `Cm` en Do mayor deja de estar
 * apagado en el buscador: entran por el grado de su fundamental.
 */
export type EspecieSimple = 'quinta' | 'sus2' | 'sus4' | 'dim' | 'aug' | 'menor';

/** Qué notas tiene cada una sobre su fundamental, y cómo se escribe. */
const ESPECIE_SIMPLE: Readonly<Record<EspecieSimple, { semitonos: number[]; sufijo: string }>> = {
  quinta: { semitonos: [0, 7], sufijo: '5' },
  sus2: { semitonos: [0, 2, 7], sufijo: 'sus2' },
  sus4: { semitonos: [0, 5, 7], sufijo: 'sus4' },
  dim: { semitonos: [0, 3, 6], sufijo: 'dim' },
  aug: { semitonos: [0, 4, 8], sufijo: 'aug' },
  menor: { semitonos: [0, 3, 7], sufijo: 'm' },
};

/**
 * Lo que un bloque puede llevar encima de su grado.
 *
 * Una de las siete séptimas, o una de las seis simples. Una sola especie y no un
 * campo por familia: al guardar la canción viajan en una lista paralela a los
 * grados, y dos listas que hay que mantener alineadas son dos maneras de
 * desalinearlas.
 */
export type EspecieDeBloque = SeventhQuality | EspecieSimple;

/** Las notas de una especie simple sobre su fundamental. */
export function notasDeEspecieSimple(root: PitchClass, especie: EspecieSimple): PitchClass[] {
  return ESPECIE_SIMPLE[especie].semitonos.map((paso) => normalizePitchClass(root + paso));
}

/** Cómo se escribe una especie simple: la fundamental y su sufijo. */
export function simboloDeEspecieSimple(
  root: PitchClass,
  especie: EspecieSimple,
  accidental: Accidental,
): string {
  return `${noteName(root, accidental)}${ESPECIE_SIMPLE[especie].sufijo}`;
}

export function esEspecieSimple(value: unknown): value is EspecieSimple {
  return typeof value === 'string' && Object.hasOwn(ESPECIE_SIMPLE, value);
}

/**
 * Cuál de las especies simples son estas notas, si son alguna.
 *
 * Se pregunta **antes** que por la tríada: una `sus4` no tiene tercera y una
 * `dim` sí, pero ninguna de las dos se localiza por calidad en el catálogo. El
 * orden de la tabla no importa porque no hay dos con las mismas notas.
 */
export function especieSimpleDe(
  root: PitchClass,
  notes: readonly PitchClass[],
): EspecieSimple | null {
  const suyas = new Set(notes);
  for (const [especie, forma] of Object.entries(ESPECIE_SIMPLE) as [
    EspecieSimple,
    { semitonos: number[] },
  ][]) {
    if (
      suyas.size === forma.semitonos.length &&
      forma.semitonos.every((paso) => suyas.has(normalizePitchClass(root + paso)))
    ) {
      return especie;
    }
  }
  return suspendidaDe(root, notes);
}

/**
 * Si es una suspendida, **tenga las notas que tenga encima**.
 *
 * Un `A7sus4` son cuatro notas y no encaja exacto con ninguna forma de tres, y
 * sin esto se quedaba apagado al lado de un `Asus4` que sí entraba. Lo que hace
 * suspendida a una suspendida no es cuántas notas tiene: es **que no tiene
 * tercera** y que en su lugar hay una segunda o una cuarta.
 *
 * La séptima se pierde al guardarlo, y se ve antes de pulsar: el buscador enseña
 * el cifrado que va a quedar, no el que se tecleó.
 */
function suspendidaDe(root: PitchClass, notes: readonly PitchClass[]): EspecieSimple | null {
  const pasos = new Set(notes.map((nota) => normalizePitchClass(nota - root)));
  if (!pasos.has(7) || pasos.has(3) || pasos.has(4)) {
    return null;
  }
  if (pasos.has(5)) {
    return 'sus4';
  }
  return pasos.has(2) ? 'sus2' : null;
}

/**
 * Si estas notas son un acorde de quinta: la fundamental y su quinta justa.
 *
 * Dos clases y nada más. Con la tercera dentro ya es una tríada, y de eso se
 * encarga `triadInside`.
 */
export function esQuinta(root: PitchClass, notes: readonly PitchClass[]): boolean {
  const suyas = new Set(notes);
  return suyas.size === 2 && suyas.has(root) && suyas.has(normalizePitchClass(root + 7));
}

/** Si un valor cualquiera es una especie que un bloque sabe guardar. */
export function esEspecieDeBloque(value: unknown): value is EspecieDeBloque {
  return esEspecieSimple(value) || esSeventhQuality(value);
}

export function esSeventhQuality(value: unknown): value is SeventhQuality {
  return typeof value === 'string' && Object.hasOwn(SEVENTH_SUFFIX, value);
}

/**
 * Qué séptima hay dentro de estas notas, si hay alguna.
 *
 * Es el gemelo de `triadInside`: aquélla saca la tríada y ésta la cuatríada. Las
 * dos hacen falta para convertir **un acorde cualquiera en un bloque**, porque un
 * bloque guarda un grado y su séptima, y un `Fmaj7` sin la séptima entraría como
 * un `F` sin que nadie avisara.
 *
 * Se comprueba contra `seventhNotes`, que es la tabla que ya sabe qué notas tiene
 * cada especie: una lista nueva aquí sería una segunda tabla que se puede
 * desincronizar de aquélla.
 *
 * Nulo si no son cuatro notas distintas, o si no son las de ninguna especie que
 * este proyecto sepa guardar —un `F5` no tiene tercera y un `Fsus2` la cambia por
 * la segunda—. Eso es correcto y no una limitación escondida: lo que no se sabe
 * guardar, no se dice que se guarda.
 */
export function seventhInside(
  root: PitchClass,
  notes: readonly PitchClass[],
): SeventhQuality | null {
  const suyas = new Set(notes);
  if (suyas.size !== 4) {
    return null;
  }
  for (const quality of Object.keys(SEVENTH_SUFFIX) as SeventhQuality[]) {
    if (seventhNotes(root, quality).every((nota) => suyas.has(nota))) {
      return quality;
    }
  }
  return null;
}

/**
 * Las notas de una cuatríada suelta, que es lo que suena cuando alguien escribe
 * un cifrado en vez de coger un grado de la escala.
 *
 * Los intervalos salen de `SEVENTHS`, la tabla que apila las terceras, y no del
 * catálogo de cifrados del buscador. **Antes era al revés, y mentía**: el catálogo
 * no tiene `mMaj7` ni `maj7#5`, así que esas dos caían a la tríada mayor. Un
 * `CmMaj7` sonaba como un `C`, y como `seventhInside` compara contra estas notas,
 * cualquier cuatríada con la tríada mayor dentro —un `C6`, un `Cadd9`— se
 * reconocía como `CmMaj7`. `SEVENTHS` va por especie, así que el compilador no deja
 * que falte ninguna; que el catálogo diga lo mismo en las que comparten lo vigila
 * un test.
 */
export function seventhNotes(root: PitchClass, quality: SeventhQuality): PitchClass[] {
  const forma = SEVENTHS[quality];
  return [0, forma.third, forma.fifth, forma.seventh].map((paso) =>
    normalizePitchClass(root + paso),
  );
}

/** Cómo se escribe cada especie en números romanos. */
const SEVENTH_ROMAN: Readonly<Record<SeventhQuality, { upper: boolean; suffix: string }>> = {
  major7: { upper: true, suffix: 'maj7' },
  dominant7: { upper: true, suffix: '7' },
  minor7: { upper: false, suffix: '7' },
  halfDiminished7: { upper: false, suffix: 'ø7' },
  diminished7: { upper: false, suffix: '°7' },
  minorMajor7: { upper: false, suffix: 'maj7' },
  augmentedMajor7: { upper: true, suffix: '+maj7' },
};

export interface SeventhChord {
  readonly degree: Degree;
  readonly root: PitchClass;
  readonly quality: SeventhQuality;
  readonly symbol: string;
  readonly roman: string;
  readonly notes: readonly PitchClass[];
}

/**
 * Las cuatríadas que salen de apilar terceras, por sus intervalos.
 *
 * Una tabla y no una escalera de `if`, igual que `TRIADS`: así las dos se leen
 * igual, y el caso de «esto no es una cuatríada» se escribe una sola vez. **Va
 * por especie** y no como lista porque de aquí salen también las notas de cada
 * una (`seventhNotes`), y así no puede faltar ninguna sin que lo diga el
 * compilador. Ningún par de especies comparte intervalos, así que el orden no
 * cuenta al buscar.
 */
const SEVENTHS: Readonly<
  Record<
    SeventhQuality,
    { readonly third: number; readonly fifth: number; readonly seventh: number }
  >
> = {
  major7: { third: 4, fifth: 7, seventh: 11 },
  dominant7: { third: 4, fifth: 7, seventh: 10 },
  minor7: { third: 3, fifth: 7, seventh: 10 },
  halfDiminished7: { third: 3, fifth: 6, seventh: 10 },
  diminished7: { third: 3, fifth: 6, seventh: 9 },
  minorMajor7: { third: 3, fifth: 7, seventh: 11 },
  augmentedMajor7: { third: 4, fifth: 8, seventh: 11 },
};

function seventhQualityFromIntervals(
  third: number,
  fifth: number,
  seventh: number,
): SeventhQuality {
  const cuatriada = (
    Object.entries(SEVENTHS) as Array<[SeventhQuality, (typeof SEVENTHS)[SeventhQuality]]>
  ).find(
    ([, forma]) => forma.third === third && forma.fifth === fifth && forma.seventh === seventh,
  );
  /* v8 ignore next 5 -- mismo motivo que las triadas: las siete escalas apilan cuatriadas conocidas */
  if (cuatriada === undefined) {
    throw new RangeError(
      `Los intervalos ${third}, ${fifth} y ${seventh} no forman una cuatríada por terceras.`,
    );
  }
  return cuatriada[0];
}

export function seventhSymbol(
  root: PitchClass,
  quality: SeventhQuality,
  accidental: Accidental = 'sharp',
): string {
  return `${noteName(root, accidental)}${SEVENTH_SUFFIX[quality]}`;
}

export function seventhRoman(degree: Degree, quality: SeventhQuality): string {
  const numeral = ROMAN_NUMERALS[degree - 1];
  if (numeral === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  const shape = SEVENTH_ROMAN[quality];
  return `${shape.upper ? numeral : numeral.toLowerCase()}${shape.suffix}`;
}

/** Las siete cuatríadas de una tonalidad, en orden de grado. */
export function diatonicSevenths(
  tonic: PitchClass,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): SeventhChord[] {
  const notes = scaleNotes(tonic, scaleId);

  return DEGREES.map((degree) => {
    const root = escalon(notes, scaleId, degree, 0);
    const third = escalon(notes, scaleId, degree, 1);
    const fifth = escalon(notes, scaleId, degree, 2);
    const seventh = escalon(notes, scaleId, degree, 3);

    const quality = seventhQualityFromIntervals(
      normalizePitchClass(third - root),
      normalizePitchClass(fifth - root),
      normalizePitchClass(seventh - root),
    );

    return {
      degree,
      root,
      quality,
      symbol: seventhSymbol(root, quality, accidental),
      roman: seventhRoman(degree, quality),
      notes: [root, third, fifth, seventh],
    };
  });
}

/**
 * La tríada que hay debajo de una cuatríada. Sirve para localizar el grado:
 * un Cmaj7 y un C7 son el mismo grado con distinta séptima.
 */
export function triadQualityOf(quality: SeventhQuality): ChordQuality {
  switch (quality) {
    case 'major7':
    case 'dominant7':
      return 'major';
    case 'minor7':
    case 'minorMajor7':
      return 'minor';
    case 'halfDiminished7':
    case 'diminished7':
      return 'diminished';
    case 'augmentedMajor7':
      return 'augmented';
  }
}
