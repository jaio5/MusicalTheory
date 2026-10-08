/**
 * El corpus de las salidas: **38 canciones a medias y lo que un arreglista
 * esperaría de ellas**, escrito para que lo compruebe una máquina.
 *
 * Hasta aquí lo único que se medía de las salidas era si pasaban el validador
 * (`songProblem`), y el validador dice si una salida está **permitida**, no si es
 * **buena**: todas pasaban y la mitad no convencían. Lo que acababa en V se cerraba
 * con `V IV I`, el bVII valía lo mismo en un jazz que en un rock y una canción de
 * cuatro compases salía de siete. Para afirmar que las salidas «saben cuándo
 * encaja qué acorde» hace falta poder contarlo.
 *
 * Nació en prosa: un arreglista escribió, caso por caso, qué propondría y qué
 * sería un error. Aquí está traducido a predicados sobre grados, pulsos y especies,
 * **sin exigir una sola respuesta donde hay varias buenas**: un `debe` es «alguna
 * de las tres primeras hace algo de esto», casi siempre con varias alternativas
 * (`o`), y un `noDebe` es lo que ninguna salida del menú puede hacer.
 *
 * **Las comprobaciones son de este corpus y no del juez** (`salidas/juez/`): si fueran
 * las mismas, el examen aprobaría por construcción todo lo que el juez prefiere.
 * Lo usan dos exámenes: `corpus-de-salidas.test.ts`, contra el menú que construye
 * el dominio, y `scripts/examen-de-las-salidas.ts`, contra lo que elige el modelo.
 * Y sus predicados, los otros dos corpus: el de verificación
 * (`corpus-de-verificacion.ts`) y el ciego (`corpus-ciego.ts`), que añadieron aquí
 * los que les faltaban.
 */

import { blockChord, writtenBlock } from '../../arrangement';
import type { EspecieDeBloque } from '../../chords';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { SectionRole } from '../../song';
import { STYLE_IDS } from '../../styles';
import type { ContextoDeSalidas } from '../contexto';
import type { PasoPosible, PathId, PathKind, PathStep, SalidaPosible } from '../tipos';

// --- Lo que miran los predicados ---------------------------------------------

/** Un compás de la salida que no es tuyo tal cual: nuevo, o cambiado al retocar. */
interface CompasNuevo extends PasoPosible {
  /** En qué posición de la canción está, desde 0. */
  readonly donde: number;
  /** Lo que había en esa posición, o nulo si el compás es nuevo. */
  readonly antes: PathStep | null;
}

/** Una salida preparada para examinarla: la canción entera y lo que trae de suyo. */
export interface SalidaExaminada {
  readonly path: PathId;
  readonly mode: KeyMode;
  readonly pulsosPorCompas: number;
  readonly tuyos: readonly PathStep[];
  /** La canción entera, todas las partes seguidas. */
  readonly cancion: readonly PasoPosible[];
  /**
   * Lo que pone la salida: al continuar, lo que va detrás de lo tuyo; al retocar,
   * los compases que cambian de grado o de pulsos.
   */
  readonly nuevos: readonly CompasNuevo[];
  /**
   * Lo que se sabe de lo tuyo además de los grados —especies, dudas, punteo—,
   * compás a compás como `tuyos`: lo miran los predicados que hablan de cómo
   * suena lo tuyo y no solo de qué grados son.
   */
  readonly contexto: ContextoDeSalidas;
  /**
   * Lo que la salida **dice de sí misma**: su nombre, su frase y los motivos del
   * juez. Es lo que se lee en pantalla, y una frase que miente es un fallo aunque
   * los acordes estén bien (lo encontró el corpus ciego).
   */
  readonly palabras: PalabrasDeLaSalida;
}

interface PalabrasDeLaSalida {
  readonly nombre: string;
  readonly que: string;
  /** Los motivos del juez que dicen algo: los vacíos no se leen en ningún sitio. */
  readonly motivos: readonly string[];
}

/** Algo que se puede decir de una salida, con la frase que lo cuenta en el informe. */
export interface Expectativa {
  readonly dice: string;
  readonly cumple: (salida: SalidaExaminada) => boolean;
}

/** Los pulsos de un compás si el contexto no dice otra cosa: el cuatro por cuatro. */
const PULSOS_POR_DEFECTO = 4;

/** Prepara una salida del menú para pasarle los predicados. */
export function examinar(
  mode: KeyMode,
  tuyos: readonly PathStep[],
  contexto: ContextoDeSalidas,
  salida: SalidaPosible,
): SalidaExaminada {
  const cancion = salida.secciones.flatMap((seccion) => seccion.steps);
  const nuevos = cancion
    .map((paso, donde): CompasNuevo => ({ ...paso, donde, antes: tuyos[donde] ?? null }))
    .filter(
      ({ degree, beats, antes }) =>
        antes === null || antes.degree !== degree || antes.beats !== beats,
    );
  return {
    path: salida.path,
    mode,
    pulsosPorCompas: contexto.pulsosPorCompas ?? PULSOS_POR_DEFECTO,
    tuyos,
    cancion,
    nuevos,
    contexto,
    palabras: {
      nombre: salida.nombre,
      que: salida.que,
      motivos: (salida.encaje?.criterios ?? [])
        .map((criterio) => criterio.motivo)
        .filter((motivo) => motivo !== ''),
    },
  };
}

// --- Medidas ------------------------------------------------------------------

function tonica(mode: KeyMode): DegreeSymbol {
  return mode === 'major' ? 'I' : 'i';
}

function pulsos(pasos: readonly PathStep[]): number {
  return pasos.reduce((total, paso) => total + paso.beats, 0);
}

/** Cuántos compases de verdad dura: por pulsos, no por bloques. */
function compases(salida: SalidaExaminada, pasos: readonly PathStep[]): number {
  return pulsos(pasos) / salida.pulsosPorCompas;
}

/**
 * Los grados sin repetir los seguidos: `I I IV IV V` es el giro `I IV V`.
 *
 * Un giro es lo que se oye, y un acorde que dura dos compases suena igual que dos
 * compases del mismo acorde.
 */
function giro(pasos: readonly PathStep[]): DegreeSymbol[] {
  return pasos
    .map((paso) => paso.degree)
    .filter((grado, i, grados) => i === 0 || grados[i - 1] !== grado);
}

function vecesQueSuena(grados: readonly DegreeSymbol[], buscado: readonly DegreeSymbol[]): number {
  let veces = 0;
  for (let i = 0; i + buscado.length <= grados.length; i += 1) {
    if (buscado.every((grado, j) => grados[i + j] === grado)) {
      veces += 1;
    }
  }
  return veces;
}

/**
 * Si unos pulsos caen fuera de la rejilla del compás: ni lo llenan a trozos
 * enteros ni son compases enteros. En cuatro por cuatro, 3, 5, 6 o 10.
 */
function fueraDeRejilla(beats: number, pulsosPorCompas: number): boolean {
  return beats % pulsosPorCompas !== 0 && pulsosPorCompas % beats !== 0;
}

function esSeptima(especie: EspecieDeBloque | null | undefined): boolean {
  return especie !== null && especie !== undefined && especie.endsWith('7');
}

// --- Predicados ---------------------------------------------------------------
//
// Cada uno dice lo que mira en una frase, que es lo que sale en el informe cuando
// falla. Hablan de la canción entera, de lo que trae la salida (`nuevos`) o de
// cómo queda frente a lo tuyo, y lo dicen en el nombre.

/** Que la canción **acabe** con ese giro: `cierraCon('V', 'I')` es una auténtica. */
export function cierraCon(...buscado: DegreeSymbol[]): Expectativa {
  return {
    dice: `termina con ${buscado.join('→')}`,
    cumple: (s) => giro(s.cancion).slice(-buscado.length).join(' ') === buscado.join(' '),
  };
}

export function cierraEnLaTonica(): Expectativa {
  return {
    dice: 'acaba en la tónica',
    cumple: (s) => s.cancion[s.cancion.length - 1]!.degree === tonica(s.mode),
  };
}

/**
 * Que el giro suene **más veces que en lo tuyo**: lo ha traído la salida. Mira la
 * costura con lo tuyo, así que un `IV I` detrás de tu V cuenta como `V→IV→I`.
 */
export function meteElGiro(...buscado: DegreeSymbol[]): Expectativa {
  return {
    dice: `mete ${buscado.join('→')}`,
    cumple: (s) => vecesQueSuena(giro(s.cancion), buscado) > vecesQueSuena(giro(s.tuyos), buscado),
  };
}

/** Lo primero que suena detrás de lo tuyo, al continuar. */
export function sigueCon(grado: DegreeSymbol): Expectativa {
  return {
    dice: `lo primero que sigue es ${grado}`,
    cumple: (s) => s.cancion[s.tuyos.length]?.degree === grado,
  };
}

/** Que lo que sigue empiece por tu parte otra vez: otro coro, el riff de nuevo. */
export function repiteLoTuyo(): Expectativa {
  return {
    dice: 'vuelve a tocar lo tuyo',
    cumple: (s) =>
      giro(s.cancion.slice(s.tuyos.length, s.tuyos.length * 2)).join(' ') ===
      giro(s.tuyos).join(' '),
  };
}

/** Que algún compás que pone la salida sea ese grado. */
export function pasaPor(grado: DegreeSymbol): Expectativa {
  return {
    dice: `pasa por ${grado}`,
    cumple: (s) => s.nuevos.some((paso) => paso.degree === grado),
  };
}

/** Un grado que **no estaba** en lo tuyo y la salida trae. */
export function meteElGrado(grado: DegreeSymbol): Expectativa {
  return {
    dice: `mete ${grado}, que no estaba`,
    cumple: (s) =>
      s.nuevos.some((paso) => paso.degree === grado) &&
      !s.tuyos.some((paso) => paso.degree === grado),
  };
}

/** Que la canción entera dure un múltiplo de `n` compases. */
export function cuadra(n: number): Expectativa {
  return {
    dice: `dura un múltiplo de ${n} compases`,
    cumple: (s) => {
      const largo = compases(s, s.cancion);
      return Number.isInteger(largo) && largo % n === 0;
    },
  };
}

export function duraCompases(n: number): Expectativa {
  return {
    dice: `dura ${n} compases en total`,
    cumple: (s) => compases(s, s.cancion) === n,
  };
}

/** Que añada exactamente `n` compases a lo tuyo. */
export function alarga(n: number): Expectativa {
  return {
    dice: `añade ${n} compases`,
    cumple: (s) => compases(s, s.cancion) - compases(s, s.tuyos) === n,
  };
}

/**
 * **La frase queda coja**: un número impar de compases.
 *
 * Con dos excepciones, porque las dos son buena música. **El acorde final**: una
 * frase cuadrada y la tónica en un compás más, que es como acaba media canción
 * —el arreglista propone `I` a secas detrás de un V—. Cuadrada es de cuatro en
 * cuatro, o de dos en dos si lo tuyo no llega a cuatro. Y **retocar sin cambiar el
 * largo**: si lo tuyo ya era impar, no lo ha estropeado la salida.
 */
export function fraseCoja(): Expectativa {
  return {
    dice: 'deja la frase coja: un número impar de compases',
    cumple: (s) => {
      const largo = compases(s, s.cancion);
      const tuyo = compases(s, s.tuyos);
      if (!Number.isInteger(largo) || largo % 2 === 0 || largo === tuyo) {
        return false;
      }
      const unidad = tuyo <= 2 ? 2 : 4;
      const acordeFinal =
        s.cancion[s.cancion.length - 1]!.degree === tonica(s.mode) && (largo - 1) % unidad === 0;
      return !acordeFinal;
    },
  };
}

/** Que la canción acabe a mitad de un compás, si lo tuyo no lo hacía. */
export function acabaAMitadDeCompas(): Expectativa {
  return {
    dice: 'acaba a mitad de compás',
    cumple: (s) => {
      const total = pulsos(s.cancion);
      return total % s.pulsosPorCompas !== 0 && total !== pulsos(s.tuyos);
    },
  };
}

export function compasDeUnPulso(): Expectativa {
  return {
    dice: 'pone un acorde de un pulso',
    cumple: (s) => s.nuevos.some((paso) => paso.beats <= 1),
  };
}

/**
 * Un compás con pulsos que no caen en la rejilla —tres, cinco, seis— y que **no
 * venía así**: heredar los pulsos desiguales de una toma es copiar el accidente.
 */
export function fueraDeLaRejilla(): Expectativa {
  return {
    dice: 'pone un acorde con pulsos fuera de la rejilla del compás',
    cumple: (s) =>
      s.nuevos.some(
        (paso) => fueraDeRejilla(paso.beats, s.pulsosPorCompas) && paso.beats !== paso.antes?.beats,
      ),
  };
}

/**
 * **Relleno**: un acorde que dura más del doble que el más largo de lo tuyo.
 *
 * Es la trampa de cuadrar a cualquier precio: un `I` de dieciséis pulsos detrás de
 * cuatro compases de a cuatro deja la frase en ocho y no propone nada. Mantener el
 * acorde final dos compases sí es música —el doble—; cuatro es tiempo muerto. Se
 * mide contra lo tuyo, así que una balada a ocho pulsos puede alargar a dieciséis.
 */
