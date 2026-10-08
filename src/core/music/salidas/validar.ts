/**
 * Las salidas: por dónde puede tirar lo que llevas tocado.
 *
 * Esto sustituye a lo que antes era «versiones de tu canción», y el cambio no es
 * de nombre. Aquello devolvía **la misma canción con dos o tres acordes
 * cambiados**: mismo número de compases, mismos pulsos, mismo orden, y cada
 * compás que cambiaba tenía que ser uno de los cinco movimientos de
 * `movimientos.ts` aplicado al que había. Servía para rearmonizar y no servía
 * para nada más.
 *
 * Lo que hace falta al componer es lo contrario: **la misma semilla y canciones
 * distintas**. Cuatro compases que se te han quedado dando vueltas y que alguien
 * te enseñe tres sitios adonde podrían ir, para elegir. Alargar, cerrar de otra
 * manera, repartir los pulsos de otro modo, meter una parte que contraste.
 *
 * ## Qué sostiene esto, ahora que las propuestas pueden alejarse
 *
 * La regla de [adr/0011] era que cada compás cambiado declaraba su movimiento y
 * el dominio lo volvía a aplicar para comprobarlo. Eso es lo que impedía que una
 * salida fuera «cuatro acordes distintos que cualquiera puede probar a mano». Si
 * ahora una propuesta puede tener otro largo y otro final, esa comprobación ya no
 * vale tal cual.
 *
 * **La declaración sube del compás al camino.** Cada propuesta dice cuál de las
 * cinco salidas ha tomado, y esta función vuelve a comprobarlo contra el dominio:
 * que un `seguir` mantenga de verdad tus compases y cierre en la tónica, que un
 * `estirar` no toque ni un grado, que un `contraste` pueda volver al principio.
 *
 * Y por debajo hay una segunda comprobación que no existía: **cada salto nuevo
 * tiene que estar en `saltosDeSalidas`**, que es el grafo armónico que ya estaba
 * escrito y probado —de cada grado, adónde se suele ir y por qué— con los saltos
 * que solo usan las salidas (`progressions.ts` dice por qué van aparte). Son unas tres
 * salidas por grado, así que una parte nueva de cuatro compases tiene del orden
 * de ochenta caminos posibles: bastante para componer, poco para inventarse
 * cualquier cosa.
 */

import type { KeyMode } from '../keys';
import { saltosDeSalidas, type DegreeMove, type DegreeSymbol } from '../progressions';
import type { StyleId } from '../styles';
import { reposoFrigio } from './formas';
import { formaDeBlues } from './juez/forma';
import { isMove } from './movimientos';
import { esPartirEnIiV, gruposPorPulsos } from './partir';
import type { PathId, PathStep, ProposedSection, ProposedStep } from './tipos';
import { tonicaDe } from './tonica';

export interface Path {
  readonly id: PathId;
  /** Cómo se llama en pantalla. */
  readonly name: string;
  /**
   * Qué hace, en una frase.
   *
   * Se lee en pantalla **y** se le manda al modelo: el catálogo del prompt se
   * genera desde aquí, igual que el de los movimientos, para que no pueda
   * ofrecer una salida que el validador no sepa comprobar.
   */
  readonly why: string;
}

/**
 * Las cinco, en orden de cuánto se alejan de lo que tocaste.
 *
 * `rearmonizar` va primera porque es la que menos se mueve —y porque es lo que
 * había antes, que sigue sirviendo y ahora es una salida más entre otras—.
 */
export const PATHS: readonly Path[] = [
  {
    id: 'rearmonizar',
    name: 'Los mismos compases, otros acordes',
    why: 'No toca el largo ni el reparto: cambia acordes por sus sustitutos. Cada compás que cambies declara su movimiento.',
  },
  {
    id: 'seguir',
    name: 'Seguir hasta cerrar',
    why: 'Mantiene tus compases tal cual y añade una cadencia que llegue a la tónica. Llegar a ella, no quedarse en ella: la tónica repetida no cierra nada.',
  },
  {
    id: 'otro-final',
    name: 'Otro final',
    why: 'Deja la primera mitad como está y cambia lo que viene después. Puede acabar antes.',
  },
  {
    id: 'estirar',
    name: 'Otro reparto',
    why: 'Los mismos acordes en el mismo orden, durando otra cosa: lo que era un compás son dos, o al reves.',
  },
  {
    id: 'contraste',
    name: 'Una parte que contraste',
    why: 'Mantiene tus compases y añade una parte que se va a otro sitio y puede volver al principio. No cierra.',
  },
];

