/**
 * Las formas que se reconocen en lo tuyo —el periodo y la AABA— y lo que les falta
 * para estar enteras; y la andaluza que reposa en su V.
 *
 * Es la misma idea que `formaDeBlues` y `bluesAMedias` en `encaje.ts`: **una sola
 * vara para quien construye las salidas y para quien las juzga**. Si cada uno
 * reconociera la forma a su manera, uno ofrecería el consecuente que el otro
 * castiga por repetir. El blues no se reconoce aquí: ya tiene las suyas, y una forma
 * de doce no se parte en secciones iguales de cuatro con la misma cabeza, así que
 * las dos varas no se pisan.
 *
 * ## Qué es una sección
 *
 * Cuatro u ocho compases. **Dos secciones son la misma si empiezan igual**: la
 * mitad primera, compás a compás y con lo que dura cada acorde. El final puede
 * cambiar, y es lo normal: la primera A de un estándar acaba en el turnaround y la
 * segunda cierra en casa, y el consecuente de un periodo repite la cabeza del
 * antecedente para cerrar lo que aquel dejó abierto. Pedirlas idénticas no
 * reconocería ni la forma más corriente que hay.
 *
 * Lo que se lee son grados, no notas: un periodo se reconoce por su armonía, que es
 * lo que hay; el punteo que haría de él un periodo de manual no siempre está.
 */

import { roleOfDegreeSymbol } from './harmonic-function';
import type { KeyMode } from './keys';
import { degreesFor, resolveDegree, type DegreeSymbol } from './progressions';
import type { StyleId } from './styles';

/** Un acorde dentro de un compás, con los pulsos que suena en él. */
export interface AcordeDelCompas {
  readonly degree: DegreeSymbol;
  readonly beats: number;
}

/** Un compás: lo que suena en él, en orden. */
export type Compas = readonly AcordeDelCompas[];

/** Un trozo de lo tuyo, en compases: desde cuál —contando desde cero— y cuántos. */
export interface Tramo {
  readonly desde: number;
  readonly compases: number;
}

/**
 * Lo tuyo partido en compases, o nulo si no da compases enteros.
 *
 * Un acorde que dura dos compases sale en los dos —es lo que suena en cada uno— y
 * uno que empieza a mitad de compás comparte el compás con el de antes. Con pulsos
 * que no son un número entero, o lo tuyo acabando a mitad de compás, no hay
 * secciones que contar.
 */
export function compasesDe(
  pasos: readonly AcordeDelCompas[],
  pulsosPorCompas: number,
): Compas[] | null {
  const total = pasos.reduce((suma, paso) => suma + paso.beats, 0);
  if (
    !Number.isInteger(pulsosPorCompas) ||
    pulsosPorCompas < 1 ||
    pasos.length === 0 ||
    pasos.some((paso) => !Number.isInteger(paso.beats) || paso.beats < 1) ||
    total % pulsosPorCompas !== 0
  ) {
    return null;
  }
  const compases: AcordeDelCompas[][] = [];
  let actual: AcordeDelCompas[] = [];
  let lleno = 0;
  for (const paso of pasos) {
    let quedan = paso.beats;
    while (quedan > 0) {
      const cabe = Math.min(quedan, pulsosPorCompas - lleno);
      actual.push({ degree: paso.degree, beats: cabe });
      lleno += cabe;
      quedan -= cabe;
      if (lleno === pulsosPorCompas) {
        compases.push(actual);
        actual = [];
        lleno = 0;
      }
    }
  }
  return compases;
}

/**
 * Los pasos tuyos que ocupan ese tramo, tal cual —con su especie, su duda, lo que
 * lleven—, o nulo si alguno empieza antes o acaba después.
 *
 * Es lo que necesita quien construye lo que falta: «repite los dos primeros
 * compases» se dice en compases, y lo que se copia son tus acordes, no un resumen
 * de ellos. Si un acorde cruza el borde del tramo, copiarlo partido sería otro
 * reparto, y eso ya no es repetir.
 */