export function relleno(): Expectativa {
  return {
    dice: 'rellena: un acorde que dura más del doble que el más largo de lo tuyo',
    cumple: (s) => {
      const tope = 2 * Math.max(...s.tuyos.map((paso) => paso.beats));
      return s.nuevos.some((paso) => paso.beats > tope);
    },
  };
}

/**
 * Que lo que pone vaya a `p` pulsos por acorde: el ritmo armónico de lo tuyo. El
 * último de la canción puede durar más, si es múltiplo: es el acorde final.
 */
export function loNuevoVaA(p: number): Expectativa {
  return {
    dice: `lo nuevo va a ${p} pulsos por acorde`,
    cumple: (s) =>
      s.nuevos.every(
        (paso) => paso.beats === p || (paso.donde === s.cancion.length - 1 && paso.beats % p === 0),
      ),
  };
}

export function algoNuevoDura(p: number): Expectativa {
  return {
    dice: `pone un acorde de ${p} pulsos`,
    cumple: (s) => s.nuevos.some((paso) => paso.beats === p),
  };
}

/** Que todo lo que pone suene con séptima, como lo tuyo en un blues o un jazz. */
export function loNuevoConSeptima(): Expectativa {
  return {
    dice: 'lo nuevo suena con séptima',
    cumple: (s) => s.nuevos.length > 0 && s.nuevos.every((paso) => esSeptima(paso.especie)),
  };
}

/**
 * Que el grado del compás `n` (desde 1) ya no sea el tuyo. `salvo` son los que no
 * cuentan como cambiarlo: en un jazz, el iii por el I es la misma tónica.
 */
export function cambiaElCompas(n: number, salvo: readonly DegreeSymbol[] = []): Expectativa {
  return {
    dice:
      salvo.length === 0
        ? `cambia el acorde del compás ${n}`
        : `cambia el acorde del compás ${n} por otro que no es ${salvo.join(' ni ')}`,
    cumple: (s) => {
      const ahora = s.cancion[n - 1]?.degree;
      return ahora !== s.tuyos[n - 1]!.degree && (ahora === undefined || !salvo.includes(ahora));
    },
  };
}

/** Los grados que hacen de predominante: lo que va antes de la dominante, no la casa. */
const PREDOMINANTES: readonly DegreeSymbol[] = ['ii', 'IV', 'iv', 'ii°', 'bII', 'bVI'];

/**
 * **Que cambie el compás 1 cuando abre la frase**: la tónica, o lo que hace de
 * ella —el vi de un pop que empieza por él, el iii de un jazz—, o el centro de un
 * vaivén. El arreglista no lo cambia nunca, y por eso los corpus lo pedían quieto.
 *
 * Pero **el compás 1 no siempre abre así**: en un final `iv V i i`, un pre `ii iii
 * IV V` o un `ii V I I`, es la predominante, y cambiarla —el ii° o el bII por el
 * iv, el IV por el ii— es lo primero que haría (lo pidió el corpus final). Entonces
 * no cuenta. Un vaivén de dos acordes que empieza por ella sí la tiene de centro:
 * `ii V ii V` es Re dórico, y su ii es la casa.
 */
export function cambiaElCompasQueAbre(salvo: readonly DegreeSymbol[] = []): Expectativa {
  const cambia = cambiaElCompas(1, salvo);
  return {
    dice: `${cambia.dice}, que abre la frase`,
    cumple: (s) => {
      const [primero, segundo] = s.tuyos;
      const vaiven =
        segundo !== undefined &&
        s.tuyos.length >= 4 &&
        s.tuyos.every((paso, i) => paso.degree === (i % 2 === 0 ? primero : segundo)!.degree);
      return (vaiven || !PREDOMINANTES.includes(primero!.degree)) && cambia.cumple(s);
    },
  };
}

/** Que cambie el grado de alguno de los compases de `desde` a `hasta`, los dos incluidos. */
export function cambiaAlgunoEntre(desde: number, hasta: number): Expectativa {
  return {
    dice: `cambia algo de los compases ${desde} a ${hasta}`,
    cumple: (s) =>
      s.tuyos
        .slice(desde - 1, hasta)
        .some((paso, i) => s.cancion[desde - 1 + i]?.degree !== paso.degree),
  };
}

/**
 * Que **solo** cambie algo entre los compases `desde` y `hasta`, con el mismo
 * largo: el resto queda como estaba.
 */
export function soloCambiaEntre(desde: number, hasta: number): Expectativa {
  return {
    dice: `solo cambia los compases ${desde} a ${hasta}`,
    cumple: (s) =>
      s.cancion.length === s.tuyos.length &&
      s.nuevos.length > 0 &&
      s.nuevos.every((paso) => paso.donde >= desde - 1 && paso.donde <= hasta - 1),
  };
}

/** Que el compás `n` (desde 1) sea ese grado. */
export function compasEs(n: number, grado: DegreeSymbol): Expectativa {
  return {
    dice: `el compás ${n} es ${grado}`,
    cumple: (s) => s.cancion[n - 1]?.degree === grado,
  };
}

export function conservaElFinal(): Expectativa {
  return {
    dice: 'conserva tu último acorde',
    cumple: (s) => s.cancion[s.cancion.length - 1]!.degree === s.tuyos[s.tuyos.length - 1]!.degree,
  };
}

export function cambiaAlgo(): Expectativa {
  return { dice: 'cambia algo', cumple: (s) => s.nuevos.length > 0 };
}

export function cambiaTodos(): Expectativa {
  return {
    dice: 'no deja ni un acorde tuyo en su sitio',
    cumple: (s) => s.tuyos.every((paso, i) => s.cancion[i]?.degree !== paso.degree),
  };
}

/** Los mismos acordes en el mismo orden, todos a `p` pulsos: cuadrar o cambiar de tiempo. */
export function mismosAcordesA(p: number): Expectativa {
  return {
    dice: `los mismos acordes, todos a ${p} pulsos`,
    cumple: (s) =>
      s.cancion.length === s.tuyos.length &&
      s.cancion.every((paso, i) => paso.degree === s.tuyos[i]!.degree && paso.beats === p),
  };
}

export function esCamino(path: PathId): Expectativa {
  return { dice: `es un ${path}`, cumple: (s) => s.path === path };
}

/** Todas a la vez, **en la misma salida**. */
export function y(...todas: Expectativa[]): Expectativa {
  return {
    dice: todas.map((e) => e.dice).join(' y '),
    cumple: (s) => todas.every((e) => e.cumple(s)),
  };
}

/** Cualquiera: lo que se escribe cuando hay varias respuestas buenas. */
export function o(...alguna: Expectativa[]): Expectativa {
  return {
    dice: `(${alguna.map((e) => e.dice).join(' o ')})`,
    cumple: (s) => alguna.some((e) => e.cumple(s)),
  };
}

export function no(expectativa: Expectativa, dice = `no ${expectativa.dice}`): Expectativa {
  return { dice, cumple: (s) => !expectativa.cumple(s) };
}

/** Con otra frase para el informe: la del arreglista, cuando la suya se entiende mejor. */
export function dicho(dice: string, expectativa: Expectativa): Expectativa {
  return { dice, cumple: expectativa.cumple };
}

// --- Predicados de cómo suena ---------------------------------------------------
//
// Los de arriba miran grados y pulsos. Estos miran **notas**: la especie con que
// suena cada compás, la sensible, el punteo. Nacieron con el corpus de
// verificación, que encontró menús donde los grados estaban bien y lo que sonaba
// no: un riff de quintas continuado con tríadas, un iv prestado cambiado por un IV
// que deja dos compases iguales.

/** La especie con que tocas el compás `i` de lo tuyo: nula es la tríada del grado. */
function especieTuya(s: SalidaExaminada, i: number): EspecieDeBloque | null {
  return s.contexto.especies?.[i] ?? null;
}

/** El acorde de un compás sobre la tónica en Do: sus alturas son semitonos sobre ella. */
function acordeDe(mode: KeyMode, degree: DegreeSymbol, especie: EspecieDeBloque | null) {
  return blockChord(0, mode, writtenBlock('', degree, 4, especie ?? undefined));
}

/** El semitono por debajo de la tónica. */
const SENSIBLE = 11;

/**
 * Si el acorde **tira a la tónica con la sensible**: una dominante —raíz en el
 * quinto o en el séptimo grado— que la lleva dentro. Un Vsus4 o un V5 no la
 * llevan, y por eso se oyen en un modo sin sensible sin romperlo.
 */
function conSensible(mode: KeyMode, degree: DegreeSymbol, especie: EspecieDeBloque | null) {
  const { root, notes } = acordeDe(mode, degree, especie);
  return (root === 7 || root === SENSIBLE) && notes.includes(SENSIBLE);
}

/** Los préstamos del menor en una tonalidad mayor: el color que se elige a propósito. */
const PRESTADOS: readonly DegreeSymbol[] = ['bII', 'bIII', 'iv', 'bVI', 'bVII'];

/** Lo nuevo arranca en uno de estos grados: una estrofa en I, un estribillo en IV. */
export function empiezaEn(...grados: DegreeSymbol[]): Expectativa {
  return {
    dice: `lo nuevo arranca en ${grados.join(' o ')}`,
    cumple: (s) => grados.some((grado) => grado === s.cancion[s.tuyos.length]?.degree),
  };
}

/**
 * Pone un acorde **igual al de al lado** donde antes no lo era: cambiar el iv por
 * un IV detrás de otro IV deja dos compases iguales y empobrece la frase.
 *
 * La costura con lo tuyo no cuenta: empezar la parte nueva en el acorde con que
 * acabas es empezar otra vuelta, y sostener tu V un compás más es preparar la
 * entrada.
 */
export function repiteAlVecino(): Expectativa {
  return {
    dice: 'pone un acorde igual al de al lado, que antes no lo era',
    cumple: (s) =>
      s.nuevos.some((paso) =>
        [paso.donde - 1, paso.donde + 1].some(
          (j) =>
            !(paso.donde === s.tuyos.length && j === paso.donde - 1) &&
            s.cancion[j]?.degree === paso.degree &&
            !(paso.antes?.degree === paso.degree && s.tuyos[j]?.degree === paso.degree),
        ),
      ),
  };
}

/**
 * Trae una dominante con la sensible **que lo tuyo no tenía**: en un riff
 * mixolidio, un folk eólico o un rock de bVII, es lo que rompe el modo.
 */
export function meteLaSensible(): Expectativa {
  return {
    dice: 'mete la sensible, que lo tuyo no tenía',
    cumple: (s) =>
      s.nuevos.some((paso) => conSensible(s.mode, paso.degree, paso.especie ?? null)) &&
      !s.tuyos.some((paso, i) => conSensible(s.mode, paso.degree, especieTuya(s, i))),
  };
}

/**
 * Lo nuevo en un grado que tú tocas **suena como lo tocas**: tu V7 sigue siendo
 * V7 y tu I5 sigue siendo I5. Los grados que no tocas quedan libres.
 */
export function llevaTusEspecies(): Expectativa {
  return {
    dice: 'lo nuevo lleva la especie con que tocas ese grado',
    cumple: (s) =>
      s.nuevos.every((paso) => {
        const tuyas = s.tuyos.flatMap((tuyo, i) =>
          tuyo.degree === paso.degree ? [especieTuya(s, i)] : [],
        );
        return tuyas.length === 0 || tuyas.includes(paso.especie ?? null);
      }),
  };
}

/** Algo de lo que pone suena con esa especie: un maj7 en un blues, una quinta en un gospel. */
export function algoNuevoEn(especie: EspecieDeBloque): Expectativa {
  return {
    dice: `pone algo en ${especie}`,
    cumple: (s) => s.nuevos.some((paso) => paso.especie === especie),
  };
}

/**
 * Pone una dominante —el V o una secundaria— **sin su séptima**: en un gospel o un
 * jazz, la séptima es lo que la hace tirar.
 */
export function dominanteSinSeptima(): Expectativa {
  return {
    dice: 'pone una dominante sin su séptima',
    cumple: (s) =>
      s.nuevos.some(
        (paso) =>
          (paso.degree === 'V' || paso.degree.startsWith('V/')) && paso.especie !== 'dominant7',
      ),
  };
}

/** Trae una dominante secundaria cuando lo tuyo no tenía ninguna. */
export function meteUnaSecundaria(): Expectativa {
  const secundaria = (paso: PathStep) => paso.degree.startsWith('V/');
  return {
    dice: 'mete una dominante secundaria, que lo tuyo no tenía',
    cumple: (s) => s.nuevos.some(secundaria) && !s.tuyos.some(secundaria),
  };
}

/** Que el grado suene **en algún sitio** de la canción, tuyo o nuevo. */
export function tieneElGrado(grado: DegreeSymbol): Expectativa {
  return {
    dice: `suena ${grado} en algún sitio`,
    cumple: (s) => s.cancion.some((paso) => paso.degree === grado),
  };
}