export function pathById(id: unknown): Path | null {
  return PATHS.find((path) => path.id === id) ?? null;
}

/**
 * Lo más larga que puede ser una salida, en compases.
 *
 * El mismo tope que tiene lo que se manda, y no es casualidad: así el peor caso
 * de la respuesta no crece respecto a lo que ya presupuestaba `core/billing`, y
 * los cupos de pago siguen valiendo. Una salida que doblara el largo
 * doblaría la factura.
 */
export const MAX_PATH_STEPS = 32;

/** Lo más que puede durar un compás. Un tope de gasto, no una regla musical. */
export const MAX_BEATS = 16;

/**
 * Si desde un grado se puede ir al otro según el grafo del dominio.
 *
 * **Quedarse siempre vale**, y no está en el grafo: `saltosDeSalidas` contesta a
 * dónde se *va* desde un grado, así que de `i` no sale `i`. Pero un acorde que
 * dura dos compases es un acorde que dura dos compases, no un salto raro. Sin
 * esta línea se rechazaba media música: un `seguir` que cerraba con dos compases
 * de tónica caía por «un salto que el dominio no conoce».
 */
export function canFollow(mode: KeyMode, from: DegreeSymbol, to: DegreeSymbol): boolean {
  return from === to || saltosDe(mode, from).some((move) => move.to === to);
}

/**
 * `saltosDeSalidas` de un grado, guardado: construir un menú pregunta por los mismos
 * grados miles de veces, y cada pregunta copiaba y ordenaba la lista.
 */
const SALTOS = new Map<string, readonly DegreeMove[]>();

export function saltosDe(mode: KeyMode, from: DegreeSymbol): readonly DegreeMove[] {
  const clave = `${mode}|${from}`;
  const guardados = SALTOS.get(clave);
  if (guardados !== undefined) {
    return guardados;
  }
  const saltos = saltosDeSalidas(mode, from);
  SALTOS.set(clave, saltos);
  return saltos;
}

/**
 * Lo que suena después del compás `i`.
 *
 * Después del último, **el primero, si la canción no acaba en casa**: un bucle
 * que termina fuera de la tónica vuelve a empezar, y ahí el último compás prepara
 * el primero. Es lo que permite el `vi IV I V/vi`, con el III7 llevando de vuelta
 * al vi del principio. Si acaba en la tónica, después no hay nada.
 */
export function loQueSigue(
  mode: KeyMode,
  pasos: readonly PathStep[],
  i: number,
): DegreeSymbol | null {
  const siguiente = pasos[i + 1]?.degree;
  if (siguiente !== undefined) {
    return siguiente;
  }
  return pasos[i]!.degree === tonicaDe(mode) || i === 0 ? null : pasos[0]!.degree;
}

/** Si dos compases son el mismo compás. */
function sameBar(a: PathStep, b: PathStep): boolean {
  return a.degree === b.degree && a.beats === b.beats;
}

/**
 * Si la parte añadida va a algún sitio.
 *
 * **Un compás puede repetir el de al lado y eso es legítimo** —`canFollow` lo
 * permite a propósito—, pero una parte **entera** de un solo grado no es una
 * parte: es el mismo acorde sonando más rato.
 *
 * Es lo que devolvía el modelo como cierre: después de un V, `I I`. En Mi mayor,
 * «Mi Mi». Cumplía la letra de la regla —añade compases y acaba en la tónica— y no
 * proponía nada. Y para que un acorde dure más está `beats`, que llega a
 * dieciséis pulsos: repetir el compás no es la manera de decirlo.
 *
 * Es el hermano de «es tu canción tal cual», que ya estaba más arriba: una salida
 * tiene que salir a algún sitio. Con un solo compás añadido no aplica, porque un
 * compás no puede moverse: un `V` que resuelve en `I` y se acaba es un cierre
 * perfecto.
 */
function laParteSeMueve(pasos: readonly ProposedStep[], desde: number): boolean {
  const añadidos = pasos.slice(desde);
  return añadidos.length < 2 || new Set(añadidos.map((paso) => paso.degree)).size >= 2;
}

/** Si la propuesta empieza exactamente por los `cuantos` primeros compases tuyos. */
function sharesTheStart(
  original: readonly PathStep[],
  proposed: readonly ProposedStep[],
  cuantos: number,
): boolean {
  return original
    .slice(0, cuantos)
    .every((paso, i) => proposed[i] !== undefined && sameBar(paso, proposed[i]!));
}