export function pasosDelTramo<P extends { readonly beats: number }>(
  pasos: readonly P[],
  pulsosPorCompas: number,
  tramo: Tramo,
): P[] | null {
  const desde = tramo.desde * pulsosPorCompas;
  const hasta = desde + tramo.compases * pulsosPorCompas;
  const dentro: P[] = [];
  let pulso = 0;
  for (const paso of pasos) {
    const fin = pulso + paso.beats;
    const tocaElTramo = fin > desde && pulso < hasta;
    if (tocaElTramo && (pulso < desde || fin > hasta)) {
      return null;
    }
    if (tocaElTramo) {
      dentro.push(paso);
    }
    pulso = fin;
  }
  return pulso < hasta ? null : dentro;
}

function tonicaDe(mode: KeyMode): DegreeSymbol {
  return mode === 'major' ? 'I' : 'i';
}

/** Los grados de una sección en orden, sin repetir el que sigue sonando. */
function grados(seccion: readonly Compas[]): DegreeSymbol[] {
  const todos = seccion.flatMap((compas) => compas.map((acorde) => acorde.degree));
  return todos.filter((grado, i) => i === 0 || grado !== todos[i - 1]);
}

function mismoCompas(a: Compas, b: Compas): boolean {
  return (
    a.length === b.length &&
    a.every((acorde, i) => acorde.degree === b[i]!.degree && acorde.beats === b[i]!.beats)
  );
}

/** Si dos secciones empiezan igual: su primera mitad, compás a compás. */
function mismaCabeza(a: readonly Compas[], b: readonly Compas[]): boolean {
  const cabeza = a.length / 2;
  return a.slice(0, cabeza).every((compas, i) => mismoCompas(compas, b[i]!));
}

/**
 * Si una sección es una frase: se mueve. Cuatro compases de tónica no son una A
 * que se repite, son una tónica que dura; y una A que es dos veces lo mismo —`I IV
 * I IV`— es un vaivén, no una frase con principio y final.
 */
function esUnaFrase(seccion: readonly Compas[]): boolean {
  const mitad = seccion.length / 2;
  const partida = seccion
    .slice(0, mitad)
    .every((compas, i) => mismoCompas(compas, seccion[mitad + i]!));
  return new Set(grados(seccion)).size >= 2 && !partida;
}

/**
 * Si una sección **cierra**: acaba en la tónica y llega a ella desde algo que no es
 * tónica —una dominante, una subdominante, el bVII del rock—. Llegar a la I desde el
 * vi no es una cadencia, es cambiar de color sin moverse de casa.
 */
function cierra(mode: KeyMode, seccion: readonly Compas[]): boolean {
  const suyos = grados(seccion);
  const antes = suyos.at(-2);
  return (
    suyos.at(-1) === tonicaDe(mode) && antes !== undefined && roleOfDegreeSymbol(antes) !== 'tonic'
  );
}

/** Si una sección se queda abierta: acaba fuera de la tónica. */
function abierta(mode: KeyMode, seccion: readonly Compas[]): boolean {
  return grados(seccion).at(-1) !== tonicaDe(mode);
}

/** Lo que falta para que una forma esté entera. */
export interface LoQueFalta {
  /**
   * Qué es: el consecuente de un periodo, la B de una AABA tras las dos A, o la
   * última A tras la B.
   */
  readonly que: 'consecuente' | 'b' | 'ultima-a';
  /** Cuántos compases mide. */
  readonly compases: number;
  /**
   * Lo tuyo que repite al empezar. El consecuente, la cabeza del antecedente; la
   * última A, una A tuya que ya cierra si la hay —entera— o, si ninguna cierra, su
   * cabeza. Nulo en la B, que no repite nada.
   */
  readonly repite: Tramo | null;
  /**
   * Cómo acaba: **en la tónica** el consecuente y la última A, que cierran la forma,
   * o **abierta** la B, que tiene que volver a tu primer acorde (`vuelveA`).
   */
  readonly acaba: 'en-la-tonica' | 'abierta';
  /** Con qué no puede empezar: la cabeza de la A, para que la B contraste. */
  readonly noEmpiezaComo: Tramo | null;
  /** Adónde tiene que poder volver al acabar: el primer acorde de la A, en la B. */
  readonly vuelveA: DegreeSymbol | null;
}