/** Todo lo que pone suena con esa especie: un riff de quintas sigue en quintas. */
export function loNuevoEn(especie: EspecieDeBloque): Expectativa {
  return {
    dice: `lo nuevo suena en ${especie}`,
    cumple: (s) => s.nuevos.length > 0 && s.nuevos.every((paso) => paso.especie === especie),
  };
}

/**
 * Que **cambie la especie** de un compás tuyo que conserva el grado: tu Vsus4
 * convertido en un V a secas pierde lo que lo hacía tuyo.
 */
export function cambiaTuEspecie(): Expectativa {
  return {
    dice: 'cambia la especie de un acorde tuyo que se queda',
    cumple: (s) =>
      s.tuyos.some((paso, i) => {
        const ahora = s.cancion[i];
        return ahora?.degree === paso.degree && (ahora.especie ?? null) !== especieTuya(s, i);
      }),
  };
}

/**
 * Una nota fuerte del punteo **choca de frente** con un acorde que pone la salida:
 * no es suya y cae a un semitono de una que sí, como un Si contra un Bb o un Sol
 * contra un Lab. Una nota que no es del acorde pero no roza ninguna —un Fa sobre
 * un Lab— es color, no choque. **Y la novena tampoco**, aunque roce la tercera de
 * un acorde menor: un Mi sobre un Rem es una tensión que se canta a diario.
 */
export function chocaConElPunteo(): Expectativa {
  return {
    dice: 'pone un acorde contra el que choca de frente una nota fuerte del punteo',
    cumple: (s) =>
      s.nuevos.some((paso) =>
        (s.contexto.melodia?.[paso.donde] ?? []).some(
          ({ nota, fuerte }) => fuerte && chocaDeFrente(s.mode, paso, nota),
        ),
      ),
  };
}

/** La nota no es del acorde y cae a un semitono de una que sí, y no es su novena. */
function chocaDeFrente(mode: KeyMode, paso: PasoPosible, nota: number): boolean {
  const { root, notes } = acordeDe(mode, paso.degree, paso.especie ?? null);
  const notas: readonly number[] = notes;
  return (
    !notas.includes(nota) &&
    nota !== (root + 2) % 12 &&
    notas.some((n) => (n - nota + 12) % 12 === 1 || (nota - n + 12) % 12 === 1)
  );
}

/**
 * Lo que añade **se cuenta de `n` en `n` compases**: una forma de frases de tres
 * se continúa con frases de tres, y cuadrarla a ocho la contradice. Retocar sin
 * cambiar el largo no añade nada, y eso también se cuenta de `n` en `n`.
 */
export function respetaFrasesDe(n: number): Expectativa {
  return {
    dice: `lo que añade se cuenta de ${n} en ${n} compases`,
    cumple: (s) => {
      const anadido = compases(s, s.cancion) - compases(s, s.tuyos);
      return Number.isInteger(anadido) && anadido % n === 0;
    },
  };
}

/** Quita **todo** el préstamo que tenías: el iv, el bVI o el bVII que eran el color. */
export function pierdeElPrestado(): Expectativa {
  const prestado = (paso: PathStep) => PRESTADOS.includes(paso.degree);
  return {
    dice: 'quita todo el color prestado que tenías',
    cumple: (s) => s.mode === 'major' && s.tuyos.some(prestado) && !s.cancion.some(prestado),
  };
}

/** Cambia algún compás que el micro oyó con duda: lo prudente es no fiarse de él. */
export function cambiaLoDudoso(): Expectativa {
  return {
    dice: 'cambia un compás que se oyó con duda',
    cumple: (s) =>
      s.tuyos.some(
        (paso, i) => s.contexto.dudosos?.[i] === true && s.cancion[i]?.degree !== paso.degree,
      ),
  };
}

// --- Predicados de adónde va cada acorde ----------------------------------------
//
// Nacieron con el corpus ciego (`corpus-ciego.ts`), que encontró dominantes que no
// llegan a ningún sitio: un V/V que salta a la I, el I7 de un gospel cambiado por
// un vi que ya no tira al IV, un vii° pelado como cadencia de un country. Miran la
// fundamental y la tercera, no el nombre del grado: un D7 que va a un G va a su
// destino lo llame quien lo llame.

/** La fundamental de un compás, en semitonos sobre la tónica. */
function raizDe(mode: KeyMode, paso: PasoPosible): number {
  return acordeDe(mode, paso.degree, paso.especie ?? null).root;
}

/** Cuántos semitonos baja la fundamental de un acorde al siguiente. */
function bajaDe(mode: KeyMode, de: PasoPosible, a: PasoPosible): number {
  return (raizDe(mode, de) - raizDe(mode, a) + 12) % 12;
}

/**
 * Si un acorde **tira al de detrás**: es su dominante —una quinta por encima y con
 * la tercera mayor—, el sustituto tritonal —un semitono por encima, mayor— o el
 * disminuido de su sensible, un semitono por debajo.
 */
function tiraA(mode: KeyMode, de: PasoPosible, a: PasoPosible): boolean {
  const { root, notes } = acordeDe(mode, de.degree, de.especie ?? null);
  const notas: readonly number[] = notes;
  const mayor = notas.includes((root + 4) % 12);
  const disminuido = notas.includes((root + 3) % 12) && notas.includes((root + 6) % 12);
  const baja = bajaDe(mode, de, a);
  return ((baja === 7 || baja === 1) && mayor) || (baja === 11 && disminuido);
}

/** Las posiciones de la canción que pone la salida. */
function dondeHayNuevos(s: SalidaExaminada): ReadonlySet<number> {
  return new Set(s.nuevos.map((paso) => paso.donde));
}

/**
 * El acorde que suena detrás del de `j`, saltando los que lo repiten, y su
 * posición. Detrás del último de un contraste suena tu primer compás: es la vuelta
 * que el contraste promete.
 */
function siguienteDistinto(
  s: SalidaExaminada,
  j: number,
): { readonly paso: PasoPosible; readonly donde: number } | null {
  let k = j + 1;
  while (s.cancion[k]?.degree === s.cancion[j]!.degree) {
    k += 1;
  }
  const paso = s.cancion[k];
  if (paso !== undefined) {
    return { paso, donde: k };
  }
  const vuelta = s.tuyos[0]!;
  return s.path === 'contraste' ? { paso: { ...vuelta, move: null }, donde: k } : null;
}

const esSecundaria = (paso: PathStep) => paso.degree.startsWith('V/');

/**
 * **Una dominante secundaria que no va a su destino**: el V/V que salta a la I, el
 * V/vi que se queda colgado al final. Va si la fundamental baja una quinta —a su
 * destino, o a otra dominante en cadena— o un semitono, al sustituto tritonal del
 * destino. `tolerados` son los grados que el arreglista admite además en ese caso,
 * como el IV detrás de un V/V «como mínimo».
 *
 * Solo cuenta lo que ha decidido la salida: la secundaria, o lo que le pone detrás.
 */
export function secundariaQueNoResuelve(...tolerados: DegreeSymbol[]): Expectativa {
  return {
    dice:
      tolerados.length === 0
        ? 'pone una dominante secundaria que no va a su destino'
        : `pone una dominante secundaria que no va a su destino ni a ${tolerados.join(' ni a ')}`,
    cumple: (s) => {
      const nuevos = dondeHayNuevos(s);
      return s.cancion.some((paso, j) => {
        if (!esSecundaria(paso) || s.cancion[j + 1]?.degree === paso.degree) {
          return false;
        }
        const siguiente = siguienteDistinto(s, j);
        if (siguiente === null) {
          return nuevos.has(j);
        }
        if (!nuevos.has(j) && !nuevos.has(siguiente.donde)) {
          return false;
        }
        const baja = bajaDe(s.mode, paso, siguiente.paso);
        return baja !== 7 && baja !== 1 && !tolerados.includes(siguiente.paso.degree);
      });
    },
  };
}

/** Dos dominantes secundarias seguidas, una al menos puesta por la salida: el idioma del jazz. */
export function encadenaSecundarias(): Expectativa {
  return {
    dice: 'encadena dominantes secundarias, a lo jazz',
    cumple: (s) => {
      const nuevos = dondeHayNuevos(s);
      return s.cancion.some((paso, j) => {
        const siguiente = siguienteDistinto(s, j);
        return (
          esSecundaria(paso) &&
          siguiente !== null &&
          esSecundaria(siguiente.paso) &&
          (nuevos.has(j) || nuevos.has(siguiente.donde))
        );
      });
    },
  };
}

/**
 * **Cambia una dominante secundaria tuya por algo que ya no tira adonde iba**: el
 * I7 de un gospel, que lleva al IV, cambiado por un vi. Una secundaria es un V/x o
 * un acorde con séptima de dominante que no es el V, y que baja una quinta al de
 * detrás. Si la salida conserva el de detrás y cambia la secundaria, lo nuevo tiene
 * que seguir tirando a él —otra dominante, el tritonal o el disminuido— o, por lo
 * menos, **dejar el bajo cayendo la misma quinta**: el iii por el V/vi es la misma
 * llegada más suave, y el arreglista la da por buena.
 */
export function pierdeLaSecundaria(): Expectativa {
  return {
    dice: 'cambia una dominante secundaria tuya por algo que ya no tira adonde iba',
    cumple: (s) =>
      s.tuyos.some((tuyo, i) => {
        const destino = s.tuyos[i + 1];
        const ahora = s.cancion[i];
        const especie = especieTuya(s, i);
        const secundaria = {
          degree: tuyo.degree,
          beats: tuyo.beats,
          move: null,
          especie,
        } satisfies PasoPosible;
        return (
          destino !== undefined &&
          ahora !== undefined &&
          (esSecundaria(tuyo) || (especie === 'dominant7' && tuyo.degree !== 'V')) &&
          tiraA(s.mode, secundaria, { ...destino, move: null }) &&
          ahora.degree !== tuyo.degree &&
          s.cancion[i + 1]?.degree === destino.degree &&
          !tiraA(s.mode, ahora, s.cancion[i + 1]!) &&
          bajaDe(s.mode, ahora, s.cancion[i + 1]!) !== 7
        );
      }),
  };
}

/**
 * **Un vii° pelado como cadencia**: la tríada disminuida que va a la tónica. En
 * un coral es una dominante sin fundamental; en un country, un pop o un funk no
 * se toca, y lo que hace ese papel es el V.
 */
export function cadenciaDeViiTriada(): Expectativa {
  return {
    dice: 'cierra con la tríada del vii°, que en música popular no se toca',
    cumple: (s) => {
      const nuevos = dondeHayNuevos(s);
      return s.cancion.some(
        (paso, j) =>
          paso.degree === 'vii°' &&
          (paso.especie ?? null) === null &&
          s.cancion[j + 1]?.degree === tonica(s.mode) &&
          (nuevos.has(j) || nuevos.has(j + 1)),
      );
    },
  };
}

/** Las séptimas que no son mayores: las del idioma de dominantes del blues y el funk. */
const SEPTIMAS_SIN_SEPTIMA_MAYOR: readonly (EspecieDeBloque | null | undefined)[] = [
  'dominant7',
  'minor7',
  'halfDiminished7',
  'diminished7',
];

/**
 * **Lo nuevo habla el idioma de dominantes**: todo con séptima, y ninguna mayor.
 * En un vamp de I7 o un blues, el IV es IV7 y no IVmaj7: la séptima mayor es de
 * otra música. Los menores van con su m7.
 */
export function loNuevoComoDominantes(): Expectativa {
  return {
    dice: 'lo nuevo habla el idioma de dominantes: séptimas, y ninguna mayor',
    cumple: (s) =>
      s.nuevos.length > 0 &&
      s.nuevos.every((paso) => SEPTIMAS_SIN_SEPTIMA_MAYOR.includes(paso.especie)),
  };
}

/** Que lo que pone tenga ese grado **con esa especie**: el IV7 de un funk, la ii° tríada. */
export function poneComo(grado: DegreeSymbol, especie: EspecieDeBloque | null): Expectativa {
  return {
    dice: `pone ${grado} ${especie === null ? 'en tríada' : `en ${especie}`}`,
    cumple: (s) =>
      s.nuevos.some((paso) => paso.degree === grado && (paso.especie ?? null) === especie),
  };
}

/** Que todo lo que pone dure múltiplos de `n` pulsos: en un 6/8, de tres en tres. */
export function loNuevoEnMultiplosDe(n: number): Expectativa {
  return {
    dice: `lo nuevo dura múltiplos de ${n} pulsos`,
    cumple: (s) => s.nuevos.every((paso) => paso.beats % n === 0),
  };
}

export function duraMasDe(n: number): Expectativa {
  return {
    dice: `dura más de ${n} compases`,
    cumple: (s) => compases(s, s.cancion) > n,
  };
}

/**
 * **Un contraste que reposa en la tónica**: el puente es irse y volver, y uno que
 * vuelve a casa **dos veces** por el camino —`V I vi IV I V/ii ii V`— no se ha ido.
 * Pasar una vez es de camino, y la vuelta a lo tuyo no cuenta: es lo tuyo. Es lo
 * mismo que el juez cuenta como «pasa 2 veces por la I: contrasta menos», y el
 * arreglista lo encontró arriba del menú.
 */