/** Si todos los saltos de un tramo están en el grafo. */
function allStepsKnown(mode: KeyMode, pasos: readonly ProposedStep[], desde: number): boolean {
  for (let i = Math.max(desde, 1); i < pasos.length; i += 1) {
    if (!canFollow(mode, pasos[i - 1]!.degree, pasos[i]!.degree)) {
      return false;
    }
  }
  return true;
}

/** Lo que se comprueba de una propuesta, sea cual sea su camino. */
interface Propuesta {
  readonly mode: KeyMode;
  readonly original: readonly PathStep[];
  readonly proposed: readonly ProposedStep[];
  readonly estilo: StyleId | null;
}

/**
 * Lo que tiene que cumplir un compás tuyo al rearmonizar: o es uno de la
 * propuesta —el mismo grado sin movimiento declarado, u otro con el movimiento que
 * lo lleva ahí—, o dos, que solo puede ser la dominante partida en su ii y ella.
 */
function problemaDelCompas(
  { mode, original, proposed, estilo }: Propuesta,
  i: number,
  grupo: readonly number[],
  blues: boolean,
): string | null {
  const antes = original[i]!;
  const j = grupo[0]!;
  const paso = proposed[j]!;
  if (grupo.length === 2) {
    const segundo = proposed[j + 1]!;
    const partido =
      paso.move === 'ii-v' &&
      segundo.move === 'ii-v' &&
      esPartirEnIiV(mode, antes, paso, segundo, {
        anterior: proposed[j - 1]?.degree ?? null,
        siguiente: loQueSigue(mode, proposed, j + 1),
      });
    return partido ? null : 'rearmonizar no cambia el largo';
  }
  if (paso.degree === antes.degree) {
    // Declarar un movimiento en un compás que no cambió es describir algo
    // que no se ha hecho. Es la regla de adr/0011, y sigue viva aquí.
    return paso.move !== null && paso.move !== undefined
      ? 'declara un movimiento en un compás que no cambia'
      : null;
  }
  // Con los compases de al lado tal como quedan: el tritono tiene que ir
  // antes de su objetivo y la interrumpida después de una dominante.
  const declarado = isMove(mode, antes.degree, paso.degree, paso.move, {
    anterior: proposed[j - 1]?.degree ?? null,
    siguiente: loQueSigue(mode, proposed, j),
    // El cambio rápido solo existe en el 2 de un blues, y eso no se ve en
    // los vecinos: se mira la forma de lo tuyo, como al construirlo.
    compasDelBlues: blues ? i % 12 : null,
    vampDeTonica: esUnVampDeFunk(mode, original, estilo),
  });
  return declarado ? null : 'el movimiento declarado no es el que se ha hecho';
}

function problemaAlRearmonizar(propuesta: Propuesta): string | null {
  const { mode, original, proposed } = propuesta;
  // Por pulsos: cada compás tuyo es uno de la propuesta, o dos si es la dominante
  // partida en su ii y ella (`partir.ts`), que es lo único que cambia cuántos
  // acordes hay sin cambiar los pulsos.
  const grupos = gruposPorPulsos(original, proposed);
  if (grupos === null) {
    return proposed.length !== original.length
      ? 'rearmonizar no cambia el largo'
      : 'rearmonizar no cambia el reparto';
  }
  const blues = esUnBlues(mode, original);
  for (const [i, grupo] of grupos.entries()) {
    const problema = problemaDelCompas(propuesta, i, grupo, blues);
    if (problema !== null) {
      return problema;
    }
  }
  return null;
}

function problemaAlEstirar({ original, proposed }: Propuesta): string | null {
  if (
    proposed.length !== original.length ||
    proposed.some((paso, i) => paso.degree !== original[i]!.degree)
  ) {
    return 'estirar no cambia los acordes';
  }
  // El «es tu canción tal cual» de `pathProblem` ya garantiza que algún pulso cambia.
  return null;
}

