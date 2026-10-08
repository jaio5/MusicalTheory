/**
 * Los movimientos con los que se rearmoniza, y cómo se comprueba que un acorde
 * propuesto es de verdad el que dice ser.
 *
 * Esto es lo que hace que las versiones de una canción no sean lo que se le
 * ocurra a un modelo: el modelo propone un grado y **dice qué movimiento ha
 * aplicado**, y aquí se aplica ese mismo movimiento al grado de partida y se
 * comparan. Si no coincide, esa versión se cae. Es la misma regla que se sigue
 * con los cifrados —no se creen, se recalculan desde los grados—, llevada del
 * cifrado al razonamiento.
 *
 * **No hay una tabla de sustituciones escrita a mano.** Cada movimiento es una
 * función que se apoya en el catálogo de grados que ya existe: se pregunta a
 * `resolveDegree` cuántos semitonos y qué especie es un grado, se le hace la
 * transformación y se busca con `degreeOfChord` qué grado ha salido. Así, un
 * grado nuevo en el catálogo entra solo en todos los movimientos, y no puede
 * pasar que la tabla diga una cosa y el catálogo otra.
 *
 * Lo que un movimiento no puede hacer devuelve nulo, y callar es mejor que
 * inventarse un parentesco: `substitutionsFor` solo enseña lo que se sostiene.
 *
 * ## El sitio donde cae
 *
 * Varios **no se entienden sin los vecinos**, y aplicados a un grado suelto daban
 * música falsa: el tritono salía en un compás que no iba a ningún sitio, la
 * interrumpida cambiaba la dominante en vez de la tónica que la sigue, y «su
 * dominante delante» no tiene sentido sin saber delante de qué. Por eso
 * `applyMove` acepta el `Entorno` —el compás de antes y el de después, y en un
 * blues en qué compás del coro cae— y con él comprueba que el movimiento cae donde
 * tiene sentido. Sin él contesta la pregunta del catálogo, «qué sale de este
 * grado», que es la que hace `reharmonizationsFor`; los que solo existen en un
 * sitio —su dominante, su predominante, el semitono frigio, el cambio rápido—
 * callan.
 *
 * ## Uno que cambia cuántos acordes hay
 *
 * Partir una dominante en su ii y ella (`ii-v`) no cabe aquí: todo lo de este
 * fichero cambia un grado por otro y deja los pulsos, y eso cambia uno por dos. Va
 * en `partir.ts`, con su propia comprobación.
 */

import type { ChordQuality, EspecieDeBloque } from '../chords';
import { roleOfDegreeSymbol } from '../harmonic-function';
import type { KeyMode } from '../keys';
import { normalizePitchClass, type PitchClass } from '../notes';
import {
  degreeInMode,
  degreeOfChord,
  gradosDeLaEscala,
  resolveDegree,
  type DegreeSymbol,
} from '../progressions';
import { tonicaDe } from './tonica';

export type MoveId =
  | 'relativo'
  | 'tritono'
  | 'prestamo'
  | 'interrumpida'
  | 'intercambio'
  | 'dominante'
  | 'funcion'
  | 'modal'
  | 'predominante'
  | 'ii-v'
  | 'cambio-rapido'
  | 'frigio'
  | 'vaiven';

/**
 * Los compases de al lado del que se cambia, **tal como quedan**.
 *
 * `null` es que no hay: el primer compás no tiene anterior y el último no tiene
 * siguiente. Ausente —`undefined`— es que no se pregunta por el sitio.
 */
export interface Entorno {
  readonly anterior?: DegreeSymbol | null;
  readonly siguiente?: DegreeSymbol | null;
  /**
   * En qué compás de un coro de blues cae el que se cambia, contando desde cero; nulo
   * o ausente si lo tuyo no es un blues. Lo pone quien sabe que lo es
   * (`formaDeBlues`, `bluesAMedias`): **el cambio rápido no se ve en los vecinos**,
   * porque `I I I` es igual en el compás 2 de un blues que en cualquier otra canción.
   */
  readonly compasDelBlues?: number | null;
  /**
   * Si lo tuyo es **un vamp sobre la tónica en un funk** —el I7 con su IV7, el im7
   * con su iv7— (`esUnVampDeFunk`). Tampoco se ve en los vecinos: `I I IV I` es un
   * vamp en un funk y una estrofa en un pop.
   */
  readonly vampDeTonica?: boolean;
}

export interface Move {
  readonly id: MoveId;
  /** Cómo se llama, para el rótulo. */
  readonly name: string;
  /** Qué hace y por qué funciona, en una frase de músico. */
  readonly why: string;
}