/** El papel de cada sección que ya está. */
export type PapelDeLaSeccion = 'antecedente' | 'consecuente' | 'a' | 'b';

export interface FormaReconocida {
  readonly forma: 'periodo' | 'aaba';
  /** Cuántos compases mide cada sección: cuatro u ocho. */
  readonly compasesPorSeccion: number;
  /** Las secciones que ya suenan, en orden. */
  readonly secciones: readonly PapelDeLaSeccion[];
  /**
   * En un periodo, si el consecuente empieza como el antecedente —el paralelo— o
   * con otra cosa —el contrastante—. Si falta, el que se propone es paralelo. En una
   * AABA no dice nada: las A empiezan igual por definición.
   */
  readonly paralelo: boolean;
  /** Lo que falta para estar entera, o nulo si ya lo está. */
  readonly falta: LoQueFalta | null;
}

/** El consecuente que cierra con la misma cabeza que el antecedente. */
function consecuente(largo: number): LoQueFalta {
  return {
    que: 'consecuente',
    compases: largo,
    repite: { desde: 0, compases: largo / 2 },
    acaba: 'en-la-tonica',
    noEmpiezaComo: null,
    vuelveA: null,
  };
}

/** La B tras las dos A: empieza de otra manera y acaba abierta, de vuelta a la A. */
function laB(largo: number, primeraA: readonly Compas[]): LoQueFalta {
  return {
    que: 'b',
    compases: largo,
    repite: null,
    acaba: 'abierta',
    noEmpiezaComo: { desde: 0, compases: largo / 2 },
    vuelveA: primeraA[0]![0]!.degree,
  };
}

/**
 * La última A tras la B: la A que ya cierra, si alguna lo hace —la segunda antes,
 * que es la que suele cerrar—; si ninguna cierra, su cabeza y un final en casa.
 */
function ultimaA(
  mode: KeyMode,
  largo: number,
  a1: readonly Compas[],
  a2: readonly Compas[],
): LoQueFalta {
  const repite: Tramo = cierra(mode, a2)
    ? { desde: largo, compases: largo }
    : cierra(mode, a1)
      ? { desde: 0, compases: largo }
      : { desde: 0, compases: largo / 2 };
  return {
    que: 'ultima-a',
    compases: largo,
    repite,
    acaba: 'en-la-tonica',
    noEmpiezaComo: null,
    vuelveA: null,
  };
}

/** Las formas que hacen unas secciones del mismo largo. */
function reconocer(
  mode: KeyMode,
  secciones: readonly (readonly Compas[])[],
  largo: number,
): FormaReconocida[] {
  const [a1, a2, b, a3] = secciones;
  if (!esUnaFrase(a1!)) {
    return [];
  }
  const forma = (
    nombre: FormaReconocida['forma'],
    papeles: readonly PapelDeLaSeccion[],
    paralelo: boolean,
    falta: LoQueFalta | null,
  ): FormaReconocida => ({
    forma: nombre,
    compasesPorSeccion: largo,
    secciones: papeles,
    paralelo,
    falta,
  });
  if (a2 === undefined) {
    // Una frase que se queda abierta es un antecedente: le falta quien la cierre.
    return abierta(mode, a1!) ? [forma('periodo', ['antecedente'], true, consecuente(largo))] : [];
  }
  const repite = mismaCabeza(a1!, a2);
  // La B contrasta si no empieza como la A: ni el primer compás.
  const contrasta = b !== undefined && !mismoCompas(b[0]!, a1![0]!);
  const formas: FormaReconocida[] = [];
  if (b === undefined) {
    if (abierta(mode, a1!) && cierra(mode, a2)) {
      formas.push(forma('periodo', ['antecedente', 'consecuente'], repite, null));
    }
    if (repite) {
      formas.push(forma('aaba', ['a', 'a'], true, laB(largo, a1!)));
    }
    return formas;
  }
  if (!repite || !contrasta) {
    return [];
  }
  if (a3 === undefined) {
    return [forma('aaba', ['a', 'a', 'b'], true, ultimaA(mode, largo, a1!, a2))];
  }
  return mismaCabeza(a1!, a3) ? [forma('aaba', ['a', 'a', 'b', 'a'], true, null)] : [];
}

