/**
 * Partir una dominante en su ii y ella: el ii–V de dos compases, o el de un compás
 * partido en dos.
 *
 * Es el movimiento que más hace un arreglista de jazz sobre una dominante larga
 * —un V de dos compases pasa a `ii | V`, uno de un compás a `ii V` a medias— y el
 * mismo sobre una secundaria: el `V/V` se parte en su ii y él. **No cabe en
 * `reharmonization.ts`**, y no por tamaño: allí todo cambia un grado por otro y deja
 * los pulsos donde estaban, y la comprobación de una rearmonización
 * (`pathProblem`) empareja tus compases con los propuestos uno a uno. Esto cambia
 * **uno por dos** sin cambiar los pulsos, así que trae su propia comprobación: quien
 * empareje por pulsos y encuentre dos acordes donde había uno pregunta aquí
 * (`esPartirEnIiV`).
 *
 * Cuando el V ya está escrito en dos compases sueltos —`V V`—, no hace falta
 * partir nada: el primero pasa a ii con la predominante (`predominante`, en
 * `reharmonization.ts`), que cambia un grado por otro.
 */

import type { ChordQuality } from './chords';
import { roleOfDegreeSymbol } from './harmonic-function';
import type { KeyMode } from './keys';
import { normalizePitchClass } from './notes';
import { degreeOfChord, degreesFor, resolveDegree, type DegreeSymbol } from './progressions';
import type { Entorno } from './reharmonization';

/** Un acorde con lo que dura, que es lo único que partir necesita saber de un compás. */
export interface AcordeConPulsos {
  readonly degree: DegreeSymbol;
  readonly beats: number;
}

/**
 * Adónde va una dominante: el V a la tónica y una secundaria a su grado. Nulo si no
 * es ninguna de las dos —el bVII, el vii°, la v del menor natural no tienen ii—.
 */
function objetivoDe(mode: KeyMode, dominante: DegreeSymbol): DegreeSymbol | null {
  if (dominante === 'V') {
    return mode === 'major' ? 'I' : 'i';
  }
  const barra = dominante.indexOf('/');
  return barra < 0 ? null : (dominante.slice(barra + 1) as DegreeSymbol);
}

/**
 * El ii de una dominante: el acorde una quinta por encima de ella, que la prepara
 * igual que el ii prepara el V.
 *
 * **Su especie sale de adónde va la dominante**: hacia un acorde mayor, el ii menor
 * —el `Dm7 G7 C` de siempre—; hacia uno menor, el semidisminuido —el `Bø7 E7 Am`—.
 * Cuando el catálogo no tiene el semidisminuido, el menor, que es como lo toca medio
 * jazz: `Em7 A7 Dm7`, el ii–V al ii de Do. Y si no tiene ninguno —la dominante del
 * iii en mayor, la del V en menor—, nulo: inventar el grado sería enseñar un acorde
 * que el resto del dominio no sabe pintar.
 */
export function iiDeLaDominante(mode: KeyMode, dominante: DegreeSymbol): DegreeSymbol | null {
  const objetivo = degreesFor(mode).includes(dominante) ? objetivoDe(mode, dominante) : null;
  if (objetivo === null) {
    return null;
  }
  const raiz = resolveDegree(0, mode, dominante).root;
  const especies: readonly ChordQuality[] =
    resolveDegree(0, mode, objetivo).quality === 'minor' ? ['diminished', 'minor'] : ['minor'];
  for (const especie of especies) {
    // Sin secundarias: el ii de una dominante es un acorde de la escala o un
    // prestado, nunca otra dominante.
    const ii = degreeOfChord(0, mode, normalizePitchClass(raiz + 7), especie, false);
    if (ii !== null) {
      return ii;
    }
  }
  return null;
}

/**
 * La dominante partida en dos mitades: la primera su ii, la segunda ella. Nulo si no
 * se puede.
 *
 * **No se parte por debajo de dos pulsos por mitad**: un V de dos pulsos partido en
 * dos de uno ya no es un ii–V sino dos golpes, y uno de tres no tiene mitad. No se
 * parte lo que **ya llega preparado** —con el ii delante, o con otra subdominante—,
 * ni la dominante que no va adonde iba: con el entorno, lo siguiente tiene que ser
 * su destino, una quinta por debajo.
 *
 * El V se queda con la especie que tenía, y la del ii la pone quien sabe en qué
 * idioma va la canción —el ii7 y la iiø7 del jazz, la tríada de un pop—.
 */