/** Los semitonos y la especie de un grado, preguntados al catálogo. */
function shapeOf(
  mode: KeyMode,
  degree: DegreeSymbol,
): { offset: PitchClass; quality: ChordQuality } | null {
  try {
    // Con tónica en cero, la fundamental que sale **es** el desplazamiento.
    const chord = resolveDegree(0, mode, degree);
    return { offset: chord.root, quality: chord.quality };
  } catch {
    // El grado no existe en ese modo. Es lo que pasa al aplicar un movimiento de
    // mayor a una canción menor, y no es un error: es que ahí no se puede.
    return null;
  }
}

/** El grado que corresponde a esos semitonos y esa especie, o nulo si no hay. */
function degreeAt(mode: KeyMode, offset: number, quality: ChordQuality): DegreeSymbol | null {
  // Sin dominantes secundarias: aquí se pregunta en qué grado diatónico o
  // prestado se convierte un acorde, y una dominante secundaria no es ninguna de
  // las dos cosas.
  return degreeOfChord(0, mode, normalizePitchClass(offset), quality, false);
}

/** La especie contraria, que es lo que distingue un relativo de un traslado. */
function opuesta(quality: ChordQuality): ChordQuality | null {
  if (quality === 'major') {
    return 'minor';
  }
  return quality === 'minor' ? 'major' : null;
}

/**
 * El relativo de un grado: la tercera de distancia que comparte dos notas.
 *
 * Un acorde mayor tiene su relativo menor tres semitonos por debajo —C y Am— y
 * uno menor, su relativo mayor tres por encima. Los disminuidos y aumentados no
 * tienen relativo, y ahí se devuelve nulo en vez de forzar uno.
 */
function relativo(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  return conLaOtraEspecie(mode, degree, (quality) => (quality === 'major' ? -3 : 3));
}

/**
 * El mismo grado con la otra especie, movido lo que se le diga.
 *
 * Es lo que hacen los dos movimientos que cambian mayor por menor: el
 * intercambio se queda donde está y el relativo se va tres semitonos. Escrito
 * dos veces, la comprobación de «este grado no tiene la otra especie» estaba
 * dos veces, y **una de las dos puede olvidarse el segundo nulo**: el que dice
 * que un disminuido no tiene relativo.
 */
function conLaOtraEspecie(
  mode: KeyMode,
  degree: DegreeSymbol,
  salto: (quality: ChordQuality) => number,
): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (shape === null) {
    return null;
  }
  const destino = opuesta(shape.quality);
  if (destino === null) {
    return null;
  }
  return degreeAt(mode, shape.offset + salto(shape.quality), destino);
}

/**
 * El otro acorde de la escala que hace el mismo papel: a una tercera, con dos notas
 * en común y la misma función —tónica, subdominante o dominante—.
 *
 * Es lo que el relativo no alcanza. **Un disminuido no tiene relativo**, así que el
 * ii° del menor no se podía cambiar por el iv ni el iv por el ii°, y son las dos
 * subdominantes del menor de toda la vida: comparten el Re y el Fa en La menor, y
 * las dos empujan hacia el V (`harmonic-function.ts` ya lo decía). Lo mismo el
 * vii° y el V, que son la misma dominante con y sin fundamental, y el iii y el I,
 * que reposan igual.
 *
 * El relativo va aparte, con su nombre, y aquí no se repite: si el que hace el
 * mismo papel es el relativo, esto devuelve nulo. Y solo dentro de la escala: un
 * préstamo ya es otro color, y tiene su movimiento.
 */
function mismaFuncion(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const escala = gradosDeLaEscala(mode);
  // El napolitano sí: es la subdominante con la fundamental rebajada —el bII de La
  // menor comparte el Re y el Fa con el iv—, y cambiarlo por ella deshace el color
  // sin cambiar adónde empuja (el arreglista lo pidió en un metal neoclásico).
  if (!escala.includes(degree) && degree !== 'bII') {
    return null;
  }
  const acorde = resolveDegree(0, mode, degree);
  const papel = roleOfDegreeSymbol(degree);
  const suRelativo = relativo(mode, degree);
  return (
    escala.find((otro) => {
      const candidato = resolveDegree(0, mode, otro);
      const distancia = normalizePitchClass(candidato.root - acorde.root);
      const comunes = candidato.notes.filter((nota) => acorde.notes.includes(nota)).length;
      return (
        otro !== degree &&
        otro !== suRelativo &&
        [3, 4, 8, 9].includes(distancia) &&
        comunes >= 2 &&
        roleOfDegreeSymbol(otro) === papel
      );
    }) ?? null
  );
}