function problemaAlSeguir({ mode, original, proposed, estilo }: Propuesta): string | null {
  if (proposed.length <= original.length) {
    return 'seguir tiene que añadir compases';
  }
  if (!sharesTheStart(original, proposed, original.length)) {
    return 'seguir no mantiene tus compases';
  }
  if (!allStepsKnown(mode, proposed, original.length)) {
    return 'un salto que el dominio no conoce';
  }
  // O en el reposo frigio de lo tuyo (`reposoFrigio`): una andaluza que acaba en
  // su V ha llegado, y un flamenco también.
  const frigio = reposoFrigio(
    mode,
    estilo,
    original.map((paso) => paso.degree),
    proposed.map((paso) => paso.degree),
  );
  if (proposed[proposed.length - 1]!.degree !== tonicaDe(mode) && frigio === null) {
    return 'seguir tiene que cerrar en la tónica';
  }
  if (!laParteSeMueve(proposed, original.length)) {
    return 'el cierre no se mueve: es el mismo grado repetido';
  }
  return null;
}

function problemaDelContraste({ mode, original, proposed }: Propuesta): string | null {
  if (proposed.length <= original.length) {
    return 'contraste tiene que añadir una parte';
  }
  if (!sharesTheStart(original, proposed, original.length)) {
    return 'contraste no mantiene tus compases';
  }
  if (!allStepsKnown(mode, proposed, original.length)) {
    return 'un salto que el dominio no conoce';
  }
  const ultimo = proposed[proposed.length - 1]!.degree;
  if (ultimo === tonicaDe(mode)) {
    // Si cierra, es un `seguir`. La diferencia entre las dos salidas es
    // justo esta, y por eso se comprueba: si no, el modelo declararía la que
    // le apeteciera y la etiqueta no querría decir nada.
    return 'contraste no cierra: para eso está seguir';
  }
  if (!canFollow(mode, ultimo, original[0]!.degree)) {
    return 'la parte nueva no sabe volver al principio';
  }
  if (!laParteSeMueve(proposed, original.length)) {
    return 'la parte nueva no se mueve: es el mismo grado repetido';
  }
  return null;
}

function problemaDeOtroFinal({ mode, original, proposed }: Propuesta): string | null {
  // En pulsos y no en compases: un acorde solo no tiene «segunda mitad» en
  // compases, y en pulsos sí —la mitad de su compás—. Con compases regulares es
  // lo mismo que contar compases.
  if (pulsosDe(proposed) > pulsosDe(original)) {
    return 'otro final no alarga: para eso está seguir';
  }
  if (proposed.length < 2) {
    return 'otro final se queda en nada';
  }
  // La mitad de lo tuyo, redondeando hacia arriba, tiene que seguir ahí. Sin
  // ese suelo, «otro final» se convierte en «otra canción» y la etiqueta
  // dejaría de significar nada.
  const mitad = Math.ceil(pulsosDe(original) / 2);
  if (pulsosDe(proposed) < mitad || !suenaIgualHasta(original, proposed, mitad)) {
    return 'otro final no deja en pie la primera mitad';
  }
  // Los saltos que se miran son los que pone la salida, desde el primer compás
  // que cambia: los tuyos de antes no son culpa suya, y pedírselos dejaba sin
  // «otro final» a toda canción que no siguiera el grafo en su segunda mitad.
  const cambia = proposed.findIndex(
    (paso, i) => original[i] === undefined || !sameBar(paso, original[i]!),
  );
  if (!allStepsKnown(mode, proposed, cambia < 0 ? proposed.length : cambia)) {
    return 'un salto que el dominio no conoce';
  }
  return null;
}

/** Lo que pide cada camino, además de lo que piden todos. */
const PROBLEMA_DEL_CAMINO: Readonly<Record<PathId, (propuesta: Propuesta) => string | null>> = {
  rearmonizar: problemaAlRearmonizar,
  estirar: problemaAlEstirar,
  seguir: problemaAlSeguir,
  contraste: problemaDelContraste,
  'otro-final': problemaDeOtroFinal,
};

/**
 * Por qué se ha descartado una salida, o nulo si vale.
 *
 * Devuelve el motivo y no un booleano a propósito: cuando esto rechaza mucho hay
 * que poder saber si es el modelo el que no sabe o el validador el que aprieta de
 * más, y con un `false` no se distingue. El motivo no sale a pantalla —lo que ve
 * quien pregunta es «no ha salido, prueba otra vez»— pero se puede registrar y se
 * puede probar.
 */
