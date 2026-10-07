/**
 * Formas de hacer un acorde sobre el mástil.
 *
 * Nada de tabla de digitaciones copiada: se buscan. Para cada posición del
 * mástil se prueban las combinaciones de trastes que dan las notas del acorde y
 * se descartan las que no se pueden tocar con una mano. Así funciona con
 * cualquier acorde, incluidos los raros que no salen en ningún libro.
 */

import { midiToPitchClass, normalizePitchClass, type PitchClass } from '../music/notes';
import { STANDARD_TUNING, type GuitarString } from './guitar';

export interface Voicing {
  /** Traste por cuerda, de la sexta a la primera. `null` es cuerda muda. */
  readonly frets: readonly (number | null)[];
  /** Traste más grave que se pisa. Cero si es un acorde al aire. */
  readonly position: number;
  /** Cuántas cuerdas suenan. */
  readonly sounding: number;
  /**
   * Si hay que hacer cejilla: el índice tumbado en el traste más bajo, pisando
   * varias cuerdas a la vez. Solo cuando hace falta —más cuerdas pisadas que
   * dedos— y solo si se puede: debajo del dedo no puede quedar una cuerda al
   * aire, que la cejilla pisaría.
   */
  readonly barre: boolean;
  /** Nombre para la interfaz: «Al aire», «5.ª posición con cejilla». */
  readonly name: string;
  readonly score: number;
}

export interface VoicingOptions {
  /** Hasta qué traste se busca. */
  readonly maxFret?: number;
  /** Cuántos trastes puede abarcar la mano. */
  readonly maxSpan?: number;
  readonly tuning?: readonly GuitarString[];
  readonly limit?: number;
}

const DEFAULTS = { maxFret: 12, maxSpan: 4, limit: 4 } as const;

/** Los dedos que pisan: el pulgar no cuenta. */
const DEDOS = 4;

/**
 * Hasta qué traste se sigue llamando «al aire» a una forma con cuerdas sueltas.
 *
 * Es la primera posición de la mano —un dedo por traste del 1 al 4—, que es donde
 * viven G 320003, C x32010 o Em 022000. Más arriba una cuerda al aire es un
 * adorno de una forma de mástil, no un acorde al aire.
 */
const TECHO_DEL_AIRE = 4;

/**
 * Cuántas cuerdas tienen que sonar como mínimo. Una quinta se toca con dos o
 * tres cuerdas; una cuatríada necesita al menos sus cuatro notas.
 */
function minimumSounding(chordSize: number): number {
  return Math.max(2, Math.min(4, chordSize));
}

function fretPitchClass(string: GuitarString, fret: number): PitchClass {
  return midiToPitchClass(string.midi + fret);
}

/**
 * Busca las formas de tocar un acorde.
 *
 * Reglas que se aplican, y que son las que separan una digitación real de una
 * combinación de notas cualquiera:
 *
 * - Todas las notas del acorde tienen que estar.
 * - La cuerda más grave que suena lleva la fundamental. Las inversiones son
 *   válidas en música, pero no es lo que se busca al aprender un acorde.
 * - La mano abarca cuatro trastes, contando solo lo que se pisa.
 * - Hay cuatro dedos. Si se pisan más cuerdas, el índice hace cejilla en el
 *   traste más bajo, y la cejilla no puede tener debajo una cuerda al aire ni una
 *   muda: la pisaría. Lo que no cabe en cuatro dedos así no se ofrece.
 * - Una cuerda muda en medio de dos que suenan penaliza: se puede, pero cuesta.
 */