/**
 * La sustitución tritonal: cambiar una dominante por la que está a un tritono.
 *
 * Las dos comparten el tritono que aprieta —la tercera de una es la séptima de
 * la otra—, así que la tensión es la misma y el bajo baja por semitonos en vez
 * de saltar una cuarta. Solo se le hace a un acorde mayor: es la especie que
 * lleva el tritono con la séptima, y aplicárselo a un menor no significa nada.
 *
 * **Y solo antes de adonde iba.** Un Db en Do mayor comparte el tritono del G7
 * porque el G7 va a Do: puesto en un compás que no va a ningún sitio, es un acorde
 * de otra tonalidad. Con el entorno, el siguiente tiene que ser el objetivo —una
 * quinta por debajo del que se cambia, o medio tono por debajo si lo que se
 * deshace es el sustituto—. **Y suena con séptima** (`especieDelMovimiento`):
 * sin ella el Db no lleva el Si que lo hace pariente del G7.
 */
function tritono(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (shape === null || shape.quality !== 'major') {
    return null;
  }
  if (entorno?.siguiente !== undefined) {
    const objetivo = entorno.siguiente === null ? null : shapeOf(mode, entorno.siguiente);
    const resuelve =
      objetivo !== null &&
      (objetivo.offset === normalizePitchClass(shape.offset - 7) ||
        objetivo.offset === normalizePitchClass(shape.offset - 1));
    if (!resuelve) {
      return null;
    }
  }
  const destino = degreeAt(mode, shape.offset + 6, 'major');
  // El tritono de un grado consigo mismo no es una sustitución. Pasa cuando el
  // catálogo solo tiene uno de los dos lados.
  /* v8 ignore next -- hoy ningun grado del catalogo es su propio tritono, y hay prueba que lo vigila */
  return destino === degree ? null : destino;
}

/** Si un grado es de la escala mayor: todas sus notas están en ella. */
function deLaEscalaMayor(degree: DegreeSymbol): boolean {
  const escala = new Set([0, 2, 4, 5, 7, 9, 11]);
  return resolveDegree(0, 'major', degree).notes.every((nota) => escala.has(nota));
}

/**
 * El préstamo modal: el acorde del mismo grado, traído de la tonalidad paralela.
 *
 * Se pregunta al menor paralelo qué acorde tiene sobre ese grado de la escala
 * —`degreeInMode`, que ya traduce por función— y se busca ese acorde en el
 * catálogo mayor. Así salen los cuatro de verdad: iii → bIII, IV → iv, vi → bVI y
 * vii° → bVII.
 *
 * Antes se calculaba «un semitono por debajo y mayor», que acertaba con tres y
 * **se inventaba el cuarto**: el ii salía bII, y el segundo grado del menor
 * paralelo es el ii°, no el napolitano. Y aplicado a un bVI devolvía el V y lo
 * llamaba «prestado», que es justo deshacer el préstamo. Por eso solo se presta lo
 * que es de la escala: un préstamo trae algo de fuera a la escala, no al revés.
 *
 * **Solo existe en mayor, y no por descuido.** El catálogo de menor ya trae
 * dentro los préstamos que se usan de verdad —el V mayor viene del menor
 * armónico y el bII es el napolitano—, así que en menor no queda un grado «de
 * fuera» al que ir: lo que se querría hacer ahí (v por V) es cambiar la especie,
 * y para eso está `intercambio`. Devolver nulo es lo honesto; inventar un
 * destino sería enseñar un parentesco que no existe.
 */
function prestamo(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  if (mode !== 'major' || shapeOf(mode, degree) === null || !deLaEscalaMayor(degree)) {
    return null;
  }
  // Todo grado de la escala mayor tiene su gemelo en el menor: `degreeInMode`
  // solo devuelve nulo con la dominante del ii, que no es de la escala.
  const paralelo = shapeOf('minor', degreeInMode(degree, 'minor')!)!;
  const prestado = degreeAt(mode, paralelo.offset, paralelo.quality);
  // El V del menor es el mismo V mayor: ahí no hay nada que traer.
  return prestado === degree ? null : prestado;
}

/** Las dominantes que prometen la tónica: lo que la interrumpida deja sin cumplir. */
const PROMETEN_LA_TONICA: readonly DegreeSymbol[] = ['V', 'v', 'vii°'];

/**
 * La cadencia interrumpida: donde la dominante prometía la tónica, entra otro.
 *
 * **Lo que cambia es la tónica, no la dominante.** Antes se le hacía al V y lo
 * cambiaba por el vi: el compás que preparaba desaparecía, y lo que quedaba no era
 * una cadencia rota sino una sin dominante. La rota es `V → vi` donde se esperaba
 * `V → I`: el V se queda y la llegada se tuerce.
 *
 * Y el que entra es el acorde **una tercera por debajo de la tónica que comparte
 * dos notas con ella**: el vi en mayor —La menor contra Do: Do y Mi— y el VI en
 * menor —Fa contra La menor: La y Do—. Antes salía el relativo, que en menor es el
 * III, y ese ni está por debajo ni es la cadencia rota de nadie. Con el entorno,
 * solo después de una dominante: sin promesa no hay nada que romper.
 */