export function pathProblem(
  mode: KeyMode,
  path: PathId,
  original: readonly PathStep[],
  proposed: readonly ProposedStep[],
  /** El estilo de la canción: en un flamenco, `seguir` puede reposar en el V. */
  estilo: StyleId | null = null,
): string | null {
  if (proposed.length === 0 || proposed.length > MAX_PATH_STEPS) {
    return 'largo fuera de rango';
  }
  if (
    proposed.some(
      (paso) => !Number.isInteger(paso.beats) || paso.beats < 1 || paso.beats > MAX_BEATS,
    )
  ) {
    return 'pulsos que no son un compás';
  }
  if (
    proposed.length === original.length &&
    original.every((paso, i) => sameBar(paso, proposed[i]!))
  ) {
    return 'es tu canción tal cual';
  }
  return PROBLEMA_DEL_CAMINO[path]({ mode, original, proposed, estilo });
}

/** El grado que suena en cada pulso, hasta `pulsos`. */
function porPulsos(pasos: readonly PathStep[], pulsos: number): DegreeSymbol[] {
  return pasos
    .flatMap((paso) => Array.from({ length: paso.beats }, () => paso.degree))
    .slice(0, pulsos);
}

/** Si dos canciones suenan igual durante sus primeros `pulsos`. */
function suenaIgualHasta(
  original: readonly PathStep[],
  proposed: readonly PathStep[],
  pulsos: number,
): boolean {
  const antes = porPulsos(original, pulsos);
  const ahora = porPulsos(proposed, pulsos);
  return antes.every((grado, i) => ahora[i] === grado);
}

/**
 * Cuántas partes puede tener una canción propuesta.
 *
 * Cuatro. El dominio permite doce en una canción guardada (`song.ts`), pero esto
 * es otra cosa: son partes que hay que leer de un vistazo con la guitarra puesta,
 * y son tokens de salida —de los que salen los cupos de pago—. Con cuatro
 * caben entrada, tu parte, un contraste y un cierre, que es una canción entera.
 */
const MAX_PATH_SECTIONS = 4;

/** Lo más corta que puede ser una parte. Con un acorde no es una parte. */
const MIN_BARS_PER_SECTION = 2;

/**
 * Si esta parte de un compás es **la llegada**: la tónica sola, al final de un
 * `seguir`, después de tu última frase.
 *
 * Es la única parte de un compás que vale, y no vale por cortesía: **es lo que hace
 * un V que se resuelve**. La regla de las dos barras obligaba a toda canción que
 * acababa en V a cerrar con dos compases nuevos, y como la tónica no podía ir dos
 * veces, el primero tenía que ser otra cosa: de 14 tomas que acababan en V, ninguna
 * resolvía a la I, y la primera salida era `V → IV I`. La tónica sostenida se
 * escribe con pulsos —un compás de dieciséis es cuatro de I—, así que lo que la
 * regla quería evitar, un cierre que no se mueve, sigue fuera.
 */
function esLaLlegada(
  mode: KeyMode,
  path: PathId,
  sections: readonly ProposedSection[],
  n: number,
): boolean {
  const parte = sections[n]!;
  return (
    path === 'seguir' &&
    n > 0 &&
    n === sections.length - 1 &&
    !parte.yours &&
    parte.steps.length === 1 &&
    parte.steps[0]!.degree === tonicaDe(mode)
  );
}

/** Lo más largo que puede ser el nombre de una parte. El de `song.ts`. */
const MAX_SECTION_NAME_LENGTH = 30;

/**
 * Las salidas que devuelven una canción con partes, y no una sola progresión.
 *
 * `rearmonizar`, `estirar` y `otro-final` trabajan sobre tus compases y salen en
 * una sola parte: no hay canción que montar, hay una progresión que retocar. Las
 * otras dos **continúan** lo que llevas, y ahí es donde tiene sentido que la
 * respuesta traiga entrada, estribillo o puente con su nombre.
 */
const WITH_SECTIONS: readonly PathId[] = ['seguir', 'contraste'];

export function hasSections(path: PathId): boolean {
  return WITH_SECTIONS.includes(path);
}

/**
 * Por qué se descarta una canción propuesta, o nulo si vale.
 *
 * Encima de lo que ya comprobaba `pathProblem` —que no cambia—, esto añade
 * lo que solo se puede mirar cuando la respuesta viene por partes: que haya una y
 * solo una que sea la tuya, que vaya la primera, y que las demás tengan nombre y
 * tamaño de parte.
 *
 * **Tu parte va primera y va intacta.** Es lo que separa «te ayudo a continuar lo
 * que llevas» de «te escribo una canción»: si tu material se pudiera mover o
 * retocar, lo que vuelve ya no es la continuación de nada.
 *
 * Lo demás se delega: pegadas una detrás de otra, las partes son la progresión
 * que ya se sabía verificar —los saltos en el grafo, el cierre en la tónica, el
 * contraste que sabe volver—, así que no hay reglas nuevas que puedan
 * contradecir a las viejas.
 */