/**
 * Las formas que hace lo tuyo, entero, y lo que les falta: con secciones de cuatro
 * compases primero y de ocho después.
 *
 * - **Un periodo**: el antecedente que se queda abierto y el consecuente que cierra.
 *   Con solo el antecedente —una frase de cuatro u ocho que no acaba en casa—, falta
 *   el consecuente: tu cabeza otra vez y un final en la tónica.
 * - **Una AABA**: una A que se repite empezando igual, una B que no empieza como ella
 *   y la A otra vez. Con `AA` falta la B; con `AAB`, la última A.
 *
 * Puede salir más de una, y es verdad las dos veces: `I IV V V | I IV V I` es un
 * periodo entero y también las dos A de una AABA a la que le falta la B. Quien lo
 * use elige; el juez no castiga ninguna de las dos.
 */
export function formasDe(mode: KeyMode, compases: readonly Compas[]): FormaReconocida[] {
  return [4, 8].flatMap((largo) => {
    const veces = compases.length / largo;
    if (!Number.isInteger(veces) || veces < 1 || veces > 4) {
      return [];
    }
    const secciones = Array.from({ length: veces }, (_, k) =>
      compases.slice(k * largo, (k + 1) * largo),
    );
    return reconocer(mode, secciones, largo);
  });
}

// ─── La andaluza que reposa en su V ───────────────────────────────────────────

/** Dónde reposa una andaluza frigia y por dónde llega. */
export interface AndaluzaFrigia {
  /** El acorde mayor donde reposa: el V de un menor, o el V/vi si se escribió en mayor. */
  readonly centro: DegreeSymbol;
  /** El acorde mayor medio tono por encima del centro, que baja a él: el VI, o el IV. */
  readonly semitono: DegreeSymbol;
}

/**
 * Si lo tuyo es **una andaluza que reposa en su V**, como la oye el flamenco: la
 * bajada `i VII VI V` en algún sitio, y el final en ese V, llegando desde el acorde
 * de medio tono por encima. Nulo si no.
 *
 * En La menor es `Am G F E`, y el flamenco no lo oye como una semicadencia que pide
 * volver al La: oye el Mi como su casa —el modo de Mi, el frigio mayor— y el Fa
 * como su bII, el semitono que baja a ella. Así que **acabar en el V es acabar**, y
 * resolverlo a la i es otra música. Esto es una forma de cierre, no un cambio de
 * acorde: lo que hace falta saber es si acabar ahí es reposar, y eso lo pregunta
 * quien construye los finales y quien juzga si una salida llega. El cambio de un
 * compás que lleva a un centro bajando medio tono es el `frigio` de
 * `reharmonization.ts`.
 *
 * **Se busca por las notas, no por el nombre de los grados**: la misma bajada
 * escrita en Do mayor es `vi V IV V/vi`, y su centro es el `V/vi`. El centro es
 * **mayor**: con la v del menor natural la bajada acaba en un acorde menor, que es
 * otro frigio y no el del flamenco.
 */