function interrumpida(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): DegreeSymbol | null {
  if (degree !== tonicaDe(mode)) {
    return null;
  }
  if (entorno?.anterior !== undefined && !PROMETEN_LA_TONICA.includes(entorno.anterior ?? degree)) {
    return null;
  }
  const tonica = shapeOf(mode, degree)!;
  return degreeAt(mode, tonica.quality === 'major' ? -3 : -4, opuesta(tonica.quality)!);
}

/**
 * Su dominante delante: el compás pasa a ser la dominante del que le sigue.
 *
 * Es el movimiento que faltaba, y por el que en 338 salidas no había ni una
 * dominante secundaria: ninguno de los cinco de antes llevaba a un `V/vi`. Delante
 * de la tónica es el V de siempre; delante de otro grado, su dominante secundaria
 * si el catálogo la tiene —en mayor la del ii, el iii, el V y el vi; en menor la
 * del iv y la del V—. Delante de un grado sin ella, nulo: un I mayor delante del
 * IV sería su dominante solo con la séptima, y esa no entra en el cálculo del
 * grado.
 *
 * **Solo con entorno**, porque sin saber qué viene después no hay de quién ser
 * la dominante.
 */
function dominante(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): DegreeSymbol | null {
  const siguiente = entorno?.siguiente ?? null;
  const objetivo = siguiente === null ? null : shapeOf(mode, siguiente);
  if (siguiente === null || objetivo === null) {
    return null;
  }
  const suya =
    siguiente === tonicaDe(mode)
      ? 'V'
      : degreeOfChord(0, mode, normalizePitchClass(objetivo.offset + 7), 'major');
  // Solo la de la tónica o una secundaria: un acorde de la escala que cae una
  // quinta por encima —el VII delante del III— ya es otra cosa, no «su dominante».
  if (suya === null || (suya !== 'V' && !suya.includes('/')) || suya === degree) {
    return null;
  }
  return suya;
}

/**
 * El intercambio: el mismo grado con la especie cambiada.
 *
 * Es el más simple y el que más cambia el ánimo sin mover el bajo: la
 * fundamental se queda donde está y la tercera sube o baja un semitono. Devuelve
 * nulo cuando el catálogo no tiene ese grado con la otra especie, que es lo
 * honesto: significa que en esta tonalidad ese acorde no se usa así.
 */
function intercambio(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  return conLaOtraEspecie(mode, degree, () => 0);
}

/**
 * La dominante con sensible y sin ella: el V cambia por el séptimo grado rebajado
 * —el bVII en mayor, el VII en menor—, que llega a casa sin la nota que sube, **y al
 * revés**.
 *
 * Es la sustitución de cabecera del rock y del folk mixolidio —`I IV bVII IV` en
 * lugar de `I IV V IV`, un puente que acaba en el bVII y no en el V— y, del revés,
 * la del jazz: la «puerta de atrás» `iv7 bVII7 I` por la de delante, `iv7 V7 I`. No
 * salía de ninguno de los otros: no comparte dos notas con el V (por eso no es su
 * relativo) ni es el mismo grado del otro modo (la v del menor paralelo no está en el
 * catálogo mayor). Lo que cambia es la manera de tirar hacia casa, no el sitio: por
 * eso solo va entre esos dos, y el juez la pesa según el estilo como pesa cerrar sin
 * sensible.
 */
function modal(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const sinSensible: DegreeSymbol = mode === 'major' ? 'bVII' : 'VII';
  if (degree === 'V') {
    return sinSensible;
  }
  return degree === sinSensible ? 'V' : null;
}

/** Las subdominantes de la escala, que son las que preparan la dominante. */
const PREDOMINANTES: Readonly<Record<KeyMode, readonly DegreeSymbol[]>> = {
  major: ['ii', 'IV'],
  minor: ['ii°', 'iv'],
};

/** Cuántas notas comparten dos grados, en sus tríadas. */
function notasComunes(mode: KeyMode, a: DegreeSymbol, b: DegreeSymbol): number {
  const deA = resolveDegree(0, mode, a).notes;
  return resolveDegree(0, mode, b).notes.filter((nota) => deA.includes(nota)).length;
}