export function partirEnIiV(
  mode: KeyMode,
  dominante: AcordeConPulsos,
  entorno?: Entorno,
): readonly [AcordeConPulsos, AcordeConPulsos] | null {
  const ii = iiDeLaDominante(mode, dominante.degree);
  const anterior = entorno?.anterior ?? null;
  const siguiente = entorno?.siguiente ?? null;
  // Lo que ya llega preparado: con su ii delante, o con otra subdominante —`iv V`
  // partido daría `iv ii° V`, que prepara dos veces lo mismo—.
  // Y con el acorde mayor medio tono por encima, que baja a ella: el VI de la
  // andaluza ya la prepara, por semitono.
  const porSemitono = (grado: DegreeSymbol) => {
    const acorde = resolveDegree(0, mode, grado);
    return (
      acorde.quality === 'major' &&
      acorde.root === normalizePitchClass(resolveDegree(0, mode, dominante.degree).root + 1)
    );
  };
  const preparada =
    anterior !== null &&
    (anterior === ii || roleOfDegreeSymbol(anterior) === 'subdominant' || porSemitono(anterior));
  // Y un ii–V es una cadencia: se parte la dominante que llega adonde va, no la que
  // vuelve atrás —`ii V IV` no es ningún giro—.
  const llega =
    siguiente === null ||
    resolveDegree(0, mode, siguiente).root ===
      normalizePitchClass(resolveDegree(0, mode, dominante.degree).root - 7);
  if (
    ii === null ||
    !Number.isInteger(dominante.beats) ||
    dominante.beats < 4 ||
    dominante.beats % 2 !== 0 ||
    preparada ||
    !llega
  ) {
    return null;
  }
  const mitad = dominante.beats / 2;
  return [
    { degree: ii, beats: mitad },
    { degree: dominante.degree, beats: mitad },
  ];
}

/**
 * Si dos acordes son de verdad esa dominante partida en su ii y ella.
 *
 * Es la comprobación que sostiene el movimiento, como `isMove` sostiene los demás:
 * una salida que dice «partir en ii–V» y trae otro reparto u otro ii se cae.
 */
export function esPartirEnIiV(
  mode: KeyMode,
  antes: AcordeConPulsos,
  primero: AcordeConPulsos,
  segundo: AcordeConPulsos,
  entorno?: Entorno,
): boolean {
  const partido = partirEnIiV(mode, antes, entorno);
  return (
    partido !== null &&
    partido[0].degree === primero.degree &&
    partido[0].beats === primero.beats &&
    partido[1].degree === segundo.degree &&
    partido[1].beats === segundo.beats
  );
}

/**
 * Qué pasos de una propuesta ocupan el sitio de cada uno tuyo, **por pulsos**: uno
 * solo si dura lo mismo, o dos seguidos que suman lo que duraba el tuyo. Nulo si no
 * se pueden emparejar así.
 *
 * Es lo que deja comprobar, aplicar y nombrar una rearmonización con un ii–V
 * partido: emparejar uno a uno por posición desalineaba todo lo que va detrás del
 * partido, y el V de después pasaba a «cambiar» el compás que había a su lado. Con
 * los mismos pulsos y el mismo número de pasos, es emparejar uno a uno.
 */
export function gruposPorPulsos(
  original: readonly { readonly beats: number }[],
  propuesta: readonly { readonly beats: number }[],
): number[][] | null {
  const grupos: number[][] = [];
  let j = 0;
  for (const paso of original) {
    const uno = propuesta[j];
    const otro = propuesta[j + 1];
    if (uno !== undefined && uno.beats === paso.beats) {
      grupos.push([j]);
      j += 1;
    } else if (uno !== undefined && otro !== undefined && uno.beats + otro.beats === paso.beats) {
      grupos.push([j, j + 1]);
      j += 2;
    } else {
      return null;
    }
  }
  return j === propuesta.length ? grupos : null;
}