export function chordVoicings(
  root: PitchClass,
  intervals: readonly number[],
  options: VoicingOptions = {},
): Voicing[] {
  const {
    maxFret = DEFAULTS.maxFret,
    maxSpan = DEFAULTS.maxSpan,
    tuning = STANDARD_TUNING,
    limit = DEFAULTS.limit,
  } = options;

  const chordNotes = new Set(intervals.map((interval) => normalizePitchClass(root + interval)));
  const needed = minimumSounding(chordNotes.size);
  const found = new Map<string, Voicing>();

  for (let window = 0; window + maxSpan <= maxFret + 1; window += 1) {
    search(0, [], window);
  }

  function search(index: number, frets: (number | null)[], window: number): void {
    if (index === tuning.length) {
      record(frets);
      return;
    }

    const string = tuning[index]!;

    // Muda: solo se permite antes de que suene nada, o al final.
    search(index + 1, [...frets, null], window);

    const candidates: number[] = [];
    if (fretPitchClass(string, 0) !== undefined && chordNotes.has(fretPitchClass(string, 0))) {
      candidates.push(0);
    }
    for (let fret = window; fret < window + maxSpan; fret += 1) {
      if (fret !== 0 && fret <= maxFret && chordNotes.has(fretPitchClass(string, fret))) {
        candidates.push(fret);
      }
    }

    for (const fret of candidates) {
      const sounding = frets.filter((value) => value !== null);
      // La primera cuerda que suena marca el bajo, y el bajo es la fundamental.
      if (sounding.length === 0 && fretPitchClass(string, fret) !== root) {
        continue;
      }
      search(index + 1, [...frets, fret], window);
    }
  }

  function record(frets: readonly (number | null)[]): void {
    const soundingFrets = frets.filter((fret): fret is number => fret !== null);
    if (soundingFrets.length < needed) {
      return;
    }

    const covered = new Set<PitchClass>();
    frets.forEach((fret, index) => {
      if (fret !== null) {
        covered.add(fretPitchClass(tuning[index]!, fret));
      }
    });
    if (covered.size !== chordNotes.size) {
      return;
    }

    const pressed = soundingFrets.filter((fret) => fret > 0);
    const position = pressed.length === 0 ? 0 : Math.min(...pressed);
    const top = pressed.length === 0 ? 0 : Math.max(...pressed);
    /* v8 ignore next 3 -- los trastes salen ya de una ventana de `maxSpan`, asi que nunca se pasan */
    if (pressed.length > 0 && top - position >= maxSpan) {
      return;
    }

    const barre = cejillaQueHaceFalta(frets, pressed, position);
    if (barre === null) {
      return;
    }

    const signature = frets.map((fret) => (fret === null ? 'x' : fret)).join('-');
    if (found.has(signature)) {
      return;
    }

    const open = soundingFrets.filter((fret) => fret === 0).length;
    const first = frets.findIndex((fret) => fret !== null);
    const last = frets.length - 1 - [...frets].reverse().findIndex((fret) => fret !== null);
    const innerMutes = frets.slice(first, last + 1).filter((fret) => fret === null).length;
    const tumbada = manoTumbada(frets, position);

    found.set(signature, {
      frets,
      position,
      sounding: soundingFrets.length,
      barre,
      name: describeVoicing({ position, open, top, barre }),
      score: scoreVoicing({
        position,
        open,
        innerMutes,
        tumbada,
        barre,
        sounding: soundingFrets.length,
        span: pressed.length === 0 ? 0 : Math.max(...pressed) - position,
        chordSize: chordNotes.size,
      }),
    });
  }

  // Una por nombre. Sin esto, las cuatro mejores son la misma forma con
  // cuerdas quitadas —022100, 02210x, xx2100— que no le sirve a nadie: lo que
  // se quiere ver son maneras distintas de cogerlo. Por nombre y no por traste
  // porque en el mismo traste caben dos manos distintas: Bm al aire, x20402, y
  // Bm con cejilla en el 2, x24432. Contando solo el traste, la de cejilla —la
  // que enseña cualquier libro— no salía nunca.
  const best = new Map<string, Voicing>();
  for (const voicing of [...found.values()].sort((a, b) => b.score - a.score)) {
    if (!best.has(voicing.name)) {
      best.set(voicing.name, voicing);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Si la forma pide cejilla, si no la pide, o si no se puede tocar.
 *
 * Devuelve `true` con cejilla, `false` sin ella y `null` si no cabe en una mano.
 *
 * Contaba como cejilla cualquier forma con dos cuerdas en el traste más bajo, y
 * así salían dos mentiras: D xx0232 «con cejilla», que se coge con tres dedos
 * sueltos, y la primera F que se ofrecía, 103211, con cejilla en el 1 **y la
 * quinta al aire debajo**, que no se puede tocar —el índice tumbado la pisa—.
 *
 * La cejilla solo hace falta cuando hay más cuerdas pisadas que dedos, y solo
 * vale si el índice, tumbado de la primera a la última cuerda del traste más
 * bajo, no tiene debajo ninguna cuerda al aire ni muda. Con ella, el índice es un
 * dedo y cada cuerda más arriba es otro.
 */
function cejillaQueHaceFalta(
  frets: readonly (number | null)[],
  pressed: readonly number[],
  position: number,
): boolean | null {
  if (pressed.length <= DEDOS) {
    return false;
  }

  const enElTraste = frets.flatMap((fret, cuerda) => (fret === position ? [cuerda] : []));
  if (enElTraste.length < 2) {
    return null;
  }

  const debajo = frets.slice(enElTraste[0]!, enElTraste[enElTraste.length - 1]! + 1);
  if (debajo.some((fret) => fret === null || fret === 0)) {
    return null;
  }

  const dedos = 1 + pressed.filter((fret) => fret > position).length;
  return dedos <= DEDOS ? true : null;
}

/**
 * Cuánto hay que tumbar la mano para pisar dos cuerdas del traste más bajo por
 * encima de otras que tienen que sonar al aire.
 *
 * El traste más bajo es el del índice, el de la cejilla. Dos yemas en él llegan a
 * dos cuerdas pegadas o con una en medio —A7 x02020, la tercera al aire entre
 * las dos—. Más separadas, el índice querría tumbarse como en una cejilla, y
 * entonces las del medio no suenan. Es lo que hacía que F saliera primero como
 * 10321x, «al aire», y Bm como x20402: se pueden escribir, y casi nadie las coge.
 * Solo en el traste más bajo: en G 320003 las dos del 3 están lejos, pero entre
 * ellas está el índice en el 2 y cada una lleva su dedo.
 *
 * Cuenta las cuerdas de más entre cada par, pasadas las dos que caben.
 */
function manoTumbada(frets: readonly (number | null)[], position: number): number {
  const enElTraste = frets.flatMap((fret, cuerda) =>
    position > 0 && fret === position ? [cuerda] : [],
  );

  let exceso = 0;
  for (let i = 1; i < enElTraste.length; i += 1) {
    const desde = enElTraste[i - 1]!;
    const hasta = enElTraste[i]!;
    if (frets.slice(desde + 1, hasta).some((fret) => fret === 0)) {
      exceso += Math.max(0, hasta - desde - 2);
    }
  }
  return exceso;
}

interface VoicingShape {
  readonly position: number;
  readonly open: number;
  readonly innerMutes: number;
  readonly tumbada: number;
  readonly barre: boolean;
  readonly sounding: number;
  readonly span: number;
  readonly chordSize: number;
}

/**
 * Lo que hace que una digitación sea la que uno toca de verdad.
 *
 * Manda la posición: un acorde en primera posición con cuerdas al aire es el
 * que se aprende y el que se usa, aunque más arriba del mástil existan diez
 * formas más. Después van las cuerdas al aire, y restan el estiramiento, las
 * mudas en medio, la mano tumbada sobre cuerdas al aire y la cejilla.
 *
 * Cuántas cuerdas suenan no es «cuantas más mejor»: una tríada abierta suena a
 * seis cuerdas, pero una quinta se toca con dos o tres. Por eso se compara con
 * lo que pide el acorde en vez de premiar el número a secas.
 */
function scoreVoicing(shape: VoicingShape): number {
  const ideal = shape.chordSize >= 3 ? 6 : 3;

  return (
    20 -
    shape.position * 2.2 +
    shape.open * 1.6 -
    shape.innerMutes * 3 -
    shape.tumbada * 2.5 -
    shape.span * 0.8 -
    Math.abs(shape.sounding - ideal) * 0.7 -
    (shape.barre ? 0.8 : 0)
  );
}

/**
 * Cómo se llama una forma en la interfaz.
 *
 * «Al aire» es lo que suena con cuerdas sueltas dentro de la primera posición de
 * la mano, y no solo lo que no pisa nada: con la posición a secas, G 320003 salía
 * «2.ª posición», C x32010 «1.ª posición» y Em 022000 «2.ª posición con
 * cejilla», que son los tres primeros acordes al aire de cualquiera.
 */
export function describeVoicing(forma: {
  /** El traste más bajo que se pisa, o cero si no se pisa ninguno. */
  readonly position: number;
  /** Cuántas cuerdas suenan al aire. */
  readonly open: number;
  /** El traste más alto que se pisa, o cero. */
  readonly top: number;
  readonly barre: boolean;
}): string {
  if (forma.position === 0 || (forma.open > 0 && forma.top <= TECHO_DEL_AIRE)) {
    return 'Al aire';
  }
  return `${forma.position}.ª posición${forma.barre ? ' con cejilla' : ''}`;
}

/**
 * Cómo se escribe una digitación en texto: x02210.
 *
 * Pegado mientras todos los trastes son de una cifra, que es como se escribe en
 * cualquier cancionero. **Con uno de dos cifras se separan**: «x8710108» no se
 * sabe si es 10-10-8 o 1-0-1-0-8, y es justo la que hay que leer bien.
 */
export function voicingToText(voicing: Voicing): string {
  const marcas = voicing.frets.map((fret) => (fret === null ? 'x' : String(fret)));
  const separar = voicing.frets.some((fret) => fret !== null && fret >= 10);
  return marcas.join(separar ? '-' : '');
}