/**
 * La predominante delante de la dominante: el compás de antes del V —o de la v del
 * menor natural— pasa a ser una subdominante, y la frase queda en tónica,
 * subdominante, dominante.
 *
 * **Lo que cambia es un compás que no preparaba nada**: uno de tónica —el I, el vi,
 * el iii— o la propia dominante repetida, que en `I V V I` se queda en `I ii V I`.
 * Lo que ya es subdominante ya prepara, una dominante secundaria también, y el
 * acorde que baja medio tono al V —el VI de la andaluza— también: es la otra manera
 * de llegar.
 *
 * **Hay dos, y las dos son verdad**: el ii y el IV en mayor, la ii° y el iv en menor.
 * Va primero la que comparte más notas con lo que había —el IV por el I, que
 * conserva el Do; el ii por el V, que conserva el Re—, y con las mismas, la que está
 * una quinta por encima de la dominante, que es el ii: así llega por quintas. La
 * séptima —el ii7 y la iiø7 del jazz— la pone quien sabe en qué idioma va la
 * canción, no el movimiento.
 *
 * **Y no tuerce una llegada**: la tónica a la que acaba de llegar una dominante no
 * se cambia, que `V I V` pasaría a `V IV V` y la promesa del primer V se quedaría
 * sin cumplir —eso es la interrumpida, y se hace a propósito—.
 */
function predominantes(
  mode: KeyMode,
  degree: DegreeSymbol,
  entorno?: Entorno,
): readonly DegreeSymbol[] {
  const siguiente = entorno?.siguiente ?? null;
  if (
    (siguiente !== 'V' && siguiente !== 'v') ||
    shapeOf(mode, siguiente) === null ||
    shapeOf(mode, degree) === null
  ) {
    return [];
  }
  // Lo que baja medio tono a la dominante ya la prepara: el VI de la andaluza, el bVI
  // de la semicadencia frigia. Cambiarlo por la ii° deshace la bajada para decir lo
  // mismo.
  const porSemitono = degreeAt(mode, shapeOf(mode, siguiente)!.offset + 1, 'major') === degree;
  const preparable =
    (roleOfDegreeSymbol(degree) === 'tonic' || degree === 'V' || degree === 'v') && !porSemitono;
  const esUnaLlegada =
    degree === tonicaDe(mode) &&
    entorno?.anterior !== undefined &&
    entorno.anterior !== null &&
    PROMETEN_LA_TONICA.includes(entorno.anterior);
  if (!preparable || esUnaLlegada) {
    return [];
  }
  // Ni repetir lo de antes ni volver atrás desde ello: después del ii, el IV
  // retrocede dentro de la misma función —`ii V V` no pasa a `ii IV V`—, y después
  // del IV, el ii se adelanta y sí vale.
  const anterior = entorno?.anterior ?? null;
  const retrocede = (destino: DegreeSymbol) =>
    destino === anterior || PREDOMINANTES[mode][0] === anterior;
  // `sort` es estable: con las mismas notas en común se queda el orden de la tabla,
  // que pone el ii delante.
  return PREDOMINANTES[mode]
    .filter((destino) => !retrocede(destino))
    .sort((a, b) => notasComunes(mode, degree, b) - notasComunes(mode, degree, a));
}

/**
 * El cambio rápido del blues: el compás 2 pasa al cuarto grado y vuelve a la tónica
 * en el 3, **y al revés**.
 *
 * Es la única diferencia entre los dos esquemas de doce que se tocan, y los dos son
 * el mismo blues: con él, el coro se mueve antes de llegar al 5; sin él, la tónica
 * aguanta cuatro compases. Por eso va en las dos direcciones, como el cambio modal,
 * y solo ahí: en el 2, con la tónica en el 1 y en el 3. **El sitio no se ve en los
 * vecinos** —`I I I` es igual en cualquier canción—, así que lo dice el entorno
 * (`compasDelBlues`) quien sabe que lo tuyo es un blues.
 */
function cambioRapido(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): DegreeSymbol | null {
  const tonica = tonicaDe(mode);
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  if (
    entorno?.compasDelBlues !== 1 ||
    entorno.anterior !== tonica ||
    entorno.siguiente !== tonica
  ) {
    return null;
  }
  if (degree === tonica) {
    return cuarto;
  }
  return degree === cuarto ? tonica : null;
}

/** Dónde reposa una cadencia frigia: en casa, o en la dominante, que es el centro de la andaluza. */
function esUnCentro(mode: KeyMode, degree: DegreeSymbol): boolean {
  return degree === tonicaDe(mode) || degree === 'V' || degree === 'v';
}