export function contrasteQueReposaEnLaTonica(): Expectativa {
  return {
    dice: 'un contraste que reposa en la tónica en vez de irse',
    cumple: (s) =>
      s.path === 'contraste' &&
      giro(s.cancion.slice(s.tuyos.length)).filter((grado) => grado === tonica(s.mode)).length >= 2,
  };
}

/** Desde dónde se llega a la tónica de verdad: dominantes, plagales y modales. */
const LLEGADAS: readonly DegreeSymbol[] = ['V', 'vii°', 'bII', 'IV', 'iv', 'bVII', 'VII', 'v'];

/** Si desde ese acorde llegar a la tónica es una cadencia: lo que la prepara o lleva la sensible. */
function llegaALaTonica(mode: KeyMode, paso: PasoPosible): boolean {
  return LLEGADAS.includes(paso.degree) || conSensible(mode, paso.degree, paso.especie ?? null);
}

/**
 * **Una nota del punteo que choca con el acorde que suena debajo de verdad**, en
 * su sitio en el tiempo: al estirar, tu punteo se queda donde lo tocaste, y la
 * nota del compás 3 cae debajo del acorde que ahora ocupa ese tiempo.
 *
 * Las fuertes chocan como en `chocaConElPunteo`, contra el acorde del pulso
 * fuerte. **Las débiles también cuentan**, solo si quedan un semitono por encima
 * de una nota del acorde —la novena menor, la que no se aguanta— y con todos los
 * acordes que suenan en su compás, porque no se sabe en qué pulso caen. Un Fa
 * débil bajo un D7 es su novena aumentada y se canta a diario; un Si débil sobre
 * un Bb, no. Lo que ya sonaba así en lo tuyo no cuenta.
 */
export function chocaConElPunteoDondeSuena(): Expectativa {
  return {
    dice: 'pone un acorde que choca con una nota de tu punteo, fuerte o débil, donde suena',
    cumple: (s) => {
      const melodia = s.contexto.melodia ?? [];
      const inicios = iniciosDe(s.cancion);
      const tuyosEmpiezan = iniciosDe(s.tuyos);
      return s.tuyos.some((tuyo, i) => {
        const empieza = tuyosEmpiezan[i]!;
        const suyo = (paso: PasoPosible) =>
          paso.degree === tuyo.degree && (paso.especie ?? null) === especieTuya(s, i);
        const debajo = s.cancion.filter(
          (paso, j) => inicios[j]! < empieza + tuyo.beats && inicios[j]! + paso.beats > empieza,
        );
        // El que suena en el pulso fuerte: el que ya sonaba al empezar tu compás.
        const enElFuerte = s.cancion.find(
          (paso, j) => inicios[j]! <= empieza && inicios[j]! + paso.beats > empieza,
        );
        return (melodia[i] ?? []).some(({ nota, fuerte }) =>
          fuerte
            ? enElFuerte !== undefined &&
              !suyo(enElFuerte) &&
              chocaDeFrente(s.mode, enElFuerte, nota)
            : debajo.length > 0 &&
              debajo.every((paso) => !suyo(paso) && novenaMenor(s.mode, paso, nota)),
        );
      });
    },
  };
}

/** Dónde empieza cada compás de una canción, en pulsos. */
function iniciosDe(pasos: readonly PathStep[]): number[] {
  return pasos.map((_, j) => pulsos(pasos.slice(0, j)));
}

/** La nota no es del acorde y queda un semitono por encima de una que sí. */
function novenaMenor(mode: KeyMode, paso: PasoPosible, nota: number): boolean {
  const notas: readonly number[] = acordeDe(mode, paso.degree, paso.especie ?? null).notes;
  return !notas.includes(nota) && notas.some((n) => (nota - n + 12) % 12 === 1);
}

// --- Predicados de lo que dice de sí misma ----------------------------------------
//
// Una salida trae su nombre y su frase, y el juez sus motivos: todo eso se lee en
// pantalla y llega al modelo como verdad. El corpus ciego encontró cinco frases
// falsas; cada una es un predicado, y `diceAlgoFalso` las junta.

/** El nombre y la frase de la salida: lo que escribe quien la construyó. */
function rotulos(s: SalidaExaminada): string[] {
  return [s.palabras.nombre, s.palabras.que];
}

/** «Resuelve en la I» detrás de algo que no resuelve en ella: un V/V, un ii, la propia I. */
export function resuelveSinResolver(): Expectativa {
  return {
    dice: 'dice que resuelve en la tónica y llega desde algo que no resuelve',
    cumple: (s) => {
      if (!rotulos(s).some((texto) => /resuelve en la (?:I|i)\b/i.test(texto))) {
        return false;
      }
      const llegada = s.nuevos.find((paso) => paso.degree === tonica(s.mode));
      const antes = llegada === undefined ? undefined : s.cancion[llegada.donde - 1];
      return antes === undefined || !llegaALaTonica(s.mode, antes);
    },
  };
}

/** «ii I: cadencia plagal»: plagal es desde el IV o el iv, y nada más. */
export function plagalQueNoLoEs(): Expectativa {
  return {
    dice: 'llama cadencia plagal a lo que no llega desde el IV ni el iv',
    cumple: (s) =>
      [...rotulos(s), ...s.palabras.motivos].some((texto) =>
        [...texto.matchAll(/(\S+) (?:I|i): cadencia plagal/g)].some(
          ([, desde]) => desde !== 'IV' && desde !== 'iv',
        ),
      ),
  };
}

/** «Cuadra lo desigual» cuando todo lo tuyo cae en la rejilla: una tónica sostenida no es desigual. */
export function desigualQueNoLoEs(): Expectativa {
  return {
    dice: 'dice que cuadra lo desigual, y lo tuyo ya caía en la rejilla',
    cumple: (s) =>
      rotulos(s).some((texto) => /desigual/i.test(texto)) &&
      !s.tuyos.some((paso) => fueraDeRejilla(paso.beats, s.pulsosPorCompas)),
  };
}

/**
 * «En el 5» donde el compás 5 no cambia: cuenta acordes y no compases. Con
 * acordes de dos pulsos, el quinto acorde está en el compás 3.
 */
export function compasQueNoEs(): Expectativa {
  return {
    dice: 'dice «en el N» y en el compás N no cambia nada: cuenta acordes, no compases',
    cumple: (s) => {
      const inicios = iniciosDe(s.cancion);
      return rotulos(s).some((texto) =>
        [...texto.matchAll(/\b(?:en|y) el (\d+)\b/g)].some(([, n]) => {
          const desde = (Number(n) - 1) * s.pulsosPorCompas;
          const hasta = desde + s.pulsosPorCompas;
          return !s.nuevos.some(
            (paso) => inicios[paso.donde]! < hasta && inicios[paso.donde]! + paso.beats > desde,
          );
        }),
      );
    },
  };
}

/** «Engaña al oído» sin dominante delante: lo que engaña es prometer la tónica con el V. */
export function enganaSinDominante(): Expectativa {
  return {
    dice: 'dice que engaña al oído sin una dominante que prometa la tónica',
    cumple: (s) => {
      if (!rotulos(s).some((texto) => /engaña al oído/i.test(texto))) {
        return false;
      }
      const ultimo = s.cancion[s.cancion.length - 1]!;
      const antes = [...s.cancion].reverse().find((paso) => paso.degree !== ultimo.degree);
      return (
        antes === undefined ||
        !(antes.degree === 'V' || conSensible(s.mode, antes.degree, antes.especie ?? null))
      );
    },
  };
}

// --- Más frases falsas: las del corpus final ---------------------------------------
//
// El corpus final encontró otras seis maneras de mentir, y las seis se leían en
// pantalla: el nombre llamaba estribillo a lo que el motivo llamaba pre, un acorde
// de quintas salía «con sensible» o «prestado» por una tercera que no tiene, una v
// menor «resolvía como dominante», el «en el 9» de una canción de ocho compases y
// los plurales de uno.

/** Qué parte dice el nombre que se añade: un papel, la tuya completada o la misma otra vez. */
type ParteDelNombre = SectionRole | 'tuya' | 'misma' | null;

/** Cómo empieza el nombre de cada parte, y qué es. */
const PARTES_DEL_NOMBRE: readonly (readonly [RegExp, ParteDelNombre])[] = [
  [/^(?:Un )?[Ee]stribillo\b/u, 'estribillo'],
  [/^(?:Una )?[Ee]strofa\b/u, 'estrofa'],
  [/^(?:Un )?[Pp]uente\b/u, 'puente'],
  [/^(?:Un )?[Ff]inal\b/u, 'final'],
  [/^(?:Una )?[Cc]oda\b/u, 'final'],
  [/^(?:Una )?[Vv]uelta\b/u, 'estribillo'],
  [/^(?:Un )?[Pp]re\b/u, 'pre'],
  [/^(?:Cierre|Resuelve en la|Vuelve a la|Acaba en la)\b/u, 'tuya'],
  [/^(?:Segunda vuelta|Otro coro|Otra vuelta|Otro estribillo)\b/u, 'misma'],
];

function parteDelNombre(nombre: string): ParteDelNombre {
  return PARTES_DEL_NOMBRE.find(([patron]) => patron.test(nombre))?.[1] ?? null;
}

/** «la estrofa», «el pre»: cómo dice el juez cada papel en sus motivos. */
const PAPEL_EN_EL_MOTIVO: Readonly<Record<string, SectionRole>> = {
  intro: 'intro',
  estrofa: 'estrofa',
  pre: 'pre',
  estribillo: 'estribillo',
  puente: 'puente',
  solo: 'solo',
  final: 'final',
};

/**
 * **El nombre y el motivo no están de acuerdo en qué parte se añade**: «Un
 * estribillo por I V/ii ii V» con «Lo que sigue, el pre, acaba en V»; o el motivo
 * habla de tu intro —«La intro acaba en V»— cuando el nombre dice que lo añadido es
 * una estrofa, otra parte. Al continuar, que es cuando se añade algo.
 */
export function parteQueSeContradice(): Expectativa {
  return {
    dice: 'el nombre y el motivo no dicen la misma parte',
    cumple: (s) => {
      if (s.path !== 'seguir' && s.path !== 'contraste') {
        return false;
      }
      const delNombre = parteDelNombre(s.palabras.nombre);
      const tuyo = s.contexto.papel;
      return s.palabras.motivos.some((motivo) => {
        const sigue = /Lo que sigue, (?:el|la) (\p{L}+),/u.exec(motivo);
        if (sigue !== null) {
          const papel = PAPEL_EN_EL_MOTIVO[sigue[1]!];
          return (
            delNombre === 'tuya' ||
            delNombre === 'misma' ||
            (delNombre !== null && delNombre !== papel)
          );
        }
        // Lo que dice el juez de tu parte, cuando el nombre dice que lo añadido es otra.
        const deLaTuya = /^(?:La|El) (\p{L}+) /u.exec(motivo);
        return (
          deLaTuya !== null &&
          tuyo !== undefined &&
          PAPEL_EN_EL_MOTIVO[deLaTuya[1]!] === tuyo &&
          delNombre !== null &&
          delNombre !== 'tuya' &&
          delNombre !== 'misma'
        );
      });
    },
  };
}

/** Las notas de la escala del modo, en semitonos sobre la tónica. */
const ESCALA: Readonly<Record<KeyMode, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Los grados que en la canción **solo suenan en quintas**. */
function soloEnQuintas(s: SalidaExaminada): Set<DegreeSymbol> {
  const especieEn = (i: number) =>
    i < s.tuyos.length && s.cancion[i]?.degree === s.tuyos[i]!.degree
      ? (s.cancion[i]!.especie ?? especieTuya(s, i))
      : (s.cancion[i]!.especie ?? null);
  const grados = new Set(s.cancion.map((paso) => paso.degree));
  return new Set(
    [...grados].filter((grado) =>
      s.cancion.every((paso, i) => paso.degree !== grado || especieEn(i) === 'quinta'),
    ),
  );
}

/** Un grado como palabra suelta en un texto: el `iv` de «desde el iv», no el de «iv7». */
function nombra(texto: string, grado: DegreeSymbol): boolean {
  return new RegExp(`(?<![\\p{L}/°])${grado.replace(/[/°]/g, '\\$&')}(?![\\p{L}°/0-9])`, 'u').test(
    texto,
  );
}

/**
 * **Un acorde de quintas descrito por una tercera que no tiene**: sin tercera no es
 * mayor ni menor, no lleva sensible y no es prestado por ella. Tres maneras de
 * decirlo: llamarlo «con sensible» o «sin sensible», llamarlo préstamo cuando sus
 * dos notas son de la escala, y nombrar en mayor un iv que suena igual que el IV.
 */