export function songProblem(
  mode: KeyMode,
  path: PathId,
  original: readonly PathStep[],
  sections: readonly ProposedSection[],
  estilo: StyleId | null = null,
): string | null {
  if (sections.length === 0 || sections.length > MAX_PATH_SECTIONS) {
    return 'número de partes fuera de rango';
  }
  for (const [n, section] of sections.entries()) {
    if (section.name.trim() === '' || section.name.length > MAX_SECTION_NAME_LENGTH) {
      return 'una parte sin nombre, o con un nombre larguísimo';
    }
    // El mínimo es de lo que se **añade**: tu parte es la que tocaste, y si es un
    // acorde, es un acorde —con un compás se puede seguir y se puede estirar—; y al
    // retocar, la única parte es tu canción entera. Pedírselo a las dos dejaba a
    // toda canción de un acorde sin una sola salida.
    const nueva = hasSections(path) && !section.yours;
    if (
      nueva &&
      section.steps.length < MIN_BARS_PER_SECTION &&
      !esLaLlegada(mode, path, sections, n)
    ) {
      return 'una parte de un solo compás no es una parte';
    }
  }

  if (!hasSections(path)) {
    if (sections.length !== 1) {
      return 'esta salida retoca tus compases: va en una sola parte';
    }
  } else {
    const ours = sections.filter((s) => s.yours);
    if (ours.length !== 1) {
      return 'hace falta una parte yours, y solo una';
    }
    if (!sections[0]!.yours) {
      return 'tu parte va la primera: lo demás es lo que sigue';
    }
    if (sections.length < 2) {
      return 'continuar pide al menos una parte más que la yours';
    }
    const yours = sections[0]!;
    if (
      yours.steps.length !== original.length ||
      yours.steps.some(
        (paso, i) => paso.degree !== original[i]!.degree || paso.beats !== original[i]!.beats,
      )
    ) {
      return 'tu parte no es la que tocaste';
    }

    // Y al menos una parte nueva tiene que aportar algo. Visto con un modelo de
    // verdad: un «puente» que era tu progresión copiada tal cual. Pasaba todas las
    // reglas —los saltos existen, no cierra, sabe volver— y no era una parte
    // nueva, era la tuya con otro nombre. Repetir vale en una canción; devolver
    // solo repeticiones no es continuar nada.
    const addsSomething = sections
      .slice(1)
      .some(
        (parte) =>
          parte.steps.length !== original.length ||
          parte.steps.some(
            (paso, i) => paso.degree !== original[i]!.degree || paso.beats !== original[i]!.beats,
          ),
      );
    if (!addsSomething) {
      return 'las partes nuevas son tu parte otra vez';
    }
  }

  return pathProblem(
    mode,
    path,
    original,
    sections.flatMap((s) => s.steps),
    estilo,
  );
}

export function pulsosDe(pasos: readonly PathStep[]): number {
  return pasos.reduce((total, paso) => total + paso.beats, 0);
}

/**
 * Si lo tuyo es un coro de blues: doce compases iguales con la forma del blues
 * (`formaDeBlues`, la misma vara que el juez). Con eso la frase mide doce y no
 * cuatro, y lo que sigue es otro coro: una cadencia de dos compases detrás de un
 * blues rompe la forma, que es lo que hacía antes.
 */
export function esUnBlues(mode: KeyMode, original: readonly PathStep[]): boolean {
  return (
    original.length === 12 &&
    original.every((paso) => paso.beats === original[0]!.beats) &&
    formaDeBlues(mode, (compas) => original[compas]?.degree)
  );
}

/**
 * Si lo tuyo es **un vamp sobre la tónica en un funk**: la tónica y su cuarto grado,
 * nada más, con la tónica delante. Es donde vale el giro del vamp (`vaiven`); lo usan
 * quien construye y quien valida, con la misma vara.
 */
export function esUnVampDeFunk(
  mode: KeyMode,
  original: readonly PathStep[],
  estilo: StyleId | null,
): boolean {
  const tonica: DegreeSymbol = mode === 'major' ? 'I' : 'i';
  const cuarto: DegreeSymbol = mode === 'major' ? 'IV' : 'iv';
  return (
    estilo === 'funk' &&
    original.length >= 2 &&
    original[0]!.degree === tonica &&
    original.every((paso) => paso.degree === tonica || paso.degree === cuarto)
  );
}