/**
 * El semitono frigio: el compás pasa a ser el acorde **mayor medio tono por encima**
 * del que le sigue, que llega a él bajando un semitono y sin dominante.
 *
 * Es el final de la andaluza —el VI que baja al V, Fa a Mi en La menor— y es lo que
 * hace que el flamenco oiga ese V como su casa: visto desde el Mi, el Fa es su bII.
 * Delante de la tónica es el bII de siempre, el color frigio del metal; delante del
 * V de un mayor, el bVI, la semicadencia frigia. **Solo delante de un centro** —la
 * tónica o la dominante—, porque bajar medio tono a un acorde de paso no es ninguna
 * cadencia: es un acorde mayor de otra tonalidad.
 *
 * Es un movimiento, y no la forma: **reposar en el V sin resolverlo a la i** es
 * cómo acaba una andaluza frigia (`andaluzaFrigia`, en `formas.ts`), y eso lo
 * deciden quien construye los finales y el juez, no un compás que se cambia.
 */
function frigio(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): DegreeSymbol | null {
  const siguiente = entorno?.siguiente ?? null;
  // La v de un mayor no está en su catálogo, y ahí no hay centro que buscar.
  const centro =
    siguiente !== null && esUnCentro(mode, siguiente) ? shapeOf(mode, siguiente) : null;
  if (centro === null || shapeOf(mode, degree) === null) {
    return null;
  }
  const semitono = degreeAt(mode, centro.offset + 1, 'major');
  return semitono === degree ? null : semitono;
}

/**
 * **El giro del vamp**: sobre un vamp de tónica, el compás se va a un vecino sin
 * sensible y vuelve. En mayor, el bVII7 —el IV del IV— o el IV7 desde la tónica, y
 * el bVII7 desde el IV; en menor, el VII7, la v menor o el iv desde la tónica, y el
 * VII7 desde el iv. Es lo que hace un funk con `I7 I7 IV7 I7`: `I7 bVII7 I7 IV7`,
 * `I7 I7 IV7 bVII7`. Antes no había manera de llegar ahí —ningún movimiento lleva de
 * la I al bVII—, y retocando un vamp de funk salían el V7–I7 de una cadencia clásica
 * o el ivm7 de una balada (el quinto examen). **Solo en un vamp de funk**
 * (`Entorno.vampDeTonica`): en un pop, quitar la tónica por un bVII es otra cosa.
 */
function vaiven(mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno): readonly DegreeSymbol[] {
  if (entorno?.vampDeTonica !== true) {
    return [];
  }
  // En mayor, la tónica que va al cuarto ya es su dominante —el I7 que lleva al
  // IV7—: se queda, y el giro se hace donde la tónica no prepara nada. El im7 no
  // prepara el iv7: en menor no hay nada que guardar.
  if (mode === 'major' && degree === 'I' && entorno.siguiente === 'IV') {
    return [];
  }
  const vecinos: Readonly<
    Record<KeyMode, Readonly<Partial<Record<DegreeSymbol, readonly DegreeSymbol[]>>>>
  > = {
    major: { I: ['bVII', 'IV'], IV: ['bVII'] },
    minor: { i: ['VII', 'v', 'iv'], iv: ['VII'] },
  };
  /* v8 ignore next -- en un vamp de funk solo suenan la tonica y el cuarto (`esUnVampDeFunk`), y los dos estan en la tabla */
  return vecinos[mode][degree] ?? [];
}

type Aplicar = (mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno) => DegreeSymbol | null;
type Destinos = (mode: KeyMode, degree: DegreeSymbol, entorno?: Entorno) => readonly DegreeSymbol[];

/** Un movimiento de un solo destino, contestado como lista. */
function uno(aplicar: Aplicar): Destinos {
  return (mode, degree, entorno) => {
    const destino = aplicar(mode, degree, entorno);
    return destino === null ? [] : [destino];
  };
}

/**
 * Todos los destinos de cada movimiento, del primero —el que da `applyMove`— al
 * último. Casi todos tienen uno; la predominante tiene dos, porque el ii y el IV
 * preparan el V igual de bien.
 *
 * **Partir en ii–V no está**, y no por olvido: no cambia un grado por otro, cambia
 * uno por dos repartiendo sus pulsos, y eso lo hace `partirEnIiV` (`partir.ts`).
 * Preguntado aquí, no tiene destino.
 */
const DESTINOS: Readonly<Record<Exclude<MoveId, 'ii-v'>, Destinos>> = {
  relativo: uno(relativo),
  tritono: uno(tritono),
  prestamo: uno(prestamo),
  interrumpida: uno(interrumpida),
  intercambio: uno(intercambio),
  dominante: uno(dominante),
  funcion: uno(mismaFuncion),
  modal: uno(modal),
  predominante: predominantes,
  'cambio-rapido': uno(cambioRapido),
  frigio: uno(frigio),
  vaiven,
};