export function quintaConTercera(): Expectativa {
  return {
    dice: 'describe un acorde de quintas por una tercera que no tiene',
    cumple: (s) => {
      const quintas = soloEnQuintas(s);
      if (quintas.size === 0) {
        return false;
      }
      // «Con sensible» y «sin sensible» de un cambio de quintas: ni la tenía ni la trae.
      const cambiaSinTercera = s.nuevos.some(
        (paso) =>
          paso.move === 'modal' &&
          quintas.has(paso.degree) &&
          (paso.antes === null || especieTuya(s, paso.donde) === 'quinta'),
      );
      if (
        cambiaSinTercera &&
        rotulos(s).some((texto) => /\b(?:[Cc]on|[Ss]in) sensible\b/u.test(texto))
      ) {
        return true;
      }
      // Lo que trae la salida, no lo tuyo: tu iv5 se llama como tú lo escribiste.
      const tuyos = new Set(s.tuyos.map((paso) => paso.degree));
      const textos = [...rotulos(s), ...s.palabras.motivos];
      return [...quintas].some((grado) => {
        if (tuyos.has(grado) || !s.nuevos.some((paso) => paso.degree === grado)) {
          return false;
        }
        const { root } = acordeDe(s.mode, grado, 'quinta');
        const deLaEscala =
          ESCALA[s.mode].includes(root) && ESCALA[s.mode].includes((root + 7) % 12);
        if (!deLaEscala) {
          return false;
        }
        const g = grado.replace(/[/°]/g, '\\$&');
        const prestamo = new RegExp(
          `(?<![\\p{L}/°])${g}(?:\\(quinta\\))?(?: es|,) un préstamo|(?<![\\p{L}/°])${g} prestado`,
          'u',
        );
        // En mayor, el iv5 es el IV5: nombrarlo ya es decir que suena distinto.
        return textos.some(
          (texto) =>
            prestamo.test(texto) || (s.mode === 'major' && grado === 'iv' && nombra(texto, grado)),
        );
      });
    },
  };
}

/**
 * **«La dominante resuelve en la tónica» desde un V que no lleva la sensible**: una
 * v menor (especie `menor`) o un Vsus4 llegan a casa, pero no resuelven como
 * dominante. El de quintas sí cuenta: no tiene tercera, ni mayor ni menor, y su
 * bajo es el de la dominante.
 */
export function dominanteSinSensible(): Expectativa {
  return {
    dice: 'dice que la dominante resuelve desde un V sin sensible',
    cumple: (s) =>
      s.palabras.motivos.some((motivo) => {
        const enlace = /^(\S+) (\S+): la dominante resuelve en la tónica/u.exec(motivo);
        if (enlace === null || enlace[1] !== 'V') {
          return false;
        }
        const especieEn = (i: number) =>
          s.cancion[i]!.especie !== undefined
            ? s.cancion[i]!.especie!
            : i < s.tuyos.length && s.cancion[i]!.degree === s.tuyos[i]!.degree
              ? especieTuya(s, i)
              : null;
        // Detrás del último va el primero: «tu bucle vuelve a empezar por V I».
        return !s.cancion.some(
          (paso, i) =>
            paso.degree === 'V' &&
            (s.cancion[i + 1] ?? s.cancion[0])!.degree === enlace[2] &&
            (especieEn(i) === 'quinta' || conSensible(s.mode, 'V', especieEn(i))),
        );
      }),
  };
}

/** Un grado como lo escribe el juez, con la séptima pegada: el `I7` de «I7 IV en el 13». */
function sinEspecie(escrito: string): string {
  return escrito.replace(/7$/u, '');
}

/**
 * **«X Y en el N» en los motivos, con el compás contado mal**: el enlace no está en
 * el compás N —ni empieza ahí lo que llega ni lo que lo prepara—. Es contar acordes
 * y no compases: con acordes de dos pulsos, el noveno acorde está en el compás 5, y
 * «V i en el 9» de una canción de ocho compases no está en ningún sitio. «X por Y
 * en el N» pide que en el compás N suene Y.
 */
export function compasQueNoEsEnLosMotivos(): Expectativa {
  return {
    dice: 'un motivo dice «en el N» de un enlace que no está en el compás N',
    cumple: (s) => {
      const inicios = iniciosDe(s.cancion);
      const enElCompas = (j: number, n: number) =>
        Math.floor(inicios[j]! / s.pulsosPorCompas) === n - 1;
      return s.palabras.motivos.some((motivo) => {
        const cambio = /^(\S+) por (\S+) en el (\d+)\b/u.exec(motivo);
        if (cambio !== null) {
          const [, , y, n] = cambio;
          return !s.cancion.some(
            (paso, j) =>
              paso.degree === sinEspecie(y!) &&
              inicios[j]! < Number(n) * s.pulsosPorCompas &&
              inicios[j]! + paso.beats > (Number(n) - 1) * s.pulsosPorCompas,
          );
        }
        const enlace = /^(\S+) (\S+) en el (\d+)\b/u.exec(motivo);
        if (enlace === null) {
          return false;
        }
        const [, x, y, n] = enlace;
        const ultimo = s.cancion.length - 1;
        // Detrás del último va la vuelta: tu primer compás, o la tónica que se espera.
        const vuelta =
          s.cancion[ultimo]!.degree === sinEspecie(x!) &&
          enElCompas(ultimo, Number(n)) &&
          (s.cancion[0]!.degree === sinEspecie(y!) || tonica(s.mode) === sinEspecie(y!));
        return (
          !vuelta &&
          !s.cancion.some(
            (paso, j) =>
              j > 0 &&
              paso.degree === sinEspecie(y!) &&
              s.cancion[j - 1]!.degree === sinEspecie(x!) &&
              (enElCompas(j, Number(n)) || enElCompas(j - 1, Number(n))),
          )
        );
      });
    },
  };
}

/** «Comparten 1 notas», «1 de 1 notas», «comparten 0 notas»: el número no concuerda. */
export function pluralDeUno(): Expectativa {
  return {
    dice: 'dice «1 notas» o «0 notas»: el número no concuerda',
    cumple: (s) =>
      [...rotulos(s), ...s.palabras.motivos].some((texto) =>
        /(?<![\d,])[01] (?:notas|compases|acordes|pulsos|veces)\b/u.test(texto),
      ),
  };
}

/**
 * Las frases falsas, juntas: lo que no puede decir ninguna salida. Las cinco del
 * corpus ciego y las cinco del final.
 */
export function diceAlgoFalso(): Expectativa {
  return dicho(
    'dice de sí misma algo que no es verdad',
    o(
      resuelveSinResolver(),
      plagalQueNoLoEs(),
      desigualQueNoLoEs(),
      compasQueNoEs(),
      enganaSinDominante(),
      parteQueSeContradice(),
      quintaConTercera(),
      dominanteSinSensible(),
      compasQueNoEsEnLosMotivos(),
      pluralDeUno(),
    ),
  );
}

// --- Predicados del corpus final -------------------------------------------------
//
// Nacieron con el corpus final (`corpus-final.ts`): un ritmo armónico de dos
// compases por acorde que lo nuevo rompía, pulsos de dos que dejaban un acorde
// cruzando la barra, y un acorde que el micro oyó con duda sosteniendo la
// cadencia que cierra la canción.

/**
 * **Lo nuevo cambia de acorde cada `pulsos` o más**: una estrofa que va a dos
 * compases por acorde se sigue a dos compases por acorde. Mira cada racha del
 * mismo grado en lo que añade, y la última puede durar más si es múltiplo: es el
 * acorde final.
 */
export function loNuevoCambiaCada(pulsosPorAcorde: number): Expectativa {
  return {
    dice: `lo nuevo cambia de acorde cada ${pulsosPorAcorde} pulsos, como lo tuyo`,
    cumple: (s) => {
      const nuevo = s.cancion.slice(s.tuyos.length);
      const rachas: number[] = [];
      nuevo.forEach((paso, i) => {
        if (i > 0 && nuevo[i - 1]!.degree === paso.degree) {
          rachas[rachas.length - 1]! += paso.beats;
        } else {
          rachas.push(paso.beats);
        }
      });
      return rachas.length > 0 && rachas.every((racha) => racha % pulsosPorAcorde === 0);
    },
  };
}

/**
 * **Un acorde que pone la salida cruza la barra**: empieza a mitad de compás y
 * acaba en el siguiente. Un ii°–V de dos pulsos cada uno llena un compás; un
 * acorde de dos suelto delante de uno de cuatro deja todo lo de detrás desplazado.
 */
export function cruzaLaBarra(): Expectativa {
  return {
    dice: 'pone un acorde que empieza a mitad de compás y cruza la barra',
    cumple: (s) => {
      const inicios = iniciosDe(s.cancion);
      return s.nuevos.some((paso) => {
        const desde = inicios[paso.donde]! % s.pulsosPorCompas;
        return desde !== 0 && desde + paso.beats > s.pulsosPorCompas;
      });
    },
  };
}

/** Los grados tuyos que el micro oyó con duda y la salida deja como estaban. */
function dudososQueSeQuedan(s: SalidaExaminada): number[] {
  return s.tuyos.flatMap((paso, i) =>
    s.contexto.dudosos?.[i] === true && s.cancion[i]?.degree === paso.degree ? [i] : [],
  );
}

/**
 * **La cadencia que cierra la canción descansa en un acorde dudoso**: lo último
 * que suena antes de la tónica final es tuyo, se oyó con duda y sigue ahí. Si el
 * micro se equivocó, la canción no cierra; lo prudente es una cadencia que la
 * salida ponga entera.
 */
export function cierraSobreLoDudoso(): Expectativa {
  return {
    dice: 'cierra con una cadencia que depende de un acorde que se oyó con duda',
    cumple: (s) => {
      if (s.cancion[s.cancion.length - 1]!.degree !== tonica(s.mode)) {
        return false;
      }
      let j = s.cancion.length - 1;
      while (j > 0 && s.cancion[j - 1]!.degree === tonica(s.mode)) {
        j -= 1;
      }
      return dudososQueSeQuedan(s).includes(j - 1);
    },
  };
}

/**
 * **Cita como seguro un acorde dudoso**: «de tu VII a la i» sobre un VII que el
 * micro no tiene claro. Nombrarlo no es mentir si se dice que se oyó con duda.
 */
export function citaLoDudosoComoSeguro(): Expectativa {
  return {
    dice: 'cita como seguro un acorde tuyo que se oyó con duda',
    cumple: (s) => {
      const dudosos = dudososQueSeQuedan(s).map((i) => s.tuyos[i]!.degree);
      return [...rotulos(s), ...s.palabras.motivos].some(
        (texto) =>
          !/duda/i.test(texto) &&
          dudosos.some((grado) =>
            new RegExp(`\\btu ${grado.replace(/[/°]/g, '\\$&')}(?![\\p{L}°/])`, 'u').test(texto),
          ),
      );
    },
  };
}

// --- El corpus -----------------------------------------------------------------

/**
 * De qué va cada caso, para leer la nota por partes: un generador que mejora los
 * cierres y empeora las frases no se ve en una cifra sola. Al retocar, todos van a
 * la familia `retocar`.
 */
type Familia = 'acaba-en-V' | 'frase' | 'estilo' | 'modal-forma';

/** Lo que se espera de una de las dos peticiones. */
export interface LoQueSeEspera {
  /** Cada una la tiene que cumplir **alguna** de las tres primeras del menú. */
  readonly debe: readonly Expectativa[];
  /** Ninguna salida del menú puede cumplir ninguna. */
  readonly noDebe: readonly Expectativa[];
  /**
   * Lo que tiene que cumplir **la primera**, cuando el arreglista habló del orden:
   * «V→vi como primera opción de cierre» es un error, y como tercera no.
   */
  readonly primera?: readonly Expectativa[];
}

export interface CasoDelCorpus {
  readonly id: string;
  readonly familia: Familia;
  /** Lo que es, en las palabras del arreglista. */
  readonly que: string;
  readonly mode: KeyMode;
  readonly compases: readonly PathStep[];
  /**
   * Lo que sabe la petición además de los grados. Sin estilo cuando el giro no
   * tiene `StyleId` —bolero, flamenco, modal—: entonces lo dice `giro` y lo
   * recogen las expectativas.
   */
  readonly contexto: ContextoDeSalidas;
  /** El giro que no tiene estilo propio en `styles.ts`. */
  readonly giro?: string;
  readonly continuar: LoQueSeEspera;
  /** Ausente cuando el arreglista no dijo nada de retocarlo. */
  readonly retocar?: LoQueSeEspera;
}

const a4 = (...grados: DegreeSymbol[]): PathStep[] =>
  grados.map((degree) => ({ degree, beats: 4 }));
const a2 = (...grados: DegreeSymbol[]): PathStep[] =>
  grados.map((degree) => ({ degree, beats: 2 }));
const a8 = (...grados: DegreeSymbol[]): PathStep[] =>
  grados.map((degree) => ({ degree, beats: 8 }));

const septimas = (...especies: (EspecieDeBloque | null)[]) => especies;

/**
 * Lo que ninguna salida puede hacer, en ningún estilo de los del corpus: dejar la
 * frase coja —el «frase de 7 compases» del arreglista—, acabar a mitad de compás,
 * poner un acorde de un pulso o con pulsos fuera de la rejilla, o rellenar para
 * cuadrar.
 *
 * **Cambiar el primer acorde al retocar** va aparte, en cada caso: el arreglista no
 * lo hace nunca, menos el iii por el I en un jazz o un bolero, que es la misma
 * tónica.
 */