export function andaluzaFrigia(
  mode: KeyMode,
  suyos: readonly DegreeSymbol[],
): AndaluzaFrigia | null {
  const catalogo = new Set<DegreeSymbol>(degreesFor(mode));
  const seguidos = suyos.filter((grado, i) => i === 0 || grado !== suyos[i - 1]);
  if (seguidos.length < 4 || seguidos.some((grado) => !catalogo.has(grado))) {
    return null;
  }
  const acorde = (grado: DegreeSymbol) => resolveDegree(0, mode, grado);
  const centro = acorde(seguidos.at(-1)!);
  const semitono = acorde(seguidos.at(-2)!);
  if (
    centro.quality !== 'major' ||
    semitono.quality !== 'major' ||
    semitono.root !== (centro.root + 1) % 12
  ) {
    return null;
  }
  // La bajada, en semitonos sobre el centro y con su especie: la tónica menor una
  // cuarta por encima, el acorde mayor un tono por debajo, y los dos de la cadencia.
  const bajada: readonly (readonly [number, string])[] = [
    [5, 'minor'],
    [3, 'major'],
    [1, 'major'],
    [0, 'major'],
  ];
  const baja = seguidos.some((_, k) =>
    bajada.every(([sobre, especie], paso) => {
      const grado = seguidos[k + paso];
      return (
        grado !== undefined &&
        acorde(grado).root === (centro.root + sobre) % 12 &&
        acorde(grado).quality === especie
      );
    }),
  );
  return baja ? { centro: centro.degree, semitono: semitono.degree } : null;
}

/** Dónde reposa lo frigio de una canción y desde qué acordes se llega a ese reposo. */
export interface CentroFrigio {
  readonly centro: DegreeSymbol;
  readonly llegan: readonly DegreeSymbol[];
}

/**
 * Si lo tuyo **puede reposar en un centro frigio**, y por dónde se llega a él. Dos
 * maneras, y una sola regla para el juez, la comprobación y quien construye:
 *
 * - **Lo tuyo es una andaluza que ya reposa en su V** (`andaluzaFrigia`), con estilo
 *   o sin él: acabar ahí es lo que hace, y se llega por su semitono.
 * - **El estilo es flamenco**, en menor: el V es su casa aunque lo tuyo no baje
 *   entero, y se llega por el semitono del VI o desde el iv, que es como para una
 *   copla.
 *
 * Sin ninguna de las dos, `VI V` es la semicadencia frigia del menor de manual, que
 * pide seguir.
 */
export function centroFrigio(
  mode: KeyMode,
  estilo: StyleId | null | undefined,
  tuyos: readonly DegreeSymbol[],
): CentroFrigio | null {
  const flamenco = estilo === 'flamenco' && mode === 'minor';
  const andaluza = andaluzaFrigia(mode, tuyos);
  if (andaluza !== null) {
    return {
      centro: andaluza.centro,
      llegan: flamenco ? [andaluza.semitono, 'iv'] : [andaluza.semitono],
    };
  }
  return flamenco ? { centro: 'V', llegan: ['VI', 'iv'] } : null;
}

/**
 * Si una canción **acaba en el reposo frigio** de lo tuyo (`centroFrigio`): en su
 * centro, llegando desde uno de los suyos. Devuelve desde qué acorde suena ese centro
 * final, o nulo.
 *
 * Llegar ahí **es llegar**: así acaba una falseta y así acaba una andaluza que no
 * vuelve a la i. Lo usan el juez —la cadencia y lo que tiene que llegar—, la
 * comprobación de `seguir`, que no exige la tónica si se acaba aquí, y quien
 * construye los finales que reposan.
 */
export function reposoFrigio(
  mode: KeyMode,
  estilo: StyleId | null | undefined,
  tuyos: readonly DegreeSymbol[],
  cancion: readonly DegreeSymbol[],
): number | null {
  const frigio = centroFrigio(mode, estilo, tuyos);
  if (frigio === null || cancion.at(-1) !== frigio.centro) {
    return null;
  }
  let desde = cancion.length - 1;
  while (desde > 0 && cancion[desde - 1] === frigio.centro) {
    desde -= 1;
  }
  const antes = cancion[desde - 1];
  return antes !== undefined && frigio.llegan.includes(antes) ? desde : null;
}