/**
 * En orden de cuánto se notan, que es el orden en el que se enseñan.
 *
 * El relativo primero porque es el que menos rompe —dos notas de tres siguen
 * ahí— y el tritono el último de los tres fuertes porque es el que más suena a
 * jazz en una canción que no lo era. Cada frase es verdad en todos los sitios donde
 * el movimiento cae: se lee en pantalla tal cual.
 */
export const MOVES: readonly Move[] = [
  {
    id: 'relativo',
    name: 'Su relativo',
    why: 'Comparte dos de sus tres notas y hace el mismo papel: cambia el color sin cambiar la función.',
  },
  {
    id: 'intercambio',
    name: 'Mayor por menor',
    why: 'La fundamental se queda y la tercera se mueve un semitono. Cambia el ánimo sin mover el bajo.',
  },
  {
    id: 'prestamo',
    name: 'Prestado del otro modo',
    why: 'El mismo grado visto desde la tonalidad paralela. Oscurece o aclara sin salir del centro.',
  },
  {
    id: 'interrumpida',
    name: 'Cadencia interrumpida',
    why: 'Donde la dominante prometía la tónica entra el acorde de una tercera por debajo, que comparte dos notas con ella: alarga la frase justo cuando iba a cerrar.',
  },
  {
    id: 'funcion',
    name: 'Misma función',
    why: 'Otro acorde de la escala a una tercera, con dos notas en común y el mismo papel: cambia el color sin cambiar adónde empuja.',
  },
  {
    id: 'modal',
    name: 'Sin sensible',
    why: 'El V y el séptimo grado rebajado tiran los dos a casa, uno con la sensible y otro sin ella: cambiar uno por otro cambia el idioma, no adónde va.',
  },
  {
    id: 'tritono',
    name: 'Sustitución tritonal',
    why: 'La dominante a un tritono, con séptima, lleva el mismo tritono dentro: igual de tensa, y el bajo baja por semitonos hasta adonde iba.',
  },
  {
    id: 'dominante',
    name: 'Su dominante delante',
    // Sin «con séptima» en la frase: la lleva casi siempre (`especieDelMovimiento`),
    // pero en una canción de quintas suena sin ella, y esta frase se lee en pantalla
    // tal cual. Lo que suena lo dice quien la construye, con el acorde delante.
    why: 'El compás pasa a ser la dominante del que le sigue: lo convierte en una llegada.',
  },
  // Los cuatro que dependen del sitio de la forma: delante de la dominante, en el
  // compás 2 de un blues, delante de un centro. Partir en ii–V va aquí por su nombre
  // y su porqué, pero no tiene destino (`partir.ts`).
  {
    id: 'predominante',
    name: 'Predominante delante',
    // Sin grados en la frase: nombrar el ii o el IV donde solo suena uno es hablar de
    // un acorde que no está (`loQueNoEsta`). Y sin «ii7» ni «iiø7»: la séptima la
    // pone el idioma de la canción, no el movimiento.
    why: 'El compás de antes de la dominante pasa a ser una subdominante, y la dominante llega preparada: tónica, subdominante, dominante.',
  },
  {
    id: 'ii-v',
    // Sin «ii» ni «V» en el nombre ni en la frase: el de una secundaria no es el ii
    // de la tonalidad, y nombrar un grado que no suena es mentir (`loQueNoEsta`).
    name: 'Partir la dominante',
    why: 'La dominante se parte en dos mitades: la primera pasa al acorde una quinta por encima, que la prepara, y la segunda sigue siendo ella. Los pulsos no cambian.',
  },
  {
    id: 'cambio-rapido',
    name: 'Cambio rápido',
    why: 'El compás 2 de un blues puede ser la tónica o el cuarto grado, que vuelve a ella en el 3: con él, el coro se mueve antes de llegar al 5; sin él, la tónica aguanta cuatro compases.',
  },
  {
    id: 'frigio',
    name: 'Semitono frigio',
    why: 'El compás pasa a ser el acorde mayor medio tono por encima del que le sigue, que llega a él bajando un semitono y sin dominante: la cadencia frigia, la del final de la andaluza.',
  },
  {
    id: 'vaiven',
    name: 'Giro del vamp',
    why: 'Sobre un vamp de tónica, el compás se va a un vecino sin sensible —el cuarto, el séptimo grado rebajado o la v menor— y vuelve: el vaivén del funk, que mueve la armonía sin cadencia.',
  },
];

export function moveById(id: unknown): Move | null {
  return MOVES.find((move) => move.id === id) ?? null;
}