export const NUNCA: readonly Expectativa[] = [
  relleno(),
  fraseCoja(),
  acabaAMitadDeCompas(),
  compasDeUnPulso(),
  fueraDeLaRejilla(),
];

/** El V→IV del blues-rock, que en un jazz no se hace (lo dice el arreglista del ii–V–I). */
const NADA_DE_V_IV = dicho('mete V→IV, de blues-rock, en un jazz', meteElGiro('V', 'IV'));

export const CORPUS: readonly CasoDelCorpus[] = [
  // --- Pop: cuatro acordes y cómo se cierran -----------------------------------
  {
    id: 'pop-eje',
    familia: 'estilo',
    que: 'el bucle I V vi IV, que acaba en IV',
    mode: 'major',
    compases: a4('I', 'V', 'vi', 'IV'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «IV→V→I», «IV iv I», «ii V I»: cierra con la dominante o con el iv prestado.
      debe: [y(o(cierraCon('V', 'I'), cierraCon('iv', 'I')), cuadra(4))],
      noDebe: [
        dicho(
          'cierra IV→I sin pasar por V, tras cuatro compases que ya eran plagales',
          y(cierraCon('IV', 'I'), no(pasaPor('V'))),
        ),
        ...NUNCA,
      ],
    },
    retocar: {
      // «I V/vi vi IV», «I iii vi IV», «I V vi iv», y el último a V.
      debe: [o(compasEs(2, 'V/vi'), compasEs(2, 'iii'), compasEs(4, 'iv'), compasEs(4, 'V'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'pop-sensible',
    familia: 'acaba-en-V',
    que: 'vi IV I V, bucle que acaba en semicadencia',
    mode: 'major',
    compases: a4('vi', 'IV', 'I', 'V'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «repetir y cerrar vi IV V I», «IV V I», «IV I V I».
      debe: [y(cierraCon('V', 'I'), cuadra(4))],
      noDebe: [dicho('cierra V→IV→I a secas', cierraCon('V', 'IV', 'I')), ...NUNCA],
    },
    retocar: {
      debe: [o(compasEs(4, 'V/vi'), compasEs(3, 'ii'), compasEs(2, 'iv'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'doo-wop',
    familia: 'acaba-en-V',
    que: 'I vi IV V, el bucle de los cincuenta',
    mode: 'major',
    compases: a4('I', 'vi', 'IV', 'V'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «I», «I vi ii V I», «ii V I», «IV V I»: todas acaban en V→I.
      debe: [cierraCon('V', 'I')],
      noDebe: NUNCA,
      primera: [dicho('la primera cierra con IV→I en vez de V→I', no(cierraCon('IV', 'I')))],
    },
    retocar: {
      // «I vi ii V», «I V/ii ii V», «I vi IV bII».
      debe: [o(compasEs(3, 'ii'), compasEs(4, 'bII'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'sec-dom',
    familia: 'estilo',
    que: 'I III7 vi IV',
    mode: 'major',
    compases: a4('I', 'V/vi', 'vi', 'IV'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «V I», «ii V I», «IV V I».
      debe: [cierraCon('V', 'I')],
      noDebe: NUNCA,
    },
    retocar: { debe: [], noDebe: [cambiaElCompasQueAbre(), ...NUNCA] },
  },
  {
    id: 'acaba-en-IV',
    familia: 'estilo',
    que: 'I iii vi IV, que acaba en IV',
    mode: 'major',
    compases: a4('I', 'iii', 'vi', 'IV'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «V I», «iv I», «ii V I».
      debe: [o(cierraCon('V', 'I'), cierraCon('iv', 'I'))],
      noDebe: NUNCA,
    },
  },
  {
    id: 'royal-road',
    familia: 'estilo',
    que: 'IV V iii vi, el del J-pop',
    mode: 'major',
    compases: a4('IV', 'V', 'iii', 'vi'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «ii V I», «IV V I», o repetirlo.
      debe: [o(cierraCon('V', 'I'), repiteLoTuyo())],
      noDebe: NUNCA,
    },
    retocar: {
      debe: [compasEs(3, 'V/vi')],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'canon',
    familia: 'acaba-en-V',
    que: 'el canon, I V vi iii IV I IV V',
    mode: 'major',
    compases: a4('I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «I», «repetir», «vi IV V I».
      debe: [o(cierraCon('V', 'I'), repiteLoTuyo())],
      noDebe: NUNCA,
    },
    retocar: {
      debe: [compasEs(7, 'ii')],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'periodo-abierto',
    familia: 'acaba-en-V',
    que: 'ocho compases, I vi IV V dos veces, que acaban en V',
    mode: 'major',
    compases: a4('I', 'vi', 'IV', 'V', 'I', 'vi', 'IV', 'V'),
    contexto: { estilo: 'pop', papel: 'estrofa' },
    continuar: {
      // «I», «I vi IV V I», «ii V I».
      debe: [cierraCon('V', 'I')],
      noDebe: NUNCA,
    },
    retocar: {
      // Cerrar el consecuente, o un V/V en el 7. El arreglista dijo «en 7-8», y se
      // corrigió a «solo la segunda frase»: cerrarla desde el 6 —`I IV V I`— o desde
      // el 7 —`I vi V I`— son dos maneras de lo mismo, dejar el antecedente intacto
      // y que el consecuente acabe en V→I. Pedir el 7 exacto era pedir una sola.
      debe: [o(y(soloCambiaEntre(5, 8), cierraCon('V', 'I')), compasEs(7, 'V/V'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },

  // --- Rock --------------------------------------------------------------------
  {
    id: 'rock-mixo',
    familia: 'estilo',
    que: 'I bVII IV I, riff mixolidio que ya cierra',
    mode: 'major',
    compases: a4('I', 'bVII', 'IV', 'I'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «IV bVII I», «bVI bVII I», «IV IV I I» o un puente: nada con sensible.
      debe: [o(cierraCon('bVII', 'I'), cierraCon('IV', 'I'), esCamino('contraste'))],
      noDebe: [
        dicho('mete V→I con sensible en un riff mixolidio', meteElGiro('V', 'I')),
        dicho('mete un ii–V–I de jazz', meteElGiro('ii', 'V', 'I')),
        ...NUNCA,
      ],
    },
    retocar: {
      // «I bVII IV IV», «I bVII IV bVII», «I bVI bVII I».
      debe: [o(compasEs(4, 'IV'), compasEs(4, 'bVII'), y(compasEs(2, 'bVI'), compasEs(3, 'bVII')))],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('mete V→I con sensible en un riff mixolidio', meteElGiro('V', 'I')),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'rock-louie',
    familia: 'frase',
    que: 'riff I IV V IV a dos pulsos',
    mode: 'major',
    compases: a2('I', 'IV', 'V', 'IV'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «repetir el riff», «IV V I», «V IV I», y a dos pulsos.
      debe: [y(loNuevoVaA(2), o(repiteLoTuyo(), cierraCon('V', 'I'), cierraCon('IV', 'I')))],
      noDebe: [dicho('rompe el ritmo armónico de 2 pulsos', no(loNuevoVaA(2))), ...NUNCA],
    },
    retocar: {
      // «I IV bVII IV», «I bIII IV I».
      debe: [o(compasEs(3, 'bVII'), compasEs(2, 'bIII'))],
      // Sin el «rompe el ritmo armónico de 2 pulsos» que sí vale al continuar: al
      // retocar, «otro reparto» existe para cambiar lo que dura cada acorde, y
      // prohibirlo en el menú es prohibir una de las cinco salidas. Lo nuevo de una
      // continuación que cambia el paso sí es un error, y ahí sigue.
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'tres-acordes',
    familia: 'frase',
    que: 'I IV V, tres compases que acaban en V',
    mode: 'major',
    compases: a4('I', 'IV', 'V'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «I (cuadrar a 4)».
      debe: [y(cierraEnLaTonica(), cuadra(4))],
      // Su error, «dejar la frase en 3+4=7», es `fraseCoja`: escrito otra vez aquí
      // contaría dos veces el mismo fallo.
      noDebe: NUNCA,
    },
    retocar: {
      // «I IV V I», «I ii V».
      debe: [o(compasEs(2, 'ii'), cierraEnLaTonica())],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'descenso-menor',
    familia: 'estilo',
    que: 'i VII VI VII, descenso eólico',
    mode: 'minor',
    compases: a4('i', 'VII', 'VI', 'VII'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «VII i», «VI VII i», «iv V i».
      debe: [o(cierraCon('VII', 'i'), cierraCon('V', 'i'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «i VII VI V» (la andaluza), «i VII iv VII».
      debe: [o(compasEs(4, 'V'), compasEs(3, 'iv'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'mario',
    familia: 'estilo',
    que: 'I bVI bVII I, la cadencia épica',
    mode: 'major',
    compases: a4('I', 'bVI', 'bVII', 'I'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «IV I», «bIII IV I».
      debe: [o(cierraCon('IV', 'I'), pasaPor('bIII'))],
      noDebe: NUNCA,
    },
    retocar: {
      debe: [compasEs(2, 'iv')],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'menor-vamp',
    familia: 'estilo',
    que: 'i iv i iv, vaivén menor',
    mode: 'minor',
    compases: a4('i', 'iv', 'i', 'iv'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «V i», «VI VII i», «VII i».
      debe: [o(cierraCon('V', 'i'), cierraCon('VII', 'i'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «i iv VII i». Y también «i iv V i»: el propio arreglista propone `V i` para
      // cerrar este vaivén al continuar, y el mismo cierre puesto en el 3 y el 4 no
      // es peor por estar dentro. En rock menor conviven la VII sin sensible y la V
      // con ella; pedir solo la primera era pedir una respuesta entre dos buenas.
      debe: [o(y(compasEs(3, 'VII'), compasEs(4, 'i')), y(compasEs(3, 'V'), compasEs(4, 'i')))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'epico-menor',
    familia: 'estilo',
    que: 'i VI VII i, que ya cierra',
    mode: 'minor',
    compases: a4('i', 'VI', 'VII', 'i'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «III VII VI V» o «iv VI VII i»: una parte que se va a otro sitio.
      debe: [o(sigueCon('III'), sigueCon('iv'))],
      noDebe: NUNCA,
    },
  },
  {
    id: 'eolico-pop',
    familia: 'estilo',
    que: 'i VI III VII, que acaba en VII',
    mode: 'minor',
    compases: a4('i', 'VI', 'III', 'VII'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «i», «VI VII i», «iv V i».
      debe: [o(cierraCon('VII', 'i'), cierraCon('V', 'i'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «i VI III V», «i VI iv VII».
      debe: [o(compasEs(4, 'V'), compasEs(3, 'iv'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },

  // --- Jazz y bolero: séptimas, ii–V y sus sustitutos -------------------------
  {
    id: 'jazz-251',
    familia: 'estilo',
    que: 'ii V I con la tónica dos compases',
    mode: 'major',
    compases: a4('ii', 'V', 'I', 'I'),
    contexto: { estilo: 'jazz', especies: septimas('minor7', 'dominant7', 'major7', 'major7') },
    continuar: {
      // «vi ii V I», «iii vi ii V», «V/ii ii V I», «IV iv I».
      debe: [o(meteElGiro('ii', 'V'), cierraCon('iv', 'I')), loNuevoConSeptima()],
      noDebe: [NADA_DE_V_IV, ...NUNCA],
    },
    retocar: {
      // «ii bII I I», «ii V I vi», «ii V I V/ii».
      debe: [o(compasEs(2, 'bII'), compasEs(4, 'vi'), compasEs(4, 'V/ii'))],
      noDebe: [cambiaElCompasQueAbre(), NADA_DE_V_IV, ...NUNCA],
    },
  },
  {
    id: 'jazz-turnaround',
    familia: 'acaba-en-V',
    que: 'I vi ii V, que acaba en V',
    mode: 'major',
    compases: a4('I', 'vi', 'ii', 'V'),
    contexto: { estilo: 'jazz', especies: septimas('major7', 'minor7', 'minor7', 'dominant7') },
    continuar: {
      // «I», «iii vi ii V I», «I V/ii ii V I».
      debe: [cierraCon('V', 'I'), loNuevoConSeptima()],
      noDebe: [NADA_DE_V_IV, ...NUNCA],
      primera: [dicho('la primera va de V a vi', no(sigueCon('vi')))],
    },
    retocar: {
      // «I V/ii ii V», «I vi ii bII», «iii vi ii V».
      debe: [o(compasEs(2, 'V/ii'), compasEs(4, 'bII'), compasEs(1, 'iii'))],
      noDebe: [cambiaElCompasQueAbre(['iii']), NADA_DE_V_IV, ...NUNCA],
    },
  },
  {
    id: 'rhythm-A',
    familia: 'modal-forma',
    que: 'la A de un rhythm changes, I vi ii V dos veces a dos pulsos',
    mode: 'major',
    compases: a2('I', 'vi', 'ii', 'V', 'I', 'vi', 'ii', 'V'),
    contexto: {
      estilo: 'jazz',
      especies: septimas(
        'major7',
        'minor7',
        'minor7',
        'dominant7',
        'major7',
        'minor7',
        'minor7',
        'dominant7',
      ),
    },
    continuar: {
      // «I IV iv I / ii V I», la segunda mitad de la A, o el puente de dominantes.
      debe: [
        o(y(cierraCon('V', 'I'), loNuevoVaA(2)), y(esCamino('contraste'), pasaPor('V/V'))),
        loNuevoConSeptima(),
      ],
      noDebe: [
        dicho(
          'cierra a 4 pulsos rompiendo el ritmo armónico de 2',
          y(esCamino('seguir'), no(loNuevoVaA(2))),
        ),
        NADA_DE_V_IV,
        ...NUNCA,
      ],
    },
    retocar: {
      // «I V/ii ii V», «iii vi ii V», el bII en lugar del V.
      debe: [o(meteElGrado('V/ii'), meteElGrado('bII'), meteElGrado('iii'))],
      noDebe: [cambiaElCompasQueAbre(['iii']), NADA_DE_V_IV, ...NUNCA],
    },
  },
  {
    id: 'menor-251',
    familia: 'estilo',
    que: 'ii° V i en menor',
    mode: 'minor',
    compases: a4('ii°', 'V', 'i', 'i'),
    contexto: {
      estilo: 'jazz',
      especies: septimas('halfDiminished7', 'dominant7', 'minor7', 'minor7'),
    },
    continuar: {
      // «VI ii° V i», «iv V i», «III VI ii° V».
      debe: [o(meteElGiro('ii°', 'V'), cierraCon('iv', 'V', 'i')), loNuevoConSeptima()],
      noDebe: [
        dicho('mete V→III como cadencia rota', meteElGiro('V', 'III')),
        dicho('mete V→iv, de blues-rock, en un jazz', meteElGiro('V', 'iv')),
        ...NUNCA,
      ],
    },
    retocar: {
      // «ii° bII i i», «ii° V VI» (rota).
      debe: [o(compasEs(2, 'bII'), compasEs(3, 'VI'))],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('mete V→III como cadencia rota', meteElGiro('V', 'III')),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'bolero-menor',
    familia: 'estilo',
    que: 'i I7 iv V7, que acaba en V',
    mode: 'minor',
    compases: a4('i', 'V/iv', 'iv', 'V'),
    contexto: { especies: septimas(null, 'dominant7', null, 'dominant7') },
    giro: 'bolero',
    continuar: {
      // «i», «i V/iv iv V i», «VI ii° V i».
      debe: [cierraCon('V', 'i')],
      noDebe: [dicho('mete una dominante menor (v) en un bolero', meteElGrado('v')), ...NUNCA],
      primera: [dicho('la primera va de V a VI sin intención', no(sigueCon('VI')))],
    },
    retocar: {
      // «i V/iv iv bII», y el ii° antes del V.
      debe: [o(compasEs(4, 'bII'), pasaPor('ii°'))],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('mete una dominante menor (v) en un bolero', meteElGrado('v')),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'bolero-mayor',
    familia: 'estilo',
    que: 'I VI7 ii V7',
    mode: 'major',
    compases: a4('I', 'V/ii', 'ii', 'V'),
    contexto: { especies: septimas(null, 'dominant7', null, 'dominant7') },
    giro: 'bolero',
    continuar: {
      // «I», «iii V/ii ii V I», «IV iv I».
      debe: [o(cierraCon('V', 'I'), cierraCon('iv', 'I'))],
      noDebe: [dicho('mete bVII en un bolero', meteElGrado('bVII')), ...NUNCA],
    },
    retocar: {
      // «I V/ii ii bII», «iii V/ii ii V».
      debe: [o(compasEs(4, 'bII'), compasEs(1, 'iii'))],
      noDebe: [
        cambiaElCompasQueAbre(['iii']),
        dicho('mete bVII en un bolero', meteElGrado('bVII')),
        ...NUNCA,
      ],
    },
  },

  // --- Flamenco, folk y soul ---------------------------------------------------
  {
    id: 'andaluza',
    familia: 'estilo',
    que: 'i VII VI V, la cadencia andaluza',
    mode: 'minor',
    compases: a4('i', 'VII', 'VI', 'V'),
    contexto: {},
    giro: 'flamenco',
    continuar: {
      // «repetir la bajada» (vuelve a i), «V VI V» (frigio en V), «iv V i».
      debe: [
        o(repiteLoTuyo(), sigueCon('i'), meteElGiro('V', 'VI', 'V'), cierraCon('iv', 'V', 'i')),
      ],
      noDebe: [
        dicho('da vueltas: V→VI→VII→i', meteElGiro('V', 'VI', 'VII', 'i')),
        meteElGrado('V/V'),
        ...NUNCA,
      ],
    },
    retocar: {
      // «i VII VI V» con bII antes del V, «i v VI V»: el V se queda.
      debe: [
        dicho('cambia algo y conserva el V de la andaluza', y(cambiaAlgo(), conservaElFinal())),
      ],
      noDebe: [cambiaElCompasQueAbre(), meteElGrado('V/V'), ...NUNCA],
    },
  },
  {
    id: 'plagal-menor',
    familia: 'estilo',
    que: 'i iv i v',
    mode: 'minor',
    compases: a4('i', 'iv', 'i', 'v'),
    contexto: { estilo: 'folk' },
    continuar: {
      // «i», «iv i», «iv v i», «VI VII i».
      debe: [o(cierraCon('v', 'i'), cierraCon('iv', 'i'), cierraCon('VII', 'i'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «i iv i V», «i iv VII i».
      debe: [o(compasEs(4, 'V'), y(compasEs(3, 'VII'), compasEs(4, 'i')))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'folk-semicadencia',
    familia: 'acaba-en-V',
    que: 'I IV I V, frase antecedente de cuatro en V',
    mode: 'major',
    compases: a4('I', 'IV', 'I', 'V'),
    contexto: { estilo: 'folk' },
    continuar: {
      // El consecuente: «I IV V I», «vi IV V I».
      debe: [
        dicho('un consecuente de 4 que cierra con V→I', y(cierraCon('V', 'I'), duraCompases(8))),
      ],
      noDebe: [dicho('cierra en 2 compases (V I) y deja la frase en 6', duraCompases(6)), ...NUNCA],
    },
    retocar: {
      // «I IV ii V», «I IV V/V V». Y «I IV I bVII», que el arreglista no escribió y
      // en folk es la misma pregunta dicha en mixolidio: el bVII es de la casa en ese
      // estilo —el juez lo pesa como lo de casa (`bVIIDeLaCasa`) y verificación lo
      // pide en `folk-doble-tonica`, `I bVII I bVII`—, y la A de media música celta
      // acaba así, abierta en el bVII. Desde que hay «sin sensible» se construye.
      debe: [o(compasEs(3, 'ii'), compasEs(3, 'V/V'), compasEs(4, 'bVII'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'folk-periodo',
    familia: 'modal-forma',
    que: 'un periodo de ocho que cierra',
    mode: 'major',
    compases: a4('I', 'IV', 'I', 'V', 'I', 'IV', 'V', 'I'),
    contexto: { estilo: 'folk', papel: 'estrofa' },
    continuar: {
      // Un estribillo en IV o en vi, o un puente «vi IV vi V».
      debe: [
        dicho(
          'una parte nueva que arranca en IV o en vi, cuadrada',
          y(o(sigueCon('IV'), sigueCon('vi')), cuadra(4)),
        ),
      ],
      noDebe: NUNCA,
    },
    retocar: {
      // «I IV I V vi IV V I», «I IV ii V I IV V I». Lo segundo es **el ii delante
      // del V**, y se escribía como «el compás 3 es ii»; el mismo ii delante del V
      // del consecuente —`I IV I V I ii V I`— es la misma idea en la otra frase, y
      // en un periodo es donde más se oye: la segunda vez es la que se varía.
      debe: [o(compasEs(5, 'vi'), dicho('pone un ii delante de un V', meteElGiro('ii', 'V')))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'dos-acordes',
    familia: 'frase',
    que: 'el vaivén I IV',
    mode: 'major',
    compases: a4('I', 'IV', 'I', 'IV'),
    contexto: { estilo: 'folk' },
    continuar: {
      // «I V», «V I», «vi V I»: las tres traen la V que le falta.
      debe: [dicho('trae la V que le falta al vaivén', pasaPor('V'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «I IV V IV», «I IV I V».
      debe: [o(compasEs(3, 'V'), compasEs(4, 'V'))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'soul-plagal',
    familia: 'estilo',
    que: 'I IV iv I, que cierra',
    mode: 'major',
    compases: a4('I', 'IV', 'iv', 'I'),
    contexto: {},
    giro: 'soul/gospel',
    continuar: {
      // «vi IV V», «V/vi vi»: hacia el relativo.
      debe: [o(sigueCon('vi'), sigueCon('V/vi'))],
      noDebe: NUNCA,
    },
  },

  // --- Formas y modos --------------------------------------------------------
  {
    id: 'blues-12',
    familia: 'modal-forma',
    que: 'blues de doce con turnaround',
    mode: 'major',
    compases: a4('I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'),
    contexto: { estilo: 'blues', especies: Array<EspecieDeBloque>(12).fill('dominant7') },
    continuar: {
      // «otro coro de 12», o un final de 12 sin turnaround.
      debe: [dicho('otro coro de 12 (o un final de 12)', cuadra(12)), loNuevoConSeptima()],
      noDebe: [
        dicho('una cadencia de 2 compases que rompe la forma de 12', alarga(2)),
        dicho('un puente que rompe la forma de 12', y(esCamino('contraste'), no(cuadra(12)))),
        ...NUNCA,
      ],
    },
    retocar: {
      // El quick change (IV en el 2), o algo en el turnaround de 11-12.
      debe: [o(compasEs(2, 'IV'), soloCambiaEntre(11, 12))],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('deja de durar 12 compases', no(cuadra(12))),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'blues-rapido',
    familia: 'modal-forma',
    que: 'blues con quick change que acaba en I, sin turnaround',
    mode: 'major',
    compases: a4('I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I'),
    contexto: { estilo: 'blues', especies: Array<EspecieDeBloque>(12).fill('dominant7') },
    continuar: {
      debe: [dicho('otro coro de 12', cuadra(12)), loNuevoConSeptima()],
      noDebe: [
        dicho('una cadencia de 2 compases que rompe la forma de 12', alarga(2)),
        dicho('un puente que rompe la forma de 12', y(esCamino('contraste'), no(cuadra(12)))),
        ...NUNCA,
      ],
    },
    retocar: {
      // El turnaround: «V en el 12», «I vi ii V en 11-12».
      debe: [soloCambiaEntre(11, 12)],
      noDebe: [
        dicho('cambia el esquema de los compases 1 a 4', cambiaAlgunoEntre(1, 4)),
        dicho('deja de durar 12 compases', no(cuadra(12))),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'dorico-como-mayor',
    familia: 'modal-forma',
    que: 'el vamp dórico i–IV, escrito como ii V en Do',
    mode: 'major',
    compases: a4('ii', 'V', 'ii', 'V'),
    contexto: {},
    giro: 'modal dórico',
    continuar: {
      // «seguir el vamp», «no resolver a I».
      debe: [dicho('sigue el vamp sin resolver a I', no(cierraEnLaTonica()))],
      noDebe: [dicho('cierra en I (Do): destruye el modo', cierraEnLaTonica()), ...NUNCA],
    },
    retocar: {
      // Pedía «el compás 2 es IV», y el IV de ese dórico —el de su nombre, i–IV— es
      // el Sol, que ya está escrito como V: el IV de Do, el Fa, le quita el Si que
      // hace dórico al vamp. Lo que lo retoca sin sacarlo del modo es cambiar la
      // vuelta: el Fa (bIII del dórico) o el La menor (su v) en el compás 3, con el
      // Sol, su IV, en su sitio. Lo que no cabe es lo que lo saca: cerrar en Do o
      // meterle el Do# de un Re menor.
      debe: [o(compasEs(3, 'IV'), compasEs(3, 'vi'), compasEs(4, 'IV'), compasEs(4, 'vi'))],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('cierra en I (Do): destruye el modo', cierraEnLaTonica()),
        dicho('le mete el Do# de un Re menor: el A7', meteElGrado('V/ii')),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'mixo-vamp',
    familia: 'modal-forma',
    que: 'el vamp mixolidio I bVII',
    mode: 'major',
    compases: a4('I', 'bVII', 'I', 'bVII'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «IV I», «bVI bVII I», «IV bVII I».
      debe: [o(cierraCon('IV', 'I'), cierraCon('bVII', 'I'))],
      noDebe: [dicho('mete V→I con sensible en un vamp mixolidio', meteElGiro('V', 'I')), ...NUNCA],
    },
    retocar: {
      debe: [compasEs(3, 'IV')],
      noDebe: [
        cambiaElCompasQueAbre(),
        dicho('mete V→I con sensible en un vamp mixolidio', meteElGiro('V', 'I')),
        ...NUNCA,
      ],
    },
  },

  // --- Frases: largos, repartos y tomas desiguales ----------------------------
  {
    id: 'un-acorde',
    familia: 'frase',
    que: 'un solo acorde repetido',
    mode: 'major',
    compases: a4('I', 'I', 'I', 'I'),
    contexto: {},
    continuar: {
      // «IV V I», «vi IV V I», «IV I». Y «ii V I», que el arreglista no escribió y
      // es lo mismo: el ii y el IV son la misma subdominante delante del V —`IV ii V
      // I` es `IV V I` con la subdominante desplegada—. Pedir el IV justo delante
      // era pedir una de las dos maneras de preparar la dominante.
      debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'), cierraCon('IV', 'I'))],
      noDebe: NUNCA,
    },
    retocar: {
      // «I IV I V», «I I IV I», «I vi IV V».
      debe: [o(compasEs(2, 'IV'), compasEs(3, 'IV'), compasEs(2, 'vi'))],
      noDebe: [
        dicho('cambia todos los I (el relativo en los cuatro)', cambiaTodos()),
        cambiaElCompasQueAbre(),
        ...NUNCA,
      ],
    },
  },
  {
    id: 'dos-compases',
    familia: 'frase',
    que: 'I V, dos compases',
    mode: 'major',
    compases: a4('I', 'V'),
    contexto: { estilo: 'pop' },
    continuar: {
      // «vi IV», «IV I»: hasta cuatro. «I» a secas también vale, como acorde final.
      debe: [o(cuadra(4), y(sigueCon('I'), duraCompases(3)))],
      noDebe: NUNCA,
    },
    retocar: {
      debe: [compasEs(2, 'vi')],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'dos-compases-menor',
    familia: 'frase',
    que: 'i iv, dos compases en menor',
    mode: 'minor',
    compases: a4('i', 'iv'),
    contexto: { estilo: 'rock' },
    continuar: {
      // «V i», «VII i», «VI V i».
      debe: [o(cierraCon('V', 'i'), cierraCon('VII', 'i'))],
      noDebe: NUNCA,
    },
    retocar: {
      debe: [compasEs(2, 'VI')],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'desigual',
    familia: 'frase',
    que: 'una toma desigual de I V vi IV a cuatro: 5, 3, 6 y 2 pulsos',
    mode: 'major',
    compases: [
      { degree: 'I', beats: 5 },
      { degree: 'V', beats: 3 },
      { degree: 'vi', beats: 6 },
      { degree: 'IV', beats: 2 },
    ],
    contexto: { estilo: 'pop' },
    continuar: {
      // «cuadrar y seguir a 4»: lo tuyo no se toca al continuar, lo nuevo va a 4.
      debe: [loNuevoVaA(4)],
      noDebe: NUNCA,
    },
    retocar: {
      // «cuadrar a 4», y la primera.
      debe: [dicho('cuadra a 4: los mismos acordes, cada uno un compás', mismosAcordesA(4))],
      noDebe: [
        dicho('a medio tiempo heredando 10-6-12-4', algoNuevoDura(10)),
        cambiaElCompasQueAbre(),
        ...NUNCA,
      ],
      primera: [dicho('la primera cuadra a 4', mismosAcordesA(4))],
    },
  },
  {
    id: 'medio-tiempo',
    familia: 'frase',
    que: 'I IV V I, cada acorde dos compases',
    mode: 'major',
    compases: a8('I', 'IV', 'V', 'I'),
    contexto: { estilo: 'pop' },
    giro: 'balada',
    continuar: {
      // «vi IV V I a 8».
      debe: [y(loNuevoVaA(8), cierraEnLaTonica())],
      noDebe: [
        dicho('sigue a 4 pulsos, el doble de rápido', algoNuevoDura(4)),
        dicho('sigue a otro paso que no es el de 8 pulsos', no(loNuevoVaA(8))),
        ...NUNCA,
      ],
    },
    retocar: {
      // «doble tiempo».
      debe: [dicho('a doble tiempo: los mismos acordes a 4', mismosAcordesA(4))],
      noDebe: [cambiaElCompasQueAbre(), ...NUNCA],
    },
  },
  {
    id: 'rapido',
    familia: 'frase',
    que: 'I IV V I a dos pulsos',
    mode: 'major',
    compases: a2('I', 'IV', 'V', 'I'),
    contexto: { estilo: 'rock' },
    giro: 'punk',
    continuar: {
      // «repetir», «IV V I», al mismo paso.
      debe: [y(loNuevoVaA(2), o(repiteLoTuyo(), cierraCon('V', 'I')))],
      noDebe: NUNCA,
    },
  },
];

// --- La nota --------------------------------------------------------------------

/** Una expectativa que no se ha cumplido, y qué salidas la incumplen. */
export interface Incumplida {
  readonly donde: 'debe' | 'noDebe' | 'primera';
  readonly dice: string;
  /** Las salidas que hacen lo que no debían, por su número en el menú. */
  readonly culpables: readonly number[];
}

export interface NotaDeUnCaso {
  readonly caso: CasoDelCorpus;
  readonly kind: PathKind;
  /** Lo que cuenta para el `debe`: las tres primeras, o lo que eligió el modelo. */
  readonly elegidas: readonly SalidaPosible[];
  /** Lo que cuenta para el `noDebe`: el menú entero, o lo que eligió el modelo. */
  readonly menu: readonly SalidaPosible[];
  readonly cumplidas: number;
  readonly total: number;
  readonly incumplidas: readonly Incumplida[];
}

/** Las primeras del menú que cuentan para el `debe`: las que se ven sin desplazar. */
export const PRIMERAS = 3;

/**
 * Los casos con un giro que `styles.ts` **ya tiene** —el bolero, el flamenco, el
 * cine—, otra vez y con su estilo: `andaluza/flamenco`. Se escribieron sin estilo
 * porque el suyo no existía; ahora la petición puede decirlo. Son el mismo caso y lo
 * mismo que esperaba el arreglista, que lo escribió pensando en esa música. Van
 * aparte de su corpus para que las cifras de siempre sigan siendo las de siempre.
 */
export function conSuEstilo<C extends { id: string; giro?: string; contexto: ContextoDeSalidas }>(
  casos: readonly C[],
): C[] {
  return casos.flatMap((caso) => {
    const giro = STYLE_IDS.find((estilo) => estilo === caso.giro);
    return giro === undefined
      ? []
      : [{ ...caso, id: `${caso.id}/${giro}`, contexto: { ...caso.contexto, estilo: giro } }];
  });
}

/** Los del corpus de salidas con un giro que ya es estilo: el bolero y la andaluza. */
export const CORPUS_CON_SU_ESTILO: readonly CasoDelCorpus[] = conSuEstilo(CORPUS);

/**
 * Examina un caso: el `debe` contra `elegidas`, el `noDebe` contra `menu` entero.
 *
 * Por separado porque **no se examina igual el menú que la elección del modelo**:
 * del menú cuentan las tres primeras para lo que tiene que haber y todo para lo
 * que no; de lo que elige el modelo, lo elegido para las dos cosas, que es lo que
 * llega a la pantalla. Nulo si no se esperaba nada de esa petición.
 */
export function examinarCaso(
  caso: CasoDelCorpus,
  kind: PathKind,
  elegidas: readonly SalidaPosible[],
  menu: readonly SalidaPosible[] = elegidas,
): NotaDeUnCaso | null {
  const espera = caso[kind];
  if (espera === undefined) {
    return null;
  }
  const preparar = (salida: SalidaPosible) =>
    examinar(caso.mode, caso.compases, caso.contexto, salida);
  const vistas = elegidas.map(preparar);
  const todas = menu.map(preparar);

  const incumplidas: Incumplida[] = [];
  for (const expectativa of espera.debe) {
    if (!vistas.some((salida) => expectativa.cumple(salida))) {
      incumplidas.push({ donde: 'debe', dice: expectativa.dice, culpables: [] });
    }
  }
  for (const expectativa of espera.noDebe) {
    const culpables = todas.flatMap((salida, i) => (expectativa.cumple(salida) ? [i + 1] : []));
    if (culpables.length > 0) {
      incumplidas.push({ donde: 'noDebe', dice: expectativa.dice, culpables });
    }
  }
  for (const expectativa of espera.primera ?? []) {
    const primera = vistas[0];
    if (primera === undefined || !expectativa.cumple(primera)) {
      incumplidas.push({ donde: 'primera', dice: expectativa.dice, culpables: [1] });
    }
  }

  const total = espera.debe.length + espera.noDebe.length + (espera.primera ?? []).length;
  return {
    caso,
    kind,
    elegidas,
    menu,
    cumplidas: total - incumplidas.length,
    total,
    incumplidas,
  };
}

/**
 * Con qué nombre sale cada caso: el suyo y la petición. Basta con el id, para que
 * sirva también a las notas del corpus de verificación, que tiene otras familias.
 */
export function claveDe(nota: {
  readonly caso: { readonly id: string };
  readonly kind: PathKind;
}): string {
  return `${nota.caso.id}:${nota.kind}`;
}

/** El grupo en que se cuenta: la familia al continuar, `retocar` al retocar. */
export function grupoDe(nota: NotaDeUnCaso): string {
  return nota.kind === 'retocar' ? 'retocar' : nota.caso.familia;
}

export interface Cifras {
  readonly cumplidas: number;
  readonly total: number;
  /** Casos en los que se cumple todo. */
  readonly aprobados: number;
  readonly casos: number;
}

/**
 * Lo que se suma de una nota, sea de este examen o de otro que cuente más cosas:
 * el de verificación (`corpus-de-verificacion.ts`) apunta faltas de más clases y
 * se cuenta igual.
 */
export interface Puntuada {
  readonly cumplidas: number;
  readonly total: number;
  readonly incumplidas: readonly unknown[];
}

export function cifras(notas: readonly Puntuada[]): Cifras {
  return {
    cumplidas: notas.reduce((suma, nota) => suma + nota.cumplidas, 0),
    total: notas.reduce((suma, nota) => suma + nota.total, 0),
    aprobados: notas.filter((nota) => nota.incumplidas.length === 0).length,
    casos: notas.length,
  };
}

/** La nota de 0 a 1: las expectativas cumplidas entre todas las que hay. */
export function notaDe(notas: readonly Puntuada[]): number {
  const { cumplidas, total } = cifras(notas);
  return total === 0 ? 1 : cumplidas / total;
}

export function enLinea({ cumplidas, total, aprobados, casos }: Cifras): string {
  const por100 = total === 0 ? 100 : Math.round((cumplidas / total) * 100);
  return `${cumplidas}/${total} expectativas (${por100} %) · ${aprobados}/${casos} casos enteros`;
}

/** Una salida en una línea: el camino y lo que pone, en grados y pulsos. */
export function enGrados(
  caso: Pick<CasoDelCorpus, 'compases'>,
  kind: PathKind,
  salida: SalidaPosible,
): string {
  const pasos = salida.secciones.flatMap((seccion) => seccion.steps);
  const lo = kind === 'continuar' ? pasos.slice(caso.compases.length) : pasos;
  const especie = (paso: PasoPosible) => (paso.especie ? `(${paso.especie})` : '');
  return `${salida.path}: ${lo.map((paso) => `${paso.degree}${especie(paso)}/${paso.beats}`).join(' ')}`;
}

/**
 * El informe entero: la nota, la de cada grupo y, caso por caso, lo que falla con
 * las salidas que se examinaron delante, para ver **por qué** sin volver a correr
 * nada.
 */
export function informe(notas: readonly NotaDeUnCaso[], cabecera: readonly string[] = []): string {
  const lineas = [...cabecera, `Nota: ${enLinea(cifras(notas))}`];
  for (const grupo of [...new Set(notas.map(grupoDe))]) {
    lineas.push(`  ${grupo}: ${enLinea(cifras(notas.filter((nota) => grupoDe(nota) === grupo)))}`);
  }
  // Los que acaban en V, sea cual sea su familia: es la cifra que dio la alarma.
  const enV = notas.filter(
    (nota) =>
      nota.kind === 'continuar' &&
      nota.caso.compases[nota.caso.compases.length - 1]!.degree === 'V',
  );
  lineas.push(`  continuar lo que acaba en V: ${enLinea(cifras(enV))}`);

  for (const nota of notas) {
    const marca = nota.incumplidas.length === 0 ? 'BIEN' : 'MAL ';
    lineas.push(
      '',
      `${marca} ${claveDe(nota)} [${nota.caso.familia}] ${nota.caso.que}: ${nota.cumplidas}/${nota.total}`,
    );
    if (nota.incumplidas.length === 0) {
      continue;
    }
    // Con asterisco las que cuentan para el `debe`.
    nota.menu.forEach((salida, i) =>
      lineas.push(
        `   ${i < nota.elegidas.length ? '*' : ' '}${i + 1}. ${enGrados(nota.caso, nota.kind, salida)}`,
      ),
    );
    for (const { donde, dice, culpables } of nota.incumplidas) {
      const quien = donde === 'noDebe' ? ` (la ${culpables.join(', la ')})` : '';
      lineas.push(`   ${donde}: ${dice}${quien}`);
    }
  }
  return lineas.join('\n');
}