/**
 * Todos los grados a los que lleva ese movimiento, el primero el que da
 * `applyMove`; vacío si a ese no se le puede.
 *
 * Con `entorno`, además, vacío si no cae donde tiene sentido (el tritono antes de
 * su objetivo, la interrumpida después de una dominante, su dominante y su
 * predominante delante de alguien, el cambio rápido en el 2 de un blues).
 */
export function destinosDelMovimiento(
  mode: KeyMode,
  degree: DegreeSymbol,
  id: unknown,
  entorno?: Entorno,
): readonly DegreeSymbol[] {
  const destinos =
    typeof id === 'string' && Object.hasOwn(DESTINOS, id)
      ? DESTINOS[id as keyof typeof DESTINOS]
      : undefined;
  return destinos === undefined ? [] : destinos(mode, degree, entorno);
}

/** El grado que sale de aplicar ese movimiento —el primero, si hay varios—, o nulo. */
export function applyMove(
  mode: KeyMode,
  degree: DegreeSymbol,
  id: unknown,
  entorno?: Entorno,
): DegreeSymbol | null {
  return destinosDelMovimiento(mode, degree, id, entorno)[0] ?? null;
}

/**
 * Si el movimiento que alguien dice haber aplicado es cierto.
 *
 * Es la función que sostiene toda la fase: lo que devuelve el modelo pasa por
 * aquí antes de enseñarse, y una versión que dice «sustitución tritonal» sin
 * serlo se cae en vez de llegar a la pantalla con una explicación falsa.
 */
export function isMove(
  mode: KeyMode,
  from: DegreeSymbol,
  to: DegreeSymbol,
  id: unknown,
  entorno?: Entorno,
): boolean {
  // Cualquiera de sus destinos: «predominante» es verdad del ii y del IV.
  return destinosDelMovimiento(mode, from, id, entorno).includes(to);
}

/**
 * La especie con la que tiene que sonar lo que sale de un movimiento, si pide una.
 *
 * El sustituto tritonal solo comparte el tritono con séptima, y una dominante
 * secundaria sin ella es un acorde mayor de otra tonalidad. **Y el V que sale de
 * «su dominante delante» también la lleva**: antes no, porque «es la dominante de
 * siempre», y el texto de la salida decía «con séptima» encima de una tríada. Un
 * compás que pasa a ser la dominante del siguiente es eso, una dominante, y en
 * casi todos los estilos suena con su séptima; donde no —una canción de quintas—,
 * lo decide quien construye la salida, que sabe en qué idioma va la canción.
 */
export function especieDelMovimiento(id: MoveId, to: DegreeSymbol): EspecieDeBloque | null {
  // `to` se queda en la firma: las dominantes secundarias solo salen de «su
  // dominante delante», así que hoy basta con el movimiento. Los cuatro nuevos no
  // piden ninguna: la predominante y el ii suenan con la séptima de su idioma, el
  // semitono frigio es un acorde mayor y el cambio rápido, el cuarto de siempre.
  void to;
  return id === 'tritono' || id === 'dominante' ? 'dominant7' : null;
}

/**
 * Cómo se llama un cambio concreto, **según hacia dónde va**.
 *
 * El intercambio va de mayor a menor o de menor a mayor, y con un solo nombre la
 * pantalla decía «mayor por menor» de un `iv` que pasaba a `IV`, que es justo lo
 * contrario. «X por Y» se lee como en «Cambia IV por iv»: lo que había, por lo que
 * entra. El cambio modal y el rápido se ponen y se quitan, y se llaman según cuál.
 * Los demás movimientos no tienen dirección y se llaman como siempre.
 */
export function nombreDelCambio(
  mode: KeyMode,
  id: MoveId,
  from: DegreeSymbol,
  to: DegreeSymbol,
  /** Con qué suena lo que entra: en quintas no hay tercera de la que hablar. */
  especie: EspecieDeBloque | null = null,
): string {
  const move = moveById(id)!;
  if (id === 'cambio-rapido') {
    // Quitarlo también es este movimiento, y no se llama igual que ponerlo.
    return to === tonicaDe(mode) ? 'Sin cambio rápido' : move.name;
  }
  if (id === 'modal') {
    // Un V5 no lleva sensible, ni la pierde: sin tercera, «con sensible» y «sin
    // sensible» son mentira. Se dice lo que cambia, que es el acorde.
    if (especie === 'quinta') {
      return `${to} en lugar de ${from}`;
    }
    return to === 'V' ? 'Con sensible' : move.name;
  }
  if (id !== 'intercambio') {
    return move.name;
  }
  return shapeOf(mode, from)?.quality === 'minor' && shapeOf(mode, to)?.quality === 'major'
    ? 'Menor por mayor'
    : move.name;
}
