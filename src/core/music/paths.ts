/**
 * Las salidas: por dónde puede tirar lo que llevas tocado.
 *
 * Esto sustituye a lo que antes era «versiones de tu canción», y el cambio no es
 * de nombre. Aquello devolvía **la misma canción con dos o tres acordes
 * cambiados**: mismo número de compases, mismos pulsos, mismo orden, y cada
 * compás que cambiaba tenía que ser uno de los cinco movimientos de
 * `reharmonization.ts` aplicado al que había. Servía para rearmonizar y no servía
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

import {
  degreesFor,
  gradosDeLaEscala,
  resolveDegree,
  saltosDeSalidas,
  type DegreeMove,
  type DegreeSymbol,
} from './progressions';
import {
  applyMove,
  destinosDelMovimiento,
  especieDelMovimiento,
  isMove,
  MOVES,
  nombreDelCambio,
  type Entorno,
  type Move,
  type MoveId,
} from './reharmonization';
import {
  esSeventhQuality,
  notasDeEspecieSimple,
  seventhNotes,
  type EspecieDeBloque,
  type SeventhQuality,
} from './chords';
import { SIN_CONTEXTO, type ContextoDeSalidas, type NotaDelCompas } from './contexto-de-salidas';
import {
  bluesAMedias,
  bVIIDeLaCasa,
  cadenciaPropia,
  encaje,
  esUnaBajada,
  sensibleDelCentro,
  ENCAJE_MINIMO,
  formaDeBlues,
  pulsosHabituales,
  PARTE_QUE_SIGUE,
  vivePrestado,
  type CandidataAJuzgar,
  type Encaje,
  type LoQueSeAnade,
} from './encaje';
import { roleOfDegreeSymbol } from './harmonic-function';
import {
  centroFrigio,
  compasesDe,
  formasDe,
  pasosDelTramo,
  reposoFrigio,
  type LoQueFalta,
} from './formas';
import { esPartirEnIiV, gruposPorPulsos, partirEnIiV } from './partir';
import type { KeyMode } from './keys';
import type { SectionRole } from './song';
import { STYLES, type StyleId } from './styles';

/** Un compás: qué grado suena y cuántos pulsos dura. */
export interface PathStep {
  readonly degree: DegreeSymbol;
  readonly beats: number;
}

/**
 * Lo que propone el modelo para un compás.
 *
 * `move` viene **en crudo, sin validar**, y es a propósito: si quien llama lo
 * normalizara a nulo cuando no lo reconoce, declarar un movimiento inventado en
 * un compás que no cambia se convertiría en «no declaró nada» y pasaría. Aquí se
 * distingue lo que dijo de lo que vale.
 */
export interface ProposedStep extends PathStep {
  readonly move?: unknown;
}

export type PathId = 'rearmonizar' | 'seguir' | 'otro-final' | 'estirar' | 'contraste';

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
 * los cupos de Medio y Pro siguen valiendo. Una salida que doblara el largo
 * doblaría la factura.
 */
export const MAX_PATH_STEPS = 32;

/** Lo más que puede durar un compás. Un tope de gasto, no una regla musical. */
const MAX_BEATS = 16;

/** La tónica del modo, que es donde cierra una canción. */
function tonicOf(mode: KeyMode): DegreeSymbol {
  return mode === 'minor' ? 'i' : 'I';
}

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

function saltosDe(mode: KeyMode, from: DegreeSymbol): readonly DegreeMove[] {
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
function loQueSigue(mode: KeyMode, pasos: readonly PathStep[], i: number): DegreeSymbol | null {
  const siguiente = pasos[i + 1]?.degree;
  if (siguiente !== undefined) {
    return siguiente;
  }
  return pasos[i]!.degree === tonicOf(mode) || i === 0 ? null : pasos[0]!.degree;
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

  switch (path) {
    case 'rearmonizar': {
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
          if (!partido) {
            return 'rearmonizar no cambia el largo';
          }
          continue;
        }
        if (paso.degree === antes.degree) {
          // Declarar un movimiento en un compás que no cambió es describir algo
          // que no se ha hecho. Es la regla de adr/0011, y sigue viva aquí.
          if (paso.move !== null && paso.move !== undefined) {
            return 'declara un movimiento en un compás que no cambia';
          }
        } else if (
          // Con los compases de al lado tal como quedan: el tritono tiene que ir
          // antes de su objetivo y la interrumpida después de una dominante.
          !isMove(mode, antes.degree, paso.degree, paso.move, {
            anterior: proposed[j - 1]?.degree ?? null,
            siguiente: loQueSigue(mode, proposed, j),
            // El cambio rápido solo existe en el 2 de un blues, y eso no se ve en
            // los vecinos: se mira la forma de lo tuyo, como al construirlo.
            compasDelBlues: blues ? i % 12 : null,
            vampDeTonica: esUnVampDeFunk(mode, original, estilo),
          })
        ) {
          return 'el movimiento declarado no es el que se ha hecho';
        }
      }
      return null;
    }

    case 'estirar': {
      if (proposed.length !== original.length) {
        return 'estirar no cambia los acordes';
      }
      if (proposed.some((paso, i) => paso.degree !== original[i]!.degree)) {
        return 'estirar no cambia los acordes';
      }
      // El «es tu canción tal cual» de arriba ya garantiza que algún pulso cambia.
      return null;
    }

    case 'seguir': {
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
      if (proposed[proposed.length - 1]!.degree !== tonicOf(mode) && frigio === null) {
        return 'seguir tiene que cerrar en la tónica';
      }
      if (!laParteSeMueve(proposed, original.length)) {
        return 'el cierre no se mueve: es el mismo grado repetido';
      }
      return null;
    }

    case 'contraste': {
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
      if (ultimo === tonicOf(mode)) {
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

    case 'otro-final': {
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
  }
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

/** Si una salida se sostiene con lo que se tocó. */
/** Una parte de la canción que se propone. */
export interface ProposedSection {
  readonly name: string;
  /** Si esta parte es, tal cual, la que tocaste. */
  readonly yours: boolean;
  readonly steps: readonly ProposedStep[];
}

/**
 * Cuántas partes puede tener una canción propuesta.
 *
 * Cuatro. El dominio permite doce en una canción guardada (`song.ts`), pero esto
 * es otra cosa: son partes que hay que leer de un vistazo con la guitarra puesta,
 * y son tokens de salida —de los que salen los cupos de Medio y Pro—. Con cuatro
 * caben entrada, tu parte, un contraste y un cierre, que es una canción entera.
 */
export const MAX_PATH_SECTIONS = 4;

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
    parte.steps[0]!.degree === tonicOf(mode)
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

/**
 * Las dos cosas que se le pueden pedir, y por qué se elige antes de pedirlas.
 *
 * No es un capricho de interfaz: es lo que hace que el esquema pueda exigir lo
 * que el validador exige. `continuar` necesita al menos dos partes —la tuya y lo
 * que sigue— y `retocar` exactamente una, y eso no se puede poner en un esquema
 * JSON que dependa de un campo que el propio modelo elige. Midiéndolo: con el
 * camino libre, cero salidas válidas de cuatro peticiones; eligiendo antes y
 * exigiendo las dos partes, tres de tres.
 *
 * Y cuesta lo mismo que sin elegir: una llamada.
 */
export type PathKind = 'continuar' | 'retocar';

export const PATHS_BY_KIND: Readonly<Record<PathKind, readonly PathId[]>> = {
  continuar: WITH_SECTIONS,
  retocar: PATHS.map((p) => p.id).filter((id) => !WITH_SECTIONS.includes(id)),
};

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

/**
 * Hacia dónde tira una salida, contado por el dominio.
 *
 * Es lo que deja **elegir con tus directrices** sin que nadie tenga que adivinar:
 * «más triste» no es una regla que el dominio sepa comprobar, pero sí sabe si una
 * salida mete un acorde menor que no estaba. Cada color sale de comparar la
 * salida con lo tuyo, nunca de una etiqueta puesta a mano.
 */
export type Color =
  | 'oscurece'
  | 'aclara'
  | 'tension'
  | 'prestado'
  | 'cierra'
  | 'abierto'
  | 'mas-lento'
  | 'mas-rapido'
  | 'mas-corto'
  | 'cuadra';

/** Un compás de una salida posible, con el movimiento que lo justifica si lo hay. */
export interface PasoPosible extends PathStep {
  readonly move: MoveId | null;
  /**
   * Con qué especie suena —una séptima en un jazz, la del sustituto tritonal—.
   * Ausente o `null` es la tríada del grado; en lo tuyo, la que ya tenía.
   */
  readonly especie?: EspecieDeBloque | null;
}

/** Una parte de una salida posible. */
export interface ParteDeSalida {
  readonly name: string;
  readonly yours: boolean;
  readonly steps: readonly PasoPosible[];
}

/**
 * Una salida que el dominio sabe construir para tu canción, ya montada.
 *
 * **Correcta por construcción**: sale de los mismos movimientos, el mismo grafo y
 * las mismas cadencias que la juzgan, y además se juzga —`songProblem`— antes de
 * entrar en el catálogo. Lo que el modelo pone es el criterio: cuál de estas
 * conviene, con tus directrices delante, y por qué.
 */
export interface SalidaPosible {
  readonly path: PathId;
  /** La canción entera por partes: la tuya delante al continuar, una sola al retocar. */
  readonly secciones: readonly ParteDeSalida[];
  /** Un título que dice lo que es, por si el del modelo no se sostiene. */
  readonly nombre: string;
  /** Lo que hace, en una frase y en grados. Es verdad porque lo escribe quien la construyó. */
  readonly que: string;
  readonly colores: readonly Color[];
  /**
   * Lo que dijo de ella el juez (`encaje.ts`): los puntos que la ordenan y sus
   * motivos, que son hechos de la canción que el porqué puede contar sin
   * inventarse nada. Opcional para que quien monte una a mano no tenga que juzgarla.
   */
  readonly encaje?: Encaje;
}

/** Cuántas salidas posibles se le enseñan al modelo como mucho. */
export const MAX_SALIDAS_POSIBLES = 9;

/**
 * Cuántas tiene que tener el menú como poco, si el dominio sabe construirlas:
 * con menos no hay elección, y elegir es lo que se le pide a quien lo lee. Es
 * también lo que se ve sin desplazar (el `PRIMERAS` del examen).
 */
export const MINIMO_DEL_MENU = 3;

/** Los compases de una frase: lo que mide la parte que se añade de una vez. */
const LARGO_DE_UNA_FRASE = 4;

function pulsosDe(pasos: readonly PathStep[]): number {
  return pasos.reduce((total, paso) => total + paso.beats, 0);
}

// ─── El idioma de tu canción ────────────────────────────────────────────────

/**
 * El peso de una familia que ni suma ni resta: por encima, el estilo la usa más de
 * lo corriente y meterla suma; por debajo, cuesta. Es la mitad de la escala de
 * `STYLES`, que va de 0 —no se usa— a 1 —es lo de casa—.
 */
const PESO_NEUTRO = 0.5;

/**
 * Cuánto pesa cada familia sin estilo elegido: **ni premia ni castiga ningún
 * idioma**, así que el préstamo y la dominante secundaria están justo en el
 * neutro. El sustituto tritonal y el napolitano no: son idiomas con nombre —el
 * jazz, el metal—, y sin estilo que los pida suenan a otro sitio.
 *
 * Con estilo, los pesos salen de `STYLES`, que es la chuleta que ya usan las
 * sugerencias: el bVII pesa en un rock y no en un jazz por lo que dice allí.
 */
const SIN_ESTILO = {
  borrowed: PESO_NEUTRO,
  secondaryDominant: PESO_NEUTRO,
  tritoneSub: 0.2,
  neapolitan: 0.2,
  // El vii° como acorde con nombre propio es de coral y de jazz: sin estilo que lo
  // pida, neutro es no premiar lo raro.
  diminished: 0.2,
};

type Lenguaje = 'triadas' | 'septimas' | 'quintas';

/**
 * Lo que se sabe de tu canción además de sus grados, ya pensado para elegir qué
 * giros probar: los pesos de su estilo, el modo en que se mueve y lo que mide una
 * frase.
 */
interface Idioma {
  readonly mode: KeyMode;
  readonly tonica: DegreeSymbol;
  readonly estilo: StyleId | null;
  /** De 0 a 1, de la chuleta de estilos. */
  readonly prestamo: number;
  readonly secundaria: number;
  readonly tritono: number;
  readonly napolitano: number;
  /** Cuánto usa el estilo los disminuidos: el vii° como cadencia es suyo o es raro. */
  readonly disminuido: number;
  readonly tuyos: ReadonlySet<DegreeSymbol>;
  /** Mayor con bVII y sin V: la sensible le quitaría el modo. */
  readonly mixolidio: boolean;
  /**
   * Por dónde llega a casa tu canción cuando no es por la dominante: el VII de un
   * menor natural o el iv de una de cine (`cadenciaPropia`, la vara del juez).
   * Cerrar como ella es lo fuerte, y el V con sensible, un color que se trae.
   */
  readonly cadenciaPropia: DegreeSymbol | null;
  /**
   * Las llegadas **sin sensible** que tu canción eligió en lugar del V, la primera
   * la tuya: el bVII de un riff mixolidio, la v de un folk eólico, el bII de un
   * metal frigio —y en menor, el VII, que es la otra—. Vacío si tocas el V o no
   * elegiste ninguna. Es lo que dice que el V es de otro idioma (`precioDelGrado`).
   */
  readonly modales: readonly DegreeSymbol[];
  /** Con qué especie tocas cada grado: lo nuevo del mismo grado suena igual. */
  readonly especieDelGrado: ReadonlyMap<DegreeSymbol, EspecieDeBloque | null>;
  /** Vive de dominantes secundarias, sin bVII: un bolero, un estándar. */
  readonly funcional: boolean;
  /** Vive de la mezcla con el menor: lo prestado es más de la mitad de lo suyo (`vivePrestado`). */
  readonly mezcla: boolean;
  /**
   * Los dos acordes con los que lo tuyo llega a casa (`suLlegada`), el de antes nulo
   * si no lo hay. Nulo si no llega de ninguna manera.
   */
  readonly suLlegada: { readonly antes: DegreeSymbol | null; readonly llega: DegreeSymbol } | null;
  /**
   * Un vaivén de dos acordes que no gira alrededor de la tónica: su centro es otro.
   * **Salvo que el papel pida llegar**: un pre, un puente o un final en `VI VII VI
   * VII` preparan la tónica, no viven en otro modo (lo encontró el quinto examen: lo
   * que seguía a un pre así nunca caía en la i). Entonces está en `vaiven`.
   */
  readonly centroModal: DegreeSymbol | null;
  /** Los dos acordes de lo tuyo si es un vaivén que no pasa por la tónica, sea cual sea su papel. */
  readonly vaiven: readonly DegreeSymbol[] | null;
  /** Con qué especie suena lo tuyo: lo nuevo habla igual. */
  readonly lenguaje: Lenguaje;
  /**
   * Si tu tónica o tu subdominante suenan con séptima de dominante: el idioma del
   * funk, del soul, del gospel y del blues aunque no se haya elegido el estilo. Lo
   * nuevo habla igual —un IV7, no un IVmaj7— (`especieNueva`).
   */
  readonly dominantes: boolean;
  readonly papel: SectionRole;
  /** Los pulsos de un compás nuevo. */
  readonly pulsos: number;
  /** Los pulsos de un compás de verdad. */
  readonly compas: number;
  /** Los pulsos de una frase: cuatro compases, o el coro entero de un blues. */
  readonly frase: number;
  /** Si lo tuyo es un coro de blues de doce compases. */
  readonly blues: boolean;
  readonly dudosos: readonly boolean[];
  /**
   * Los grados tuyos que **solo** se oyeron con duda, cuando lo demás se oyó bien:
   * lo nuevo no se apoya en ellos (`precioDelGrado`).
   */
  readonly soloConDuda: ReadonlySet<DegreeSymbol>;
  /** Si la mitad o más de lo tuyo se oyó con duda: lo nuevo, sin color. */
  readonly tomaDudosa: boolean;
  readonly melodia: readonly (readonly NotaDelCompas[])[];
  readonly especies: readonly (EspecieDeBloque | null)[];
}

/**
 * Si lo tuyo es un coro de blues: doce compases iguales con la forma del blues
 * (`formaDeBlues`, la misma vara que el juez). Con eso la frase mide doce y no
 * cuatro, y lo que sigue es otro coro: una cadencia de dos compases detrás de un
 * blues rompe la forma, que es lo que hacía antes.
 */
function esUnBlues(mode: KeyMode, original: readonly PathStep[]): boolean {
  return (
    original.length === 12 &&
    original.every((paso) => paso.beats === original[0]!.beats) &&
    formaDeBlues(mode, (compas) => original[compas]?.degree)
  );
}

/**
 * El centro de un vaivén de dos acordes, si no es la tónica.
 *
 * `ii V ii V` en Do mayor es Re dórico escrito en Do: cerrarlo en Do se carga el
 * modo. Se reconoce por la forma —dos grados que se alternan, cuatro compases o
 * más— y por dónde empieza.
 */
function centroDelVaiven(original: readonly PathStep[], tonica: DegreeSymbol): DegreeSymbol | null {
  const grados = original.map((paso) => paso.degree);
  if (
    grados.length < 4 ||
    new Set(grados).size !== 2 ||
    grados.some((grado, i) => i > 0 && grado === grados[i - 1])
  ) {
    return null;
  }
  return grados[0] === tonica ? null : grados[0]!;
}

/**
 * Lo que dura un acorde de lo tuyo, para lo que se le añade.
 *
 * Es `pulsosHabituales`, la vara del juez, **salvo con una toma regular**: si
 * todos tus acordes duran lo mismo y eso cabe en el compás —un pulso, medio
 * compás, uno entero o varios—, ese es tu ritmo armónico. Un riff `I IV V I` a un
 * pulso es un compás con cuatro acordes, no una toma desigual: la rejilla del juez
 * no tiene el pulso suelto y lo redondeaba a dos, y entonces todo lo nuevo iba a
 * la mitad de velocidad y «estirar» lo cuadraba como si se hubiera tocado mal.
 */
function pulsosDeTuRitmo(original: readonly PathStep[], compas: number): number {
  const primero = original[0]!.beats;
  const regular = original.every((paso) => paso.beats === primero);
  const cabe = compas % primero === 0 || (primero % compas === 0 && primero <= MAX_BEATS);
  return regular && cabe ? primero : pulsosHabituales(original, compas);
}

/**
 * Los pulsos de una frase de tu canción: cuatro compases, **o los que mida tu
 * forma si es regular y no es de cuatro**.
 *
 * `I IV V | vi IV V` son dos frases de tres compases que acaban igual: es una
 * forma, no una de cuatro mal contada, y completarla a ocho o quitarle dos para
 * dejarla en cuatro le rompía el periodo. Se reconoce por eso, porque se parte en
 * trozos iguales de tres, cinco, seis o siete compases que **acaban con los mismos
 * dos acordes** —la cadencia que hace de frase—. Y en un blues que no es de doce, el coro entero:
 * lo que sigue a un blues de ocho es otro coro de ocho, no una frase de cuatro.
 */
function fraseDeTuForma(
  original: readonly PathStep[],
  compas: number,
  estilo: StyleId | null,
  tonica: DegreeSymbol,
): number {
  const total = pulsosDe(original);
  const compases = total / compas;
  if (
    estilo === 'blues' &&
    [8, 16].includes(compases) &&
    original[0]!.degree === tonica &&
    original.every((paso) => paso.beats % compas === 0)
  ) {
    return total;
  }
  if (!Number.isInteger(compases) || compases % 4 === 0) {
    return 4 * compas;
  }
  // Dónde empieza cada acorde, para partir por compases y no por acordes.
  const inicios: number[] = [];
  let pulso = 0;
  for (const paso of original) {
    inicios.push(pulso);
    pulso += paso.beats;
  }
  // La cadencia de cada trozo: sus dos últimos acordes. Con uno solo, cualquier
  // paseo que pasara dos veces por el mismo acorde parecía una forma.
  const cadenciaAntesDe = (pulsoDelCorte: number): string | null => {
    const i = pulsoDelCorte === total ? original.length : inicios.indexOf(pulsoDelCorte);
    return i < 2 ? null : `${original[i - 2]!.degree} ${original[i - 1]!.degree}`;
  };
  for (const largo of [3, 5, 6, 7]) {
    if (compases % largo !== 0 || compases / largo < 2) {
      continue;
    }
    const cadencias = Array.from({ length: compases / largo }, (_, n) =>
      cadenciaAntesDe((n + 1) * largo * compas),
    );
    if (cadencias.every((cadencia) => cadencia !== null && cadencia === cadencias[0])) {
      return largo * compas;
    }
  }
  return 4 * compas;
}

/**
 * Las llegadas sin sensible que eligió tu canción, si no toca el V (`Idioma.modales`).
 * En menor, la v o el bII —lo que tocas— y el VII, que también llega sin sensible.
 *
 * **La v cuenta con el VII al lado, como en el juez** (`modalDe`). Sola es un
 * acorde de paso del menor natural —`i v VI III` baja por ella—, no una elección:
 * el arreglista cierra esa bajada con `iv V i`, y aquí el V costaba lo que cuesta
 * meter la sensible en un modo que la ha quitado. El bII sí elige solo: es el
 * semitono frigio que hace de dominante.
 */
function llegadasModales(
  mode: KeyMode,
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
): DegreeSymbol[] {
  const tuyos = new Set(original.map((paso) => paso.degree));
  // Y elegir es no tenerla en ningún sitio, como mira el juez (`modalDe`): el Imaj7
  // de un jazz la lleva dentro, y su bVII7 es la puerta de atrás, no un mixolidio.
  const laTiene = original.some(
    (paso, i) =>
      paso.degree.includes('/') || notasDelAcorde(mode, paso.degree, especies[i] ?? null).has(11),
  );
  if (tuyos.has('V') || laTiene) {
    return [];
  }
  if (mode === 'major') {
    return tuyos.has('bVII') ? ['bVII'] : [];
  }
  const elegidas = (['v', 'bII'] as const).filter(
    (grado) => tuyos.has(grado) && (grado === 'bII' || tuyos.has('VII')),
  );
  return elegidas.length === 0 ? [] : [...elegidas, 'VII'];
}

/**
 * Si tu canción **habla en funcional** (`Idioma.funcional`): llega por la dominante
 * y la prepara, sin el bVII ni el VII que cierran sin ella.
 *
 * Lo dicen dos cosas. **Las dominantes secundarias**, que es de lo que vive un
 * bolero o un estándar. **Y la célula ii–V**: la `ii° V` del menor, que es la
 * cadencia de manual, y la `ii V` en cuatríadas —con el V7—, que es el R&B y el
 * jazz aunque no se haya dicho el estilo. Antes solo contaban las secundarias, y a
 * un `Imaj7 vi7 ii7 V7` sin estilo le salía de segunda el `bVII I` del rock. En
 * tríadas el `ii V` del pop no dice tanto, y no cuenta. El idioma de dominantes de
 * un blues o un funk tampoco: allí el bVII7 es de la casa.
 */
function hablaEnFuncional(
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
  lenguaje: Lenguaje,
  tuyos: ReadonlySet<DegreeSymbol>,
): boolean {
  if (tuyos.has('bVII') || tuyos.has('VII')) {
    return false;
  }
  const celda = original.some((paso, i) => {
    const siguiente = original[i + 1];
    if (siguiente?.degree !== 'V') {
      return false;
    }
    return (
      paso.degree === 'ii°' ||
      (paso.degree === 'ii' && lenguaje === 'septimas' && especies[i + 1] === 'dominant7')
    );
  });
  return celda || [...tuyos].some((grado) => grado.includes('/'));
}

/**
 * Cómo llega lo tuyo a casa: los dos acordes distintos de antes de tu tónica final
 * o, si lo tuyo es un bucle que empieza en la tónica y acaba fuera, los dos últimos,
 * que llevan de vuelta al principio. Es lo que el juez llama `tuLlegada`.
 */
function suLlegada(
  tonica: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): { antes: DegreeSymbol | null; llega: DegreeSymbol } | null {
  const distintoAntes = (i: number) => {
    let k = i - 1;
    while (k >= 0 && grados[k] === grados[i]) {
      k -= 1;
    }
    return grados[k] ?? null;
  };
  const ultimo = grados.length - 1;
  if (grados[ultimo] !== tonica) {
    return grados[0] === tonica ? { antes: distintoAntes(ultimo), llega: grados[ultimo]! } : null;
  }
  let desde = ultimo;
  while (desde > 0 && grados[desde - 1] === tonica) {
    desde -= 1;
  }
  return desde === 0 ? null : { antes: distintoAntes(desde - 1), llega: grados[desde - 1]! };
}

/**
 * La especie con la que tocas cada grado: la que más veces, y a igualdad, **la que
 * no retiene**: un suspendido es una retención que resuelve, y lo nuevo del mismo
 * grado suena como su resolución. Antes, a igualdad, la primera: el `V(sus4) V` de un
 * rock daba a todo V nuevo un sus4, y un otro final acababa en la retención sin
 * resolverla. Entre las demás, la primera.
 */
function especiesPorGrado(
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
): Map<DegreeSymbol, EspecieDeBloque | null> {
  const cuentas = new Map<DegreeSymbol, Map<EspecieDeBloque | null, number>>();
  original.forEach((paso, i) => {
    const delGrado = cuentas.get(paso.degree) ?? new Map<EspecieDeBloque | null, number>();
    const especie = especies[i] ?? null;
    delGrado.set(especie, (delGrado.get(especie) ?? 0) + 1);
    cuentas.set(paso.degree, delGrado);
  });
  return new Map(
    [...cuentas].map(([grado, delGrado]) => {
      const mas = Math.max(...delGrado.values());
      const empatadas = [...delGrado].filter(([, veces]) => veces === mas);
      const resuelta = empatadas.find(([especie]) => especie !== 'sus2' && especie !== 'sus4');
      return [grado, (resuelta ?? empatadas[0]!)[0]];
    }),
  );
}

/**
 * Cuánto usa el estilo el bII **en este modo**: lo que dice `STYLES`, salvo el
 * flamenco en mayor. Su bII es el semitono frigio, el de un menor o del modo de Mi;
 * una rumba en mayor —`I IV I V`— no lo tiene, y el arreglista lo tachó. Lo mismo
 * mira el juez (`pesosDelEstilo`, en `encaje.ts`).
 */
function napolitanoDe(mode: KeyMode, estilo: StyleId | null, peso: number): number {
  return estilo === 'flamenco' && mode === 'major' ? 0 : peso;
}

function idiomaDe(
  mode: KeyMode,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas,
): Idioma {
  const estilo = contexto.estilo ?? null;
  const pesos = estilo === null ? SIN_ESTILO : STYLES[estilo].weights;
  const tonica = tonicOf(mode);
  const tuyos = new Set(original.map((paso) => paso.degree));
  // Sin compás dicho, cuatro por cuatro: lo mismo que supone el juez, que mide las
  // frases con la misma vara. Si cada uno contara los compases a su manera, lo que
  // aquí cuadra allí saldría cojo.
  const pedido = contexto.pulsosPorCompas;
  const compas =
    pedido !== undefined && Number.isInteger(pedido) && pedido >= 1 && pedido <= MAX_BEATS
      ? pedido
      : 4;
  const pulsos = pulsosDeTuRitmo(original, compas);
  const blues = esUnBlues(mode, original);
  const especies = contexto.especies ?? [];
  const mitad = original.length / 2;
  const lenguaje: Lenguaje =
    especies.filter(esSeventhQuality).length > mitad
      ? 'septimas'
      : especies.filter((especie) => especie === 'quinta').length > mitad
        ? 'quintas'
        : estilo !== null && FUNCIONALES.has(estilo)
          ? 'septimas'
          : 'triadas';
  // El préstamo, lo que diga el estilo, **sin rebajarlo por no haber estilo**: eso
  // dejaba el pop y la canción sin estilo sin uno solo en el menú, ni el `IV iv I`
  // que es de manual.
  const prestamo = pesos.borrowed;
  // Sin especies dichas no se sabe cómo suena lo tuyo, y no se copia nada.
  const especieDelGrado =
    contexto.especies === undefined
      ? new Map<DegreeSymbol, EspecieDeBloque | null>()
      : especiesPorGrado(original, especies);
  // Lo que más suena en el grado, no una vez: el I7 de paso del gospel, `I I7 IV`,
  // es la dominante del IV, no el idioma de la canción.
  const dominantes = ([tonica, mode === 'major' ? 'IV' : 'iv'] as const).some(
    (grado) => especieDelGrado.get(grado) === 'dominant7',
  );
  const funcional = hablaEnFuncional(original, especies, lenguaje, tuyos) && !dominantes;
  const dudosos = contexto.dudosos ?? [];
  const conDuda = original.filter((_, i) => dudosos[i] === true).length;
  const ciertos = new Set(original.filter((_, i) => dudosos[i] !== true).map((p) => p.degree));
  const soloConDuda = new Set(
    [...tuyos].filter((grado) => !ciertos.has(grado) && grado !== tonica),
  );
  return {
    mode,
    tonica,
    estilo,
    prestamo,
    secundaria: pesos.secondaryDominant,
    tritono: funcional && estilo === null ? PESO_NEUTRO : pesos.tritoneSub,
    napolitano: napolitanoDe(mode, estilo, pesos.neapolitan),
    disminuido: pesos.diminished,
    tuyos,
    mixolidio: mode === 'major' && tuyos.has('bVII') && !tuyos.has('V'),
    modales: llegadasModales(mode, original, especies),
    cadenciaPropia: cadenciaPropia(
      mode,
      original.map((paso) => paso.degree),
    ),
    especieDelGrado,
    funcional,
    mezcla: vivePrestado(
      mode,
      original.map((paso) => paso.degree),
    ),
    suLlegada: suLlegada(
      tonica,
      original.map((paso) => paso.degree),
    ),
    centroModal: PIDEN_LLEGADA.has(contexto.papel ?? 'idea')
      ? null
      : centroDelVaiven(original, tonica),
    vaiven:
      centroDelVaiven(original, tonica) === null
        ? null
        : [original[0]!.degree, original[1]!.degree],
    lenguaje,
    dominantes,
    papel: contexto.papel ?? 'idea',
    pulsos,
    compas,
    frase: blues ? pulsosDe(original) : fraseDeTuForma(original, compas, estilo, tonica),
    blues,
    dudosos,
    soloConDuda,
    tomaDudosa: conDuda > 0 && conDuda * 2 >= original.length,
    melodia: contexto.melodia ?? [],
    especies,
  };
}

// ─── Lo que vale cada giro ──────────────────────────────────────────────────

/** Si un grado viene de fuera de la escala: prestado del otro modo, o napolitano. */
function esPrestado(mode: KeyMode, degree: DegreeSymbol): boolean {
  return mode === 'major' ? degree.startsWith('b') || degree === 'iv' : degree === 'bII';
}

/**
 * Lo que cuesta, o lo que suma, meter un grado que no estaba en lo tuyo.
 *
 * **Es lo que hace que el color dependa del estilo**, y con la misma vara para el
 * préstamo que para la dominante secundaria: el peso de `STYLES` contra el neutro.
 * Antes el desempate premiaba la novedad, y lo más nuevo siempre era lo prestado:
 * el 87 % de los puentes en mayor llevaban iv, bVII o bVI, también en un jazz, un
 * folk o un bolero. Se corrigió haciendo que el préstamo **siempre** costara —lo
 * máximo que podía valer era cero— mientras la secundaria sumaba por encima de
 * 0,4: el pop se quedó sin un préstamo y con secundarias en el 87 % del menú.
 * Ahora cuesta lo que el estilo no lo usa, suma lo que lo usa, y lo que ya tocas
 * no cuesta nada: si tu canción ya habla con el bVII, seguir con él es tu idioma.
 */
/**
 * Del peso de una familia en el estilo a lo que suma o cuesta meterla. **Suma un
 * sexto de lo que cuesta**: que un estilo admita un color no quiere decir que lo
 * busque —un rock sigue siendo sobre todo tríadas de la escala—. Con la misma
 * pendiente a los dos lados el rock acababa con un préstamo en nueve de cada diez
 * salidas, que es el 87 % de antes con otro nombre; así queda en seis de cada
 * diez, el metal en siete, y el pop, el folk y la canción sin estilo entre dos y
 * tres, que es el orden de `STYLES`.
 */
function precioDelPeso(peso: number): number {
  const distancia = peso - PESO_NEUTRO;
  return distancia * (distancia > 0 ? 0.2 : 1.2);
}

function precioDelGrado(id: Idioma, degree: DegreeSymbol): number {
  // Lo que trae la sensible en una canción que eligió no tenerla: el V, y también
  // el vii°, el iii de mayor y cualquier dominante secundaria, que lleva la de su
  // destino. Va antes que lo tuyo: que la toques una vez de paso no quiere decir
  // que lo nuevo pueda volver a meterla. Es lo mismo que mira el juez.
  if (id.modales.length > 0 && traeLaSensible(id.mode, degree)) {
    return -3;
  }
  // Lo tuyo que solo se oyó con duda no es tuyo todavía: volver a apoyarse en ello es
  // construir sobre algo que no se sabe (el arreglista lo tachó en `I iii? vi IV`).
  // Si toda la toma es dudosa, no hay nada seguro que preferir, y no cuenta.
  if (!id.tomaDudosa && id.soloConDuda.has(degree)) {
    return PRECIO_DE_OTRO_IDIOMA;
  }
  if (id.tuyos.has(degree)) {
    return 0;
  }
  if (esDeOtraCasa(id, degree)) {
    return PRECIO_DE_OTRO_IDIOMA;
  }
  // Y el V con su sensible en una canción que llega a casa por su color
  // (`Idioma.cadenciaPropia`): cabe, pero suena a otra música —«a todo trapo», dijo
  // el arreglista de un reggae—, y cuesta lo que una familia que tu estilo no usa. En
  // quintas no lleva tercera, y no trae nada.
  if (degree === 'V' && id.cadenciaPropia !== null && id.lenguaje !== 'quintas') {
    return precioDelPeso(0);
  }
  if (degree.includes('/')) {
    // En quintas no hay dominante secundaria: sin tercera ni séptima, un D5 en Do es
    // el ii con otro nombre. Que no se meta.
    if (id.lenguaje === 'quintas') {
      return -3;
    }
    // Y la que trae **dos notas de fuera** de la escala ya no es un color: es otro
    // tono. En mayor es la del iii —el Si7 en Do, con su Re# y su Fa#—, la más lejana
    // de las cuatro y la que el arreglista tachó en un pop, un funk y uno de cine;
    // las demás traen una. Fuera del jazz y del bolero, que viven de cadenas de
    // dominantes, cuesta lo que una familia que el estilo no usa.
    const lejana = id.mode === 'major' && notasDeFuera(degree) >= 2 && !esFuncional(id);
    return lejana ? precioDelPeso(0) + precioDelPeso(id.secundaria) : precioDelPeso(id.secundaria);
  }
  if (degree === 'bII') {
    return -(1 - Math.max(id.tritono, id.napolitano)) * 1.2;
  }
  if (esPrestado(id.mode, degree)) {
    return precioDelPeso(id.prestamo);
  }
  if (degree === 'v' && id.tuyos.has('V')) {
    return -1.5;
  }
  // El vii° suelto es de coral y de jazz: lo que cueste lo dice el peso de los
  // disminuidos en el estilo. El ii° del menor es la subdominante de siempre…
  if (degree === 'vii°') {
    return Math.min(-0.3, precioDelPeso(id.disminuido));
  }
  return degree === 'ii°' ? -0.3 : 0;
}

/** Las notas de la escala de cada modo, en semitonos sobre la tónica. */
const ESCALA_DEL_MODO: Readonly<Record<KeyMode, ReadonlySet<number>>> = {
  major: new Set([0, 2, 4, 5, 7, 9, 11]),
  minor: new Set([0, 2, 3, 5, 7, 8, 10]),
};

/**
 * Si la quinta de un grado —su fundamental y su quinta, sin tercera— cae entera en
 * la escala: entonces, en quintas, ese grado suena igual que el de la escala con
 * la misma fundamental, y lo que lo hacía prestado era la tercera que no lleva.
 */
function quintaDeLaEscala(mode: KeyMode, degree: DegreeSymbol): boolean {
  const { root } = resolveDegree(0, mode, degree);
  return ESCALA_DEL_MODO[mode].has(root) && ESCALA_DEL_MODO[mode].has((root + 7) % 12);
}

/** Cuántas notas de un grado en mayor caen fuera de la escala mayor. */
function notasDeFuera(degree: DegreeSymbol): number {
  const escala = new Set([0, 2, 4, 5, 7, 9, 11]);
  return resolveDegree(0, 'major', degree).notes.filter((nota) => !escala.has(nota)).length;
}

/**
 * Si un grado que no tocas es **de otra casa** que la de tu canción, aunque el estilo
 * lo admita (`PRECIO_DE_OTRO_IDIOMA`). Cada una es la casa de un idioma que lo tuyo
 * ya ha elegido:
 *
 * - **Funcional** (`Idioma.funcional`): el bVII, el VII y los demás grados de la
 *   mezcla con el otro modo —el bIII, el bVI—. El color de un bolero o de una cadena
 *   de secundarias es la dominante que llega, no la escalera del rock, y el
 *   arreglista los tachó en las dos. El iv no: el `IV iv I` es cadencia de gospel,
 *   de soul y de jazz.
 * - **De dominantes**, el de un blues o un funk (`deOtraGama`).
 * - **De la mezcla con el menor** (`Idioma.mezcla`): la dominante secundaria y el ii
 *   que prepara el V, que son la casa del mayor de manual, y el iii y el vi, que en
 *   esa mezcla suenan con su gemelo prestado —el bIII, el bVI—. El arreglista no dio
 *   ni uno en las tres de cine, y tachó los primeros.
 * - **Un folk que no toca préstamos oscuros** (`oscuroDeOtraCasa`).
 * - **Un menor sin sensible**: la ii° en tríada (`laIiEsDeCasa`).
 * - **Una toma que se oyó con duda** (`Idioma.tomaDudosa`): todo color —un préstamo,
 *   una secundaria, el napolitano, el vii°—. Sobre lo que no se sabe, lo seguro: los
 *   acordes de la escala valen para lo que fuera que sonó.
 * - **Un vamp modal** (`Idioma.centroModal`): lo que trae la sensible de su centro
 *   —el A7 en un dórico sobre Re—, que lo vuelve un menor de manual. La misma vara
 *   del juez (`sensibleDelCentro`).
 */
function esDeOtraCasa(id: Idioma, degree: DegreeSymbol): boolean {
  return (
    (id.funcional && MEZCLA.has(degree)) ||
    deOtraGama(id, degree) ||
    (id.mezcla && (degree.includes('/') || ['ii', 'iii', 'vi'].includes(degree))) ||
    (esPrestado(id.mode, degree) && oscuroDeOtraCasa(id, degree)) ||
    (degree === 'ii°' && !laIiEsDeCasa(id)) ||
    (id.tomaDudosa && (degree === 'vii°' || colorDelGrado(id.mode, degree, null) !== null)) ||
    traeLaSensibleDelCentro(id, degree)
  );
}

/**
 * Si un grado trae **la sensible del centro de tu vamp modal**, y tu vamp no la tenía:
 * el A7 en un dórico sobre Re (`sensibleDelCentro`, la vara del juez). Si alguno de
 * tus acordes ya la lleva, es tuya.
 */
function traeLaSensibleDelCentro(id: Idioma, degree: DegreeSymbol): boolean {
  if (id.centroModal === null) {
    return false;
  }
  const suya = sensibleDelCentro(id.mode, id.centroModal);
  const laTenia = [...id.tuyos].some((grado) => notasDelAcorde(id.mode, grado, null).has(suya));
  return !laTenia && notasDelAcorde(id.mode, degree, null).has(suya);
}

/**
 * Si la ii° es de tu menor: la subdominante que va al V con sensible, `ii° V i`.
 *
 * Es la del menor armónico, y en tríada **solo suena a casa donde está el V**: en
 * un menor natural —`i VI III VII`, un vaivén `i VII`, `i v VI III`— una tríada
 * disminuida es un acorde de coral metido en una canción que eligió no tener
 * sensible. El arreglista la tachó en seis menús de cine, funk, reggae, pop y
 * cantautor, y la pidió en los tres que ya tocaban el V: cambiar el iv por la ii°
 * delante de él es el cambio de casa del menor. Con séptima es otra cosa: la iiø7
 * es la del jazz y del bolero, y ahí se toca con cualquier dominante.
 */
function laIiEsDeCasa(id: Idioma): boolean {
  return id.tuyos.has('V') || id.tuyos.has('ii°') || id.lenguaje === 'septimas' || id.dominantes;
}

/**
 * Si cambiar un acorde tuyo con séptima de dominante por ese grado **le quita la
 * gama** al idioma de dominantes: el IV7 de un funk cambiado por su relativo, el ii7,
 * pierde la séptima —el Mib en Do, la tercera de blues de la tonalidad— que es lo
 * que hace sonar el funk a funk. Lo tachó el arreglista en los dos menús.
 */
function pierdeLaGama(id: Idioma, especie: EspecieDeBloque | null, destino: DegreeSymbol): boolean {
  return enDominantes(id) && especie === 'dominant7' && ['ii', 'iii', 'vi'].includes(destino);
}

/**
 * Si un préstamo es **del menor y no del estilo**: el iv, el bVI o el bIII en un
 * estilo que cierra sin sensible con su bVII (`bVIIDeLaCasa`, la misma vara del
 * juez) y que pesa el préstamo por debajo de lo corriente —el folk—, en una canción
 * que no toca ninguno.
 *
 * En ese estilo lo prestado que se usa es el bVII, el mixolidio de la gaita; el peso
 * de `STYLES` es el suyo, y con él el `IV iv I` del soul y del pop salía en todos los
 * menús de folk. El arreglista lo tachó en los dos de country, que se examinaban como
 * folk. **El country, con su estilo, va más lejos**: tachó también el bVII, así que
 * ahí todo préstamo es de otra casa mientras tu canción no toque ninguno. Si ya
 * tocas uno, es tu color y no cuesta.
 */
function oscuroDeOtraCasa(id: Idioma, degree: DegreeSymbol): boolean {
  // El country no tiene préstamo de casa, ni siquiera el bVII: el iv y el bVII son de
  // vez en cuando, y solo si la canción ya los toca. El arreglista tachó los dos.
  if (id.estilo === 'country') {
    return ![...id.tuyos].some((grado) => esPrestado(id.mode, grado));
  }
  return (
    degree !== 'bVII' &&
    id.estilo !== null &&
    bVIIDeLaCasa(id.estilo) &&
    id.prestamo < PESO_NEUTRO &&
    ![...id.tuyos].some((grado) => esPrestado(id.mode, grado) && grado !== 'bVII')
  );
}

/** Los grados de la mezcla con el otro modo que no caben en un idioma funcional. */
const MEZCLA: ReadonlySet<DegreeSymbol> = new Set(['bIII', 'bVI', 'bVII', 'VII']);

/** Si tu canción vive en el idioma de dominantes de un blues o un funk, en mayor. */
function enDominantes(id: Idioma): boolean {
  return id.mode === 'major' && (id.dominantes || deDominantes(id)) && !esFuncional(id);
}

/**
 * Los estilos que **viven de que la dominante llegue**: el jazz y el bolero. En ellos
 * lo de casa son las cuatríadas, la cadena de secundarias cuenta, el ii–V es la
 * célula y volver de la dominante no se construye.
 */
const FUNCIONALES: ReadonlySet<StyleId> = new Set(['jazz', 'bolero']);

function esFuncional(id: Pick<Idioma, 'estilo'>): boolean {
  return id.estilo !== null && FUNCIONALES.has(id.estilo);
}

/** Los estilos del idioma de dominantes: todo con séptima menor, I7, IV7 y V7. */
function deDominantes(id: Pick<Idioma, 'estilo'>): boolean {
  return id.estilo === 'blues' || id.estilo === 'funk';
}

/**
 * Los estilos en los que **la dominante puede quedarse sin resolver**: el `V IV` del
 * blues, la dominante que vuelve al vamp en el funk y el ir y venir del reggae.
 */
function vuelveDeLaDominante(id: Pick<Idioma, 'estilo'>): boolean {
  return deDominantes(id) || id.estilo === 'reggae';
}

/**
 * Si un grado es **de otra gama** que la del idioma de dominantes (`enDominantes`).
 *
 * La de un blues o un funk es la mixolidia con la tercera de blues: el I7, el IV7, el
 * V7, el bVII7, el bIII. Los menores de tónica de la escala de manual —el vi y el
 * iii— son otra música, y el bVI tampoco está: la sexta menor no es de esa gama (el
 * arreglista los tachó en un funk y en un blues de dos coros). **El ii, según**: el
 * `ii7 V7 I7` de un funk lo da él por bueno, y en un blues con su estilo el ii–V es
 * el del jazz, que tachó en dos.
 */
function deOtraGama(id: Idioma, degree: DegreeSymbol): boolean {
  return (
    enDominantes(id) &&
    (['iii', 'vi', 'bVI'].includes(degree) || (degree === 'ii' && id.estilo === 'blues'))
  );
}

/** Si lo tuyo es un menor que llega con la sensible: toca el V y ni la v ni el VII. */
function eligioLaSensible(id: Idioma): boolean {
  return id.mode === 'minor' && id.tuyos.has('V') && !id.tuyos.has('v') && !id.tuyos.has('VII');
}

/** Si un grado trae la sensible de la tonalidad, o la de otro sitio. */
function traeLaSensible(mode: KeyMode, degree: DegreeSymbol): boolean {
  return degree.includes('/') || resolveDegree(0, mode, degree).notes.includes(11);
}

/**
 * Lo que vale ir de un grado a otro: el peso del grafo, con dos matices. Quedarse
 * es legítimo pero no avanza —salvo alargar la dominante, que es un recurso—, y
 * volver de la dominante a la subdominante es el idioma del blues y una
 * retrogresión en lo demás.
 */
function valorDelSalto(id: Idioma, de: DegreeSymbol, a: DegreeSymbol): number {
  if (de === a) {
    return de === 'V' ? -0.2 : -0.6;
  }
  // Llegar a casa sin sensible en un menor que eligió el V con ella —sin la v ni el
  // VII— es cambiarle el modo: lo mismo que meterla donde no la quieren, al revés.
  if (a === id.tonica && (de === 'VII' || de === 'v') && eligioLaSensible(id)) {
    return -3;
  }
  // Solo se pregunta por saltos que salen del grafo: los caminos se buscan en él.
  const peso = saltosDe(id.mode, de).find((move) => move.to === a)!.weight;
  return (
    peso -
    (retrocede(de, a) && !vuelveDeLaDominante(id) ? 0.5 : 0) -
    (promesaRota(id.mode, de, a) ? 1 : 0) +
    cadena(id, de, a)
  );
}

/**
 * Si una dominante secundaria **no llega a lo que prepara**: el III7 que cae en el IV
 * —la rota de la relativa— o el VI7 que se salta su ii y va al V. El grafo los
 * conoce, y existen; pero el juez los cuenta como lo que son, una promesa sin
 * cumplir, y el arreglista los tachó en todos los menús en que salieron. Llega si el
 * bajo cae una quinta —a lo suyo, o a la siguiente dominante de una cadena— o un
 * semitono, que es su sustituto.
 */
function promesaRota(mode: KeyMode, de: DegreeSymbol, a: DegreeSymbol): boolean {
  if (!de.includes('/')) {
    return false;
  }
  const baja = (resolveDegree(0, mode, de).root - resolveDegree(0, mode, a).root + 12) % 12;
  return baja !== 7 && baja !== 1;
}

/**
 * Lo que suma una cadena de dominantes —una que resuelve en otra dominante,
 * `V/vi V/ii V/V V`— en el estilo que vive de ellas.
 *
 * El grafo les da poco peso porque en el repertorio de a diario son raras, y con
 * eso un jazz no recibía nunca el puente del rhythm changes: salían puentes de
 * pop. Suma lo que el estilo usa las dominantes secundarias por encima de lo
 * corriente, y nada donde no las usa.
 */
function cadena(id: Idioma, de: DegreeSymbol, a: DegreeSymbol): number {
  const resuelveEnDominante =
    de.includes('/') && (a.includes('/') || a === 'V') && esSuDominante(id, de, a);
  // El country usa **una** secundaria, el II7 delante del V, y no la cadena: el
  // arreglista tachó `V/ii V/V V` como jazz en un country.
  const encadena = id.estilo !== 'country' || a === 'V';
  return resuelveEnDominante && encadena ? Math.max(0, id.secundaria - PESO_NEUTRO) : 0;
}

/** Si el salto vuelve de la dominante a la subdominante: `V IV`, `V ii`. */
function retrocede(de: DegreeSymbol, a: DegreeSymbol): boolean {
  return de === 'V' && (a === 'IV' || a === 'ii' || a === 'iv' || a === 'ii°');
}

/**
 * Los estilos en los que volver de la dominante no se hace: el juez lo descarta
 * (`encaje.ts`), así que construirlo es gastar un sitio del menú en algo que no va
 * a entrar. Y con una canción larga eso era quedarse sin menú.
 */
const SIN_RETROGRESION: ReadonlySet<StyleId> = new Set(['jazz', 'folk', 'bolero']);

/**
 * Cuánto prepara la llegada a la tónica el acorde que va justo antes.
 *
 * **El bVII ya no vale lo que el V**, que es lo que pasaba cuando esto miraba el
 * papel armónico y los dos eran «dominante»: aquí el V aprieta con la sensible y
 * el bVII llega sin ella, y lo que valga el bVII lo dice el estilo —en un rock casi
 * lo mismo, en un jazz poco— y si tu canción ya es mixolidia.
 */
function fuerzaDeCadencia(id: Idioma, penultimo: DegreeSymbol): number {
  switch (penultimo) {
    case 'V':
      // Con tu cadencia propia, el V y la tuya se cambian los papeles.
      return id.modales.length > 0 ? 0.2 : id.cadenciaPropia !== null ? 0.8 : 1.3;
    case 'vii°':
      // Cerrar con el vii° en tríada es de coral: en un pop, un rock o un folk se
      // cierra con el V. Vale lo que el estilo use los disminuidos, y sin estilo
      // casi nada, que neutro es no premiar lo raro.
      return 0.2 + id.disminuido;
    case 'v':
      return id.modales.includes('v') ? 1 : 0.6;
    case 'bII':
      return 0.3 + Math.max(id.tritono, id.napolitano) + (id.modales.includes('bII') ? 0.3 : 0);
    case 'bVII':
      return 0.3 + id.prestamo * 0.8 + (id.mixolidio ? 0.5 : 0);
    case 'VII':
      return id.cadenciaPropia === 'VII' ? 1.3 : esFuncional(id) ? 0.4 : 0.8;
    case 'IV':
    case 'iv':
      // La vuelta del IV a casa es el idioma del blues, del funk y del country.
      return id.cadenciaPropia === penultimo
        ? 1.3
        : deDominantes(id) || id.estilo === 'country'
          ? 0.9
          : 0.7;
    default:
      return 0;
  }
}

/** Lo que suma lo que va antes de la cadencia: el ii del ii–V–I, el bVI del bVI–bVII–I. */
function preparacion(id: Idioma, ante: DegreeSymbol | null, penultimo: DegreeSymbol): number {
  return preparacionDeManual(id, ante, penultimo) + (esTuFirma(id, ante, penultimo) ? 0.3 : 0);
}

/**
 * Si `ante penultimo` es **la llegada de tu canción** cuando llega a casa por su
 * color —el `bVI bVII` de `I bVI bVII I`, el `VI VII` de un eólico—: en ese idioma la
 * cadencia de la canción es su firma, y cerrar con ella entera cierra como cierra
 * ella. «bVI bVII I otra vez» es una de las tres respuestas del arreglista; sin
 * esto, la escalera perdía por poco contra `IV iv bVII I`, que llega al mismo bVII
 * por otro sitio. Con la dominante no hace falta: la perfecta ya es la fuerte.
 */
function esTuFirma(id: Idioma, ante: DegreeSymbol | null, penultimo: DegreeSymbol): boolean {
  return (
    id.suLlegada !== null &&
    (id.modales.length > 0 || id.cadenciaPropia !== null || id.mezcla) &&
    penultimo === id.suLlegada.llega &&
    ante === id.suLlegada.antes
  );
}

function preparacionDeManual(
  id: Idioma,
  ante: DegreeSymbol | null,
  penultimo: DegreeSymbol,
): number {
  if (penultimo === 'V' && (ante === 'ii' || ante === 'ii°')) {
    // El ii–V es la célula del jazz y del bolero; en un blues es otro idioma, que
    // llega por el IV.
    return esFuncional(id) ? 0.8 : id.estilo === 'blues' ? -0.4 : 0.5;
  }
  // El II7 delante del V es la firma del country.
  if (penultimo === 'V' && ante === 'V/V' && id.estilo === 'country') {
    return 0.7;
  }
  if (penultimo === 'V' && ['IV', 'iv', 'V/V', 'bVI', 'bII'].includes(ante ?? '')) {
    return 0.4;
  }
  if (penultimo === 'bII' && ante === 'ii') {
    return 0.5;
  }
  if (
    (penultimo === 'bVII' || penultimo === 'VII') &&
    ['bVI', 'VI', 'IV', 'iv'].includes(ante ?? '')
  ) {
    return 0.4;
  }
  return penultimo === 'iv' && ante === 'IV' ? 0.3 : 0;
}

function media(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0) / valores.length;
}

/** Los saltos de un camino que sale de `desde`, ya valorados. Solo se llama con caminos del grafo. */
function saltosDelCamino(
  id: Idioma,
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): number[] {
  return grados.map((grado, i) => valorDelSalto(id, i === 0 ? desde : grados[i - 1]!, grado));
}

/** Lo que cuestan los grados nuevos de un camino, cada uno una vez. */
function precioDelCamino(id: Idioma, grados: readonly DegreeSymbol[]): number {
  return [...new Set(grados)].reduce((total, grado) => total + precioDelGrado(id, grado), 0);
}

/**
 * Lo que vale un cierre: lo bien que se encadena, lo que cuesta en su estilo y,
 * sobre todo, **cómo llega a la tónica**. Con la media de los saltos y no la suma,
 * para que un camino largo no gane por largo.
 */
function valorDeCierre(
  id: Idioma,
  antes: DegreeSymbol | null,
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): number {
  const todos = [desde, ...grados];
  const penultimo = todos.at(-2)!;
  const ante = todos.length >= 3 ? todos.at(-3)! : antes;
  return (
    media(saltosDelCamino(id, desde, grados)) +
    precioDelCamino(id, grados) +
    fuerzaDeCadencia(id, penultimo) +
    preparacion(id, ante, penultimo) +
    resolucion(id, desde, grados)
  );
}

/**
 * Si el cierre resuelve la dominante de la que sale.
 *
 * Un V pide la tónica **ya**. Antes se medía solo cómo se llegaba al final, y desde
 * un V ganaban cierres que se iban antes de volver —`V → vi IV I`, y en la
 * andaluza `V → VI VII i`—: llegaban bien, pero dejaban la dominante sin resolver.
 * En el blues `V IV I` es el idioma, así que ahí cuesta poco.
 */
function resolucion(id: Idioma, desde: DegreeSymbol, grados: readonly DegreeSymbol[]): number {
  // Una dominante secundaria pide lo suyo igual que el V pide la tónica: lo
  // primero de su grafo, u otra dominante de la cadena. Lo demás —su cadencia rota,
  // como mucho— se construye, pero detrás.
  if (desde.includes('/')) {
    const suyo = saltosDe(id.mode, desde)[0]!.to;
    const primero = grados[0]!;
    return primero === suyo || primero.includes('/') || primero === 'V' ? 0 : -0.4;
  }
  if (desde !== 'V' && desde !== 'vii°') {
    return 0;
  }
  if (grados[0] === id.tonica) {
    return 0.4;
  }
  return grados.length > LARGO_DE_UNA_FRASE ? 0 : vuelveDeLaDominante(id) ? -0.2 : -0.6;
}

// ─── Buscar caminos en el grafo ─────────────────────────────────────────────

/** Lo que cuesta cada vuelta al acorde de hace dos compases (`buscarCaminos`). */
const VAIVEN = 0.35;

/** Cuántos caminos a medias se guardan por paso. Con esto, ocho pasos siguen siendo instantáneos. */
const ANCHO_DE_LA_BUSQUEDA = 60;

/** Lo que se le pregunta a cada grado candidato: si puede ir en el paso `i` después de `previo`. */
type Admite = (grado: DegreeSymbol, i: number, previo: DegreeSymbol) => boolean;

/**
 * Los mejores caminos de `largo` pasos desde un grado, por el grafo.
 *
 * Una búsqueda por haz: en cada paso se quedan los `ANCHO_DE_LA_BUSQUEDA` mejores
 * caminos a medias. Antes se generaban **todos** los caminos y se ordenaban por
 * novedad, y eso tenía dos problemas: no pasaba de cuatro pasos —el grafo crece
 * por potencias— y lo «nuevo» ganaba aunque sonara peor. Quedarse en el mismo
 * grado entra como opción, pero no dos veces seguidas: eso es un acorde que no
 * se mueve, y para durar más están los pulsos.
 */
function buscarCaminos(
  id: Idioma,
  desde: DegreeSymbol,
  largo: number,
  admite: Admite,
  soloDeTuIdioma = true,
): DegreeSymbol[][] {
  let frentes: { grados: DegreeSymbol[]; suma: number }[] = [{ grados: [], suma: 0 }];
  const sinRetroceso = id.estilo !== null && SIN_RETROGRESION.has(id.estilo);
  for (let i = 0; i < largo; i += 1) {
    const siguientes: { grados: DegreeSymbol[]; suma: number }[] = [];
    for (const camino of frentes) {
      const previo = camino.grados.at(-1) ?? desde;
      const antePrevio = camino.grados.length >= 2 ? camino.grados.at(-2)! : desde;
      for (const grado of [previo, ...saltosDe(id.mode, previo).map((move) => move.to)]) {
        const repite = grado === previo && (i === 0 || antePrevio === previo);
        // Del V no se vuelve a su antesala fuera del blues: `V ii V I` deshace lo
        // que el ii preparó para prepararlo otra vez, y el V7 que va al ii7 es la
        // retrogresión de manual. Al IV sí, que es el idioma del rock y del pop,
        // salvo en los estilos que no vuelven nunca de la dominante.
        // Y volver a la dominante después de haberla dejado, `V IV V`, es ir y venir
        // del blues, del funk, del reggae y del rock: en lo demás deshace la cadencia
        // para rehacerla.
        const atras =
          (retrocede(previo, grado) &&
            (grado === 'IV' || grado === 'iv' ? sinRetroceso : id.estilo !== 'blues')) ||
          (grado === 'V' &&
            retrocede(antePrevio, previo) &&
            !vuelveDeLaDominante(id) &&
            id.estilo !== 'rock');
        if (
          repite ||
          atras ||
          // En quintas, el préstamo que solo lo era por su tercera no se distingue del
          // de la escala: el iv5 detrás del IV5 es el mismo acorde.
          (id.lenguaje === 'quintas' &&
            esPrestado(id.mode, grado) &&
            quintaDeLaEscala(id.mode, grado)) ||
          tritonoSinDominante(id, previo, grado) ||
          // El country usa una secundaria suelta, el II7 delante del V; dos seguidas
          // son la cadena del jazz, y el arreglista la tachó (`cadena`).
          (id.estilo === 'country' && previo.includes('/') && grado.includes('/')) ||
          (soloDeTuIdioma && deOtroIdioma(id, grado)) ||
          !admite(grado, i, previo)
        ) {
          continue;
        }
        const nuevo = camino.grados.includes(grado) ? 0 : precioDelGrado(id, grado);
        // Volver al de hace dos, `I IV I`, es un vaivén: vale una vez, y dentro de
        // una frase nueva repetirlo es dar vueltas sin ir a ningún sitio. Sin esto
        // la frase más «segura» tras un bucle era `I IV I IV I IV V I`.
        const vaiven = i > 0 && grado === antePrevio && grado !== previo ? VAIVEN : 0;
        // Y cada salto que ya se ha dado vale menos la segunda vez: una frase larga
        // que repite `IV V I` tres veces no va a ningún sitio, da vueltas.
        const repetido =
          grado !== previo && yaSalto(desde, camino.grados, previo, grado) ? VAIVEN : 0;
        siguientes.push({
          grados: [...camino.grados, grado],
          suma: camino.suma + valorDelSalto(id, previo, grado) + nuevo - vaiven - repetido,
        });
      }
    }
    frentes = siguientes
      .sort((a, b) => b.suma - a.suma || orden(a.grados, b.grados))
      .slice(0, ANCHO_DE_LA_BUSQUEDA);
  }
  // Si sin lo de otro idioma no hay camino —un acorde tuyo que solo sabe ir ahí—,
  // queda ese antes que nada: entonces lo pesa el juez.
  return frentes.length === 0 && soloDeTuIdioma
    ? buscarCaminos(id, desde, largo, admite, false)
    : frentes.map((camino) => camino.grados);
}

/**
 * Lo que vale como poco un grado de otro idioma (`precioDelGrado`): el V en un modo
 * que eligió no tener sensible, el bVII en un bolero, el vi en un funk, una
 * secundaria en música de cine.
 */
const PRECIO_DE_OTRO_IDIOMA = -1.5;

/**
 * Si un grado es **de otro idioma** para tu canción, y no se construye. Antes solo
 * costaba, y en una frase entera el resto la compensaba: un contraste de cine salía
 * por `V vi V/V V` con todo lo demás bien enlazado, y el juez, que no sabe de qué
 * vive cada canción, lo ponía primero. Que no esté es mejor que dejárselo al juez,
 * como con los cambios sueltos que valen menos que nada (`rearmonizaciones`).
 */
function deOtroIdioma(id: Idioma, grado: DegreeSymbol): boolean {
  return precioDelGrado(id, grado) <= PRECIO_DE_OTRO_IDIOMA;
}

/**
 * Si ir de `previo` a `grado` es **un sustituto tritonal recién salido de casa**: un
 * bII que suena con séptima de dominante —en un jazz, en cuatríadas— justo detrás de
 * la tónica. El sustituto va donde iría el V: detrás de lo que lo prepara, o en su
 * lugar. Desde la tónica no hay dominante que sustituir, y el bII7 suena a otra
 * tonalidad; ahí el bII es el color frigio, en tríada (lo tachó el arreglista en un
 * funk en im7 examinado como jazz).
 */
function tritonoSinDominante(id: Idioma, previo: DegreeSymbol, grado: DegreeSymbol): boolean {
  return grado === 'bII' && previo === id.tonica && especieNueva(id, grado, null) === 'dominant7';
}

/** Si el camino ya ha ido de `de` a `a` antes. */
function yaSalto(
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
  de: DegreeSymbol,
  a: DegreeSymbol,
): boolean {
  return grados.some((grado, i) => grado === a && (i === 0 ? desde : grados[i - 1]) === de);
}

/** Un orden fijo entre dos listas de grados, para desempatar sin depender del idioma del sistema. */
function orden(a: readonly string[], b: readonly string[]): number {
  const x = a.join(' ');
  const y = b.join(' ');
  return Number(x > y) - Number(x < y);
}

interface CaminoValorado {
  readonly grados: readonly DegreeSymbol[];
  readonly valor: number;
}

/** Lo que puede quedar por debajo del mejor camino para construirse todavía. */
const DISTANCIA_AL_MEJOR = 1.5;

/** Los mejores primero, y con el mismo valor, en un orden fijo. */
function porValor(a: CaminoValorado, b: CaminoValorado): number {
  return b.valor - a.valor || orden(a.grados, b.grados);
}

/**
 * Los mejores de una lista, **uno por clave**: así tres cierres no son tres
 * maneras de llegar desde el V, sino desde el V, desde el IV y desde el bVII.
 */
function distintos(
  caminos: readonly CaminoValorado[],
  clave: (camino: CaminoValorado) => string,
  cuantos: number,
): CaminoValorado[] {
  const vistas = new Set<string>();
  const elegidos: CaminoValorado[] = [];
  const ordenados = [...caminos].sort(porValor);
  // Lo que queda muy por debajo del mejor no se construye: un bVII en un bolero
  // entraba por ser «el mejor cierre desde el bVII», y nadie lo había pedido.
  const suelo = (ordenados[0]?.valor ?? 0) - DISTANCIA_AL_MEJOR;
  for (const camino of ordenados) {
    if (!vistas.has(clave(camino)) && elegidos.length < cuantos && camino.valor >= suelo) {
      vistas.add(clave(camino));
      elegidos.push(camino);
    }
  }
  return elegidos;
}

/**
 * Los cierres de `largo` compases desde un grado: acaban en la tónica y no la
 * tocan antes, salvo en una frase larga, donde puede sonar al principio —una frase
 * de ocho que pasa por casa y vuelve a salir— pero nunca en los tres últimos.
 */
function cierresDesde(
  id: Idioma,
  antes: DegreeSymbol | null,
  desde: DegreeSymbol,
  largo: number,
  cuantos: number,
  empieza: readonly DegreeSymbol[] | null = null,
): CaminoValorado[] {
  const tonica = id.tonica;
  const admite: Admite = (grado, i, previo) => {
    if (i === 0 && empieza !== null && !empieza.includes(grado)) {
      return false;
    }
    if (i === largo - 1) {
      return grado === tonica && previo !== tonica;
    }
    // La tónica en medio solo con sitio para volver a salir y llegar: al principio
    // de una frase de cuatro —el V que resuelve y la frase sigue— o en una larga.
    // Y al principio de una de tres si lo tuyo acaba en algo que solo sabe ir a
    // casa o al V —un vii°, un bII—: resolver y cerrar con un amén es lo que queda
    // cuando el V es de otro idioma.
    const resolverYa =
      i === 0 &&
      largo === 3 &&
      id.modales.length > 0 &&
      saltosDe(id.mode, previo).every((m) => m.to === tonica || m.to === 'V');
    return grado !== tonica || ((i <= largo - 4 || resolverYa) && previo !== tonica);
  };
  const todos = buscarCaminos(id, desde, largo, admite);
  // Una canción que habla en funcional llega por la dominante (`Idioma.funcional`):
  // un cierre de varios compases que no pasa por ninguna —`I vi IV I` detrás de un
  // `ii7 V7 Imaj7 IVmaj7`— cierra más flojo que lo tuyo, y el arreglista lo tachó.
  // Si ninguno pasa, quedan todos.
  const porLaDominante = todos.filter((grados) => grados.some(esUnaDominante));
  const caminos = (
    id.funcional && largo > 1 && porLaDominante.length > 0 ? porLaDominante : todos
  ).map((grados) => ({ grados, valor: valorDeCierre(id, antes, desde, grados) }));
  return distintos(caminos, (c) => [desde, ...c.grados].at(-2)!, cuantos);
}

/**
 * Si un grado es **una dominante de la tónica**: el V, el vii° o el bII que lo
 * sustituye. Una secundaria no: `V/vi vi IV I` pasa por una dominante, pero la del
 * vi, y a casa llega por la plagal.
 */
function esUnaDominante(grado: DegreeSymbol): boolean {
  return grado === 'V' || grado === 'vii°' || grado === 'bII';
}

/**
 * Las cadencias con las que se puede cerrar desde ese grado, la mejor primero.
 *
 * **Un cierre no se alarga hacia delante, se prepara por detrás**, así que son
 * caminos cortos —de uno a tres compases— que acaban en la tónica sin tocarla
 * antes, ordenados por lo bien que la preparan. **Desde el V, la primera es la I
 * sola**: lo que pide una dominante es resolver, y antes la más corta medía dos
 * compases a la fuerza y la primera era `IV I`.
 *
 * Sin estilo, que es la pregunta de la teoría: con él, la contesta
 * `salidasPosibles`.
 */
export function cadenciasParaCerrar(mode: KeyMode, desde: DegreeSymbol): readonly DegreeSymbol[][] {
  const id = idiomaDe(mode, [{ degree: desde, beats: 4 }], SIN_CONTEXTO);
  return [1, 2, 3]
    .flatMap((largo) => cierresDesde(id, null, desde, largo, 3))
    .sort(porValor)
    .map((camino) => [...camino.grados]);
}

/** La dominante de un grado: el V de la tónica, o su dominante secundaria si el catálogo la tiene. */
function esSuDominante(id: Idioma, grado: DegreeSymbol, de: DegreeSymbol): boolean {
  return applyMove(id.mode, de, 'dominante', { siguiente: de }) === grado;
}

/**
 * Las partes que se van y saben volver a tu primer compás: no acaban en la tónica
 * y su último acorde lleva a donde empezaste. **Mejor si vuelve por su dominante**
 * —el V antes de tu I, el III7 antes de tu vi—, que es lo que hace que la vuelta
 * suene a vuelta.
 */
function partesQueVuelven(
  id: Idioma,
  desde: DegreeSymbol,
  largo: number,
  primero: DegreeSymbol,
  cuantos: number,
  empieza: readonly DegreeSymbol[] | null = null,
): CaminoValorado[] {
  const tonica = id.tonica;
  const admite: Admite = (grado, i, previo) => {
    if (grado === tonica && previo === tonica) {
      return false;
    }
    // Una estrofa o un estribillo empiezan donde empiezan, y la estrofa en casa.
    if (i === 0 && empieza !== null) {
      return empieza.includes(grado) && (grado !== tonica || largo > 1);
    }
    if (i === largo - 1) {
      return grado !== tonica && canFollow(id.mode, grado, primero);
    }
    return grado !== tonica || (largo >= 5 && i >= 1 && i <= largo - 3);
  };
  // Y por casa, una vez como mucho: un contraste que reposa dos veces en la tónica
  // —`V I vi IV I V/ii ii V`— no se ha ido. El juez lo pesaba y aun así salían
  // segundos del menú; ahora no se construyen.
  const caminos = buscarCaminos(id, desde, largo, admite)
    .filter(
      (grados) =>
        new Set(grados).size >= 2 && grados.filter((grado) => grado === tonica).length <= 1,
    )
    .map((grados) => {
      const ultimo = grados.at(-1)!;
      const nuevos = new Set(grados.filter((grado) => !id.tuyos.has(grado))).size;
      // Volver a la tónica es una cadencia, y vale lo que valga en su estilo: el V
      // en todos, el bVII en un rock. A otro grado, su dominante.
      const vuelta =
        primero === tonica
          ? 0.6 * fuerzaDeCadencia(id, ultimo)
          : esSuDominante(id, ultimo, primero)
            ? 0.8
            : ultimo === 'V' && (primero === 'vi' || primero === 'VI')
              ? 0.4
              : 0;
      return {
        grados,
        valor:
          media(saltosDelCamino(id, desde, grados)) +
          precioDelCamino(id, grados) +
          Math.min(nuevos, 3) * 0.25 +
          vuelta,
      };
    });
  return distintos(caminos, (c) => [...new Set(c.grados)].sort().join(' '), cuantos);
}

// ─── Lo que suena: especies y punteo ────────────────────────────────────────

/** Las séptimas de cada grado, las que pide un jazz: la cuatríada de la escala. */
const SEPTIMAS: Readonly<Record<KeyMode, Readonly<Record<string, SeventhQuality>>>> = {
  major: {
    I: 'major7',
    ii: 'minor7',
    iii: 'minor7',
    IV: 'major7',
    V: 'dominant7',
    vi: 'minor7',
    'vii°': 'halfDiminished7',
    bII: 'dominant7',
    bIII: 'major7',
    iv: 'minor7',
    bVI: 'major7',
    bVII: 'dominant7',
  },
  minor: {
    i: 'minor7',
    'ii°': 'halfDiminished7',
    bII: 'dominant7',
    III: 'major7',
    iv: 'minor7',
    v: 'minor7',
    V: 'dominant7',
    VI: 'major7',
    VII: 'dominant7',
  },
};

/** Las del blues: todo dominante en los tres de siempre, aunque la teoría diga que no. */
const SEPTIMAS_DEL_BLUES: Readonly<Record<KeyMode, Readonly<Record<string, SeventhQuality>>>> = {
  // El ii del blues de jazz va con su séptima menor, y el bVI7 que baja al V, con la
  // de dominante: una tríada en medio de un coro de séptimas suena a otro grupo.
  major: {
    I: 'dominant7',
    ii: 'minor7',
    IV: 'dominant7',
    V: 'dominant7',
    bVI: 'dominant7',
    bVII: 'dominant7',
  },
  minor: { i: 'minor7', 'ii°': 'halfDiminished7', iv: 'minor7', V: 'dominant7', VI: 'dominant7' },
};

/**
 * La especie de un acorde que pone la salida, **según lo que es el acorde que
 * entra** y nunca según el que se va.
 *
 * Antes heredaba la séptima del compás que sustituía: una tónica final que entraba
 * donde había un V7 salía `i(m7)`, y un VII donde había un V7, `VII7`. Lo que se va
 * no dice nada de lo que entra. El orden:
 *
 * 1. **Quintas si tu canción va en quintas**: es la textura, no una función, y una
 *    tríada en medio de un riff de quintas suena a otro grupo. Lo que solo es lo que
 *    es con séptima —el sustituto tritonal, la dominante secundaria— no se construye
 *    en ese idioma (`precioDelGrado`, `rearmonizaciones`).
 * 2. **La que pide el movimiento**: el sustituto tritonal, la dominante que se pone
 *    delante y la dominante secundaria son dominantes con su séptima.
 * 3. **La del mismo grado en tu canción**: si tocas el V7, el V nuevo es V7; si
 *    tocas la i sin séptima, la i nueva también. Antes lo nuevo no miraba esto y un
 *    bolero que tocaba V7 recibía un V pelado.
 * 4. **La del estilo y la de tu idioma**: en un blues, todo con séptima —las de la
 *    casa del blues, y las de la escala para lo demás—, **y lo mismo si tu tónica o
 *    tu subdominante ya suenan con séptima de dominante** (`Idioma.dominantes`): un
 *    funk en I7 que recibía un IVmaj7 sonaba a otra canción. Si tocas cuatríadas,
 *    la cuatríada de la escala. Sin nada de eso, la tríada.
 */
function especieNueva(
  id: Idioma,
  degree: DegreeSymbol,
  move: MoveId | null,
): EspecieDeBloque | null {
  if (id.lenguaje === 'quintas') {
    return 'quinta';
  }
  const delMovimiento = move === null ? null : especieDelMovimiento(move, degree);
  if (delMovimiento !== null || degree.includes('/')) {
    return delMovimiento ?? 'dominant7';
  }
  if (id.especieDelGrado.has(degree)) {
    return id.especieDelGrado.get(degree)!;
  }
  // Lo que sustituye a la tónica lleva la cuatríada de la escala también en un
  // funk o un blues: el VI que hace de i es VImaj7, como en un jazz. Con la de
  // dominante —el VI7 del blues— deja de ser tónica: es el que baja al V.
  const sustituyeALaTonica =
    (move === 'funcion' || move === 'relativo') && roleOfDegreeSymbol(degree) === 'tonic';
  if ((deDominantes(id) || id.dominantes) && !sustituyeALaTonica) {
    // Las del blues —y del funk— para lo de siempre y las de la escala para lo
    // demás: sin la segunda, el iii y el vi salían tríadas en medio de un coro de
    // séptimas.
    return sinSensible(
      id,
      degree,
      SEPTIMAS_DEL_BLUES[id.mode][degree] ?? SEPTIMAS[id.mode][degree]!,
    );
  }
  // Todo grado del modo que no es una dominante secundaria tiene su cuatríada.
  return id.lenguaje === 'septimas' || (sustituyeALaTonica && (deDominantes(id) || id.dominantes))
    ? sinSensible(id, degree, SEPTIMAS[id.mode][degree]!)
    : null;
}

/**
 * La cuatríada de la escala, **sin la sensible si tu canción no la quiere**.
 *
 * Las de `SEPTIMAS` son las del mayor y el menor de manual, y el Imaj7 lleva la
 * sensible dentro: en un riff mixolidio, que eligió el bVII para no tenerla, la
 * metía por la puerta de atrás. Ahí el I es I7, que es el mixolidio; y lo demás que
 * la traiga sin tenerla en su tríada se queda en tríada.
 */
function sinSensible(
  id: Idioma,
  degree: DegreeSymbol,
  septima: SeventhQuality,
): EspecieDeBloque | null {
  if (id.modales.length === 0) {
    return septima;
  }
  const acorde = resolveDegree(0, id.mode, degree);
  const trae = seventhNotes(acorde.root, septima).includes(11) && !acorde.notes.includes(11);
  if (!trae) {
    return septima;
  }
  return septima === 'major7' && acorde.quality === 'major' ? 'dominant7' : null;
}

/** Un compás nuevo, con la especie que le toca si le toca alguna. */
function paso(
  degree: DegreeSymbol,
  beats: number,
  move: MoveId | null,
  especie: EspecieDeBloque | null,
): PasoPosible {
  return especie === null ? { degree, beats, move } : { degree, beats, move, especie };
}

/** Un compás tuyo tal cual, con la especie que traía. */
function tuyo(id: Idioma, original: readonly PathStep[], i: number): PasoPosible {
  return paso(original[i]!.degree, original[i]!.beats, null, id.especies[i] ?? null);
}

/** Las notas de un acorde sobre la tónica, con la especie con que suena. */
function notasDelAcorde(
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): Set<number> {
  const acorde = resolveDegree(0, mode, degree);
  if (especie === null) {
    return new Set(acorde.notes);
  }
  return new Set(
    esSeventhQuality(especie)
      ? seventhNotes(acorde.root, especie)
      : notasDeEspecieSimple(acorde.root, especie),
  );
}

/**
 * Cuántas notas fuertes del punteo **chocan** con un acorde: no son suyas y caen
 * medio tono por encima de una que sí —el Fa sobre un Do mayor—. Es el choque que
 * se oye; una nota de paso o una tensión de las que se cantan no cuenta.
 */
function choquesConElPunteo(
  id: Idioma,
  i: number,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): { fuertes: number; chocan: number; debiles: number } {
  const notas = id.melodia[i] ?? [];
  const acorde = notasDelAcorde(id.mode, degree, especie);
  const choca = (nota: number) => !acorde.has(nota) && acorde.has((nota + 11) % 12);
  const fuertes = notas.filter((nota) => nota.fuerte);
  return {
    fuertes: fuertes.length,
    chocan: fuertes.filter((nota) => choca(nota.nota)).length,
    // Las débiles también, si quedan medio tono por encima de una del acorde: la
    // novena menor no se aguanta en ningún pulso, y el juez le pone reparo.
    debiles: notas.filter((nota) => !nota.fuerte && choca(nota.nota)).length,
  };
}

// ─── Los textos ─────────────────────────────────────────────────────────────

/** Lo más largo que puede ser lo que dice una salida: el tope del porqué del contrato. */
const LARGO_MAXIMO_DE_LO_QUE_HACE = 200;

/** Lo más largo que puede ser su nombre. */
const LARGO_MAXIMO_DEL_NOMBRE = 60;

/**
 * Lo que hace, y el porqué del movimiento detrás **si cabe entero**. Cortado a
 * media frase sería un porqué que no acaba, y ese se lee peor que ninguno.
 */
function frase(lo: string, porque: string): string {
  const entera = `${lo} ${porque}`;
  return entera.length <= LARGO_MAXIMO_DE_LO_QUE_HACE ? entera : lo;
}

/** La primera que quepa, de la más completa a la más corta. */
function laQueQuepa(tope: number, ...opciones: readonly string[]): string {
  // La última es la corta de verdad: se queda aunque no quepa, y la recorta quien llama.
  return [...opciones.filter((opcion) => opcion.length <= tope), opciones.at(-1)!][0]!;
}

/** «el 3 y el 19» o «el 3, el 19, el 23 y 2 más»: hasta cuatro números. */
function compasesEnTexto(numeros: readonly number[]): string {
  const dichos = numeros.slice(0, 4).map((n) => `el ${n}`);
  const resto = numeros.length - dichos.length;
  if (resto > 0) {
    return `${dichos.join(', ')} y ${resto} más`;
  }
  return dichos.length === 1 ? dichos[0]! : `${dichos.slice(0, -1).join(', ')} y ${dichos.at(-1)!}`;
}

/**
 * El compás en el que empieza el acorde `i`, **contado en compases** y no en
 * acordes: con dos acordes por compás, el quinto acorde está en el compás 3, y
 * decir «en el 5» era señalar otro sitio.
 */
function compasDelAcorde(id: Idioma, pasos: readonly PathStep[], i: number): number {
  return Math.floor(pulsosDe(pasos.slice(0, i)) / id.compas) + 1;
}

/**
 * «V por vi en el 3 y el 19 (cadencia interrumpida)»: los cambios agrupados por lo
 * que cambian, hasta tres grupos, y cada uno con los compases donde cae.
 *
 * Agrupados y no compás a compás porque con treinta y dos compases el mismo cambio
 * salía ocho veces escrito, y cada vez son tokens de entrada que pagan los cupos.
 */
function cambiosEnTexto(
  id: Idioma,
  original: readonly PathStep[],
  cancion: readonly PasoPosible[],
): string {
  const mode = id.mode;
  const grupos = new Map<string, { cambio: string; como: string; compases: number[] }>();
  cancion.forEach((paso, i) => {
    const antes = original[i]!.degree;
    if (paso.degree !== antes) {
      const cambio = `${antes} por ${paso.degree}`;
      // Todo compás que una rearmonización cambia lleva su movimiento: así se construye.
      const move = paso.move!;
      // Lo que suena, dicho: la dominante que se pone delante lleva séptima salvo en
      // una canción de quintas, y la frase del movimiento no lo puede saber.
      const septima = move === 'dominante' && paso.especie === 'dominant7' ? ', con séptima' : '';
      // En quintas, el cambio modal no gana ni pierde sensible: se dice que va en quintas.
      const como =
        move === 'modal' && paso.especie === 'quinta'
          ? 'en quintas'
          : `${nombreDelCambio(mode, move, antes, paso.degree).toLowerCase()}${septima}`;
      const clave = `${cambio}|${como}`;
      const grupo = grupos.get(clave) ?? { cambio, como, compases: [] };
      const compas = compasDelAcorde(id, original, i);
      // Dos acordes del mismo compás que cambian igual son un compás, no dos.
      if (!grupo.compases.includes(compas)) {
        grupo.compases.push(compas);
      }
      grupos.set(clave, grupo);
    }
  });
  const todos = [...grupos.values()];
  const dichos = todos
    .slice(0, 3)
    .map(({ cambio, como, compases }) => `${cambio} en ${compasesEnTexto(compases)} (${como})`);
  return todos.length > 3 ? `${dichos.join('; ')}; y más` : dichos.join('; ');
}

/** Cómo llega a la tónica un cierre, dicho en palabras de músico y verdad de este acorde. */
function comoLlega(id: Idioma, penultimo: DegreeSymbol, especie: EspecieDeBloque | null): string {
  switch (penultimo) {
    case 'V':
      return 'desde la dominante, V';
    case 'v':
      return 'desde la dominante menor, v, sin sensible';
    case 'vii°':
      return 'desde el vii°, que hace de dominante';
    case 'bII':
      return especie === 'dominant7'
        ? 'desde el bII7, sustituto tritonal del V'
        : id.mode === 'minor'
          ? 'desde el bII: la cadencia frigia'
          : 'desde el bII, medio tono por encima';
    case 'bVII':
    case 'VII':
      return `desde el ${penultimo}, sin sensible: cadencia modal`;
    case 'IV':
    case 'iv':
      return `desde la subdominante, ${penultimo}: suave, de plagal`;
    default:
      return `desde ${penultimo}, de rebote`;
  }
}

/** Cómo se llama una parte nueva, y con qué artículo se dice. */
interface NombreDeParte {
  readonly nombre: string;
  /** Vacío cuando el nombre ya lo lleva: «otra frase», no «una otra frase». */
  readonly un: 'un' | 'una' | '';
}

/** «un puente», «una estrofa», «otra frase». */
function conArticulo(parte: NombreDeParte): string {
  return `${parte.un} ${parte.nombre.toLowerCase()}`.trim();
}

/** Lo mismo, con mayúscula: para empezar un nombre. */
function conArticuloArriba(parte: NombreDeParte): string {
  const dicho = conArticulo(parte);
  return dicho.charAt(0).toUpperCase() + dicho.slice(1);
}

const PUENTE: NombreDeParte = { nombre: 'Puente', un: 'un' };
const ESTRIBILLO: NombreDeParte = { nombre: 'Estribillo', un: 'un' };
const ESTROFA: NombreDeParte = { nombre: 'Estrofa', un: 'una' };
const CIERRE: NombreDeParte = { nombre: 'Cierre', un: 'un' };

/** Cómo se llama cada parte cuando se añade. */
const NOMBRE_DEL_PAPEL: Readonly<Record<SectionRole, NombreDeParte>> = {
  idea: { nombre: 'Otra frase', un: '' },
  intro: { nombre: 'Intro', un: 'una' },
  estrofa: ESTROFA,
  pre: { nombre: 'Pre', un: 'un' },
  estribillo: ESTRIBILLO,
  puente: PUENTE,
  solo: { nombre: 'Otra vuelta', un: '' },
  final: { nombre: 'Final', un: 'un' },
};

/**
 * Los nombres que dicen más que el papel: tras un puente, el estribillo que vuelve
 * es **la vuelta**; tras un final, lo que se añade es una coda. Y lo que contrasta
 * con una idea, que no tiene papel, es un puente.
 */
const OTRO_NOMBRE: Readonly<
  Partial<Record<`${'seguir' | 'contraste'}:${SectionRole}`, NombreDeParte>>
> = {
  'contraste:idea': PUENTE,
  'seguir:puente': { nombre: 'Vuelta', un: 'una' },
  'seguir:final': { nombre: 'Coda', un: 'una' },
  'contraste:final': { nombre: 'Coda', un: 'una' },
};

/**
 * Qué es lo que sigue a tu parte, **según el papel de tu parte**: lo que contrasta
 * con una estrofa es el estribillo, y lo que sigue a una intro es la estrofa. Antes
 * todo era «puente» y «cierre», y el papel no se miraba.
 *
 * **Lo dice `PARTE_QUE_SIGUE`, la tabla del juez**, y de ahí sale el nombre: si
 * cada uno tuviera la suya, el nombre diría «estribillo» y el motivo «el pre», que
 * es lo que encontró el corpus final.
 */
function nombresPara(path: 'seguir' | 'contraste'): Readonly<Record<SectionRole, NombreDeParte>> {
  const roles = Object.keys(PARTE_QUE_SIGUE[path]) as SectionRole[];
  return Object.fromEntries(
    roles.map((rol) => [
      rol,
      OTRO_NOMBRE[`${path}:${rol}`] ?? NOMBRE_DEL_PAPEL[PARTE_QUE_SIGUE[path][rol] ?? 'idea'],
    ]),
  ) as Record<SectionRole, NombreDeParte>;
}

const LO_QUE_CONTRASTA = nombresPara('contraste');

const OTRO_ESTRIBILLO: NombreDeParte = { nombre: 'Otro estribillo', un: '' };

/**
 * Lo que sigue a un estribillo es el final, y un final es corto: **más de una
 * frase detrás de un estribillo es otro estribillo**, y se llama así —y así lo
 * juzga el juez, como la misma parte otra vez—. Antes se llamaba «Final» y el
 * juez la juzgaba como estribillo; la verificación ya había pedido que la coda
 * larga dejara paso a otro estribillo.
 */
function otraVez(id: Idioma, steps: readonly PathStep[]): NombreDeParte | null {
  return id.papel === 'estribillo' && pulsosDe(steps) > LARGO_DE_UNA_FRASE * id.pulsos
    ? OTRO_ESTRIBILLO
    : null;
}

/** Y la frase nueva que acaba en casa, cuando lo tuyo ya cerraba o hay sitio para una frase. */
const LO_QUE_CIERRA = nombresPara('seguir');

/**
 * Por dónde empieza una parte nueva **según lo que es**, o nulo si por cualquiera.
 *
 * Lo que sigue a una entrada es la estrofa, y una estrofa empieza en casa —o en
 * el relativo—; lo que sigue a una estrofa es el estribillo, que empieza en la
 * tónica, en la subdominante o en el relativo. Antes la parte nueva salía de donde
 * la llevara el grafo, y había estribillos que empezaban en un V/vi o en el iii:
 * eso es un puente, o el final de otra cosa. Lo demás —un puente, un cierre—
 * puede empezar donde quiera.
 */
function empiezaPor(
  id: Idioma,
  parte: NombreDeParte,
  desde: DegreeSymbol,
): readonly DegreeSymbol[] | null {
  const donde =
    parte === ESTROFA
      ? id.mode === 'major'
        ? (['I', 'vi'] as const)
        : (['i', 'VI'] as const)
      : parte === ESTRIBILLO
        ? id.mode === 'major'
          ? (['I', 'IV', 'vi'] as const)
          : (['i', 'VI', 'iv', 'III'] as const)
        : null;
  // Lo que repetía tu vaivén no es llegar: el estribillo detrás de un pre en `VI VII
  // VI VII` entra en la i, no en el VI que el pre ya machacaba.
  const llegan =
    donde === null || id.vaiven === null
      ? donde
      : donde.filter((grado) => !id.vaiven!.includes(grado));
  // Si lo tuyo acaba en algo que no va a ninguno —un II7 que solo sabe ir al V—,
  // la parte nueva empieza donde pueda: antes de quedarse sin ella.
  return llegan !== null && llegan.some((grado) => canFollow(id.mode, desde, grado))
    ? llegan
    : null;
}

// ─── Lo que construye cada salida ───────────────────────────────────────────

/** Lo que construye cada salida, antes de juzgarla. */
interface Borrador {
  readonly path: PathId;
  /** Al continuar, las partes que se añaden; al retocar, la canción entera. */
  readonly partes: readonly ParteDeSalida[];
  readonly nombre: string;
  readonly que: string;
  readonly cuadra?: true;
  /**
   * Lo que cree el generador que vale, de 0 a 10 más o menos: desempata lo que el
   * juez deja igual. No ordena por encima de él.
   */
  readonly prioridad: number;
  /** Qué clase de salida es, para no enseñar nueve de la misma (`ordenarConVariedad`). */
  readonly familia: string;
  /** Al continuar, qué es lo que se añade: lo dice quien lo nombra, y así lo juzga el juez. */
  readonly loQueSeAnade?: LoQueSeAnade;
  /** Y su papel, si no es el de `PARTE_QUE_SIGUE` (`CandidataAJuzgar.papelNuevo`). */
  readonly papelNuevo?: SectionRole;
}

/** De lo que vale un camino a la prioridad de su salida. */
function prioridadDe(valor: number): number {
  return 5 + 2 * valor;
}

function retoque(steps: readonly PasoPosible[]): ParteDeSalida[] {
  return [{ name: 'Lo que llevas', yours: false, steps }];
}

/**
 * Cuánto se puede añadir para que la canción acabe **en frase**: múltiplos de
 * cuatro compases, o de doce si lo tuyo es un blues.
 *
 * Es el hipermetro, y era el fallo más repetido: cada salida añadía lo que medía
 * su cadencia, y el 41 % de las canciones quedaban en seis, siete, diez u once
 * compases, que se oyen cojas aunque nadie sepa decir por qué. Se ofrece lo que
 * completa la frase y eso más una frase; si ya cuadraba, una frase o dos. En
 * pulsos, porque una toma a dos pulsos por acorde mide la mitad de compases que
 * acordes, y con el compás del contexto, que es con el que mide el juez.
 */
function largosQueCuadran(id: Idioma, original: readonly PathStep[]): number[] {
  const total = pulsosDe(original);
  const resto = total % id.frase;
  // Lo que falta para cuadrar, y eso más una frase —con un compás de sitio, desde
  // una dominante secundaria no se llega a casa—; o si ya cuadra, una frase más o
  // dos, que es lo que mide un periodo.
  const largos = resto !== 0 ? [id.frase - resto, 2 * id.frase - resto] : [id.frase, 2 * id.frase];
  // Una idea más corta que media frase —un riff de un compás— se contesta también
  // con otra igual de larga: `I IV V I` a un pulso pide otro compás a su paso, y
  // completar la frase de golpe eran doce acordes de relleno.
  const contestacion = total * 2 <= id.frase && id.frase % (total * 2) === 0 ? [total] : [];
  // **Y nada de dieciséis acordes de una vez**: más allá de ocho acordes nuevos
  // detrás de lo que completa tu frase, lo que sale es relleno que da vueltas a
  // `I IV V`. Lo que completa tu frase se queda siempre —sin eso no hay cierre—.
  const completar = (id.frase - resto) % id.frase;
  const cuales = [...contestacion, ...largos].filter(
    (pulsos, n) =>
      n === contestacion.length || (pulsos - completar) / id.pulsos <= 2 * LARGO_DE_UNA_FRASE,
  );
  return [...new Set(cuales)];
}

/**
 * Cómo se reparten unos pulsos en compases nuevos: tantos como quepan de los
 * habituales, y lo que sobre repartido de uno en uno entre los últimos. Nulo si
 * no cabe en la canción.
 */
function repartir(
  id: Idioma,
  original: readonly PathStep[],
  pulsos: number,
  llegadaEntera = false,
): number[] | null {
  const sitio = MAX_PATH_STEPS - original.length;
  // La tónica de un cierre dura el compás entero: con acordes de dos pulsos, una
  // llegada de dos deja la canción acabando a mitad de compás. Con acordes de un
  // pulso, medio compás: uno entero ya es relleno al lado de lo tuyo.
  const llegada =
    llegadaEntera && id.pulsos < id.compas && pulsos > id.compas && sitio > 1
      ? Math.min(id.compas, 2 * id.pulsos)
      : 0;
  const resto = pulsos - llegada;
  // Tantos como quepan a tu paso; y si no caben antes del tope, los que quepan, más
  // largos: una canción que casi llena el tope se quedaba sin nada que añadir.
  const huecos = sitio - (llegada > 0 ? 1 : 0);
  let cuantos = Math.min(huecos, Math.max(1, Math.round(resto / id.pulsos)));
  while (cuantos <= huecos && Math.ceil(resto / cuantos) > MAX_BEATS) {
    cuantos += 1;
  }
  if (cuantos < 1 || cuantos > huecos) {
    return null;
  }
  // En unidades de tu paso si se puede, para que lo que dure de más sea un múltiplo
  // de lo tuyo y no un pulso suelto.
  const unidad = resto % id.pulsos === 0 && resto / id.pulsos >= cuantos ? id.pulsos : 1;
  const unidades = resto / unidad;
  const base = Math.floor(unidades / cuantos);
  const sobran = unidades - base * cuantos;
  const trozos = Array.from(
    { length: cuantos },
    (_, i) => (base + (i >= cuantos - sobran ? 1 : 0)) * unidad,
  );
  return llegada > 0 ? [...trozos, llegada] : trozos;
}

/** Unos grados con sus pulsos, ya como compases nuevos. */
function nuevos(
  id: Idioma,
  grados: readonly DegreeSymbol[],
  pulsos: readonly number[],
): PasoPosible[] {
  return grados.map((degree, i) => paso(degree, pulsos[i]!, null, especieNueva(id, degree, null)));
}

/**
 * Si llegar a la tónica desde ese acorde es **resolver**: si es una dominante suya
 * —el V, el vii°, las que llegan sin sensible— o el bII con séptima, que es su
 * sustituto. Desde un ii o un IV se llega, pero no se resuelve nada: no había
 * tensión que deshacer.
 */
function esDominanteDeLaTonica(degree: DegreeSymbol, especie: EspecieDeBloque | null): boolean {
  return roleOfDegreeSymbol(degree) === 'dominant' || (degree === 'bII' && especie === 'dominant7');
}

/**
 * Por dónde sigue una línea de bajo que baja, o nulo si lo tuyo no acaba en una.
 *
 * `I iii bIII ii` es una bajada cromática —Mi, Mib, Re— que va hacia la dominante:
 * el ii pide el V, o el bII7 que sigue bajando. Volver de ahí a la I se salta
 * adonde iba la línea, y era la segunda salida del menú. Se reconoce por la forma
 * —los tres últimos acordes, cada uno a uno o dos semitonos por debajo del
 * anterior— y solo si la línea no ha llegado ya: si acaba en una dominante o en
 * casa, lo que sigue es lo de siempre. Lo que puede ir detrás es una dominante de
 * la tónica o un acorde que siga bajando por grados, y la tónica no: es justo lo
 * que la línea todavía no ha preparado.
 */
function siguenLaLinea(id: Idioma, original: readonly PathStep[]): DegreeSymbol[] | null {
  const ultimo = original.at(-1)!.degree;
  if (
    original.length < 3 ||
    ultimo === id.tonica ||
    esDominanteDeLaTonica(ultimo, id.especies.at(-1) ?? null)
  ) {
    return null;
  }
  const raiz = (degree: DegreeSymbol) => resolveDegree(0, id.mode, degree).root;
  const baja = (de: DegreeSymbol, a: DegreeSymbol) =>
    [1, 2].includes((raiz(de) - raiz(a) + 12) % 12);
  const cola = original.slice(-3).map((paso) => paso.degree);
  if (!baja(cola[0]!, cola[1]!) || !baja(cola[1]!, cola[2]!)) {
    return null;
  }
  return saltosDe(id.mode, ultimo)
    .map((move) => move.to)
    .filter(
      (grado) =>
        grado !== id.tonica &&
        (esDominanteDeLaTonica(grado, especieNueva(id, grado, null)) || baja(ultimo, grado)),
    );
}

/**
 * Por dónde empieza lo que sigue, o nulo si por cualquiera. Lo pide, por este
 * orden:
 *
 * 1. **El papel de la parte nueva**: una estrofa empieza en casa, un estribillo
 *    donde empiezan (`empiezaPor`).
 * 2. **Una línea de bajo que no ha llegado** (`siguenLaLinea`).
 * 3. **Un V que acaba lo tuyo**: pide la tónica ya, o el sexto grado que la
 *    engaña. Un puente que arrancaba del V7 hacia el III7 o el iii dejaba la
 *    dominante colgando, y es lo primero que se oye. En un blues o un funk no:
 *    allí `V IV` es el idioma.
 *
 * Cada uno estrecha lo de antes si deja algo; si lo dejaría vacío, manda lo de
 * antes. Una estrofa que sigue a un V empieza en casa, que es las dos cosas.
 */
function primerosDeLoQueSigue(
  id: Idioma,
  original: readonly PathStep[],
  porElPapel: readonly DegreeSymbol[] | null,
): readonly DegreeSymbol[] | null {
  const linea = siguenLaLinea(id, original);
  const sexto: DegreeSymbol = id.mode === 'major' ? 'vi' : 'VI';
  // Detrás de una canción que baja entera por grados hasta el V —la andaluza—, la
  // rota no cabe: el VI es el escalón de antes, y volver a él deshace la bajada que
  // es la canción (`esUnaBajada`). Lo que sigue a esa llegada es la tónica.
  const bajada = esUnaBajada(
    id.mode,
    original.map((paso) => paso.degree),
  );
  const resuelveElV =
    original.at(-1)!.degree === 'V' && !deDominantes(id)
      ? [id.tonica, ...(bajada && original.at(-2)!.degree === sexto ? [] : [sexto])]
      : null;
  let elegidos: readonly DegreeSymbol[] | null = null;
  for (const pedidos of [porElPapel, linea, resuelveElV]) {
    if (pedidos === null || pedidos.length === 0) {
      continue;
    }
    const ambos: readonly DegreeSymbol[] =
      elegidos === null ? pedidos : elegidos.filter((g) => pedidos.includes(g));
    elegidos = ambos.length > 0 ? ambos : elegidos;
  }
  return elegidos;
}

/**
 * Seguir: resolver ya, una segunda vuelta que cierra, un cierre que completa la
 * frase y, si lo tuyo es un blues, otro coro.
 */
function continuaciones(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (id.blues) {
    return [...llegadaDelBlues(id, original), ...coros(id, original)];
  }
  if (esUnBluesAMedias(id, original)) {
    return completarElBlues(id, original);
  }
  // Un vaivén modal que no gira en la tónica no se cierra en ella: `ii V ii V` en
  // Do es Re dórico, y acabarlo en Do se carga el modo. Lo que le sigue es irse y
  // volver, que son los contrastes.
  if (id.centroModal !== null) {
    return [];
  }
  const tonica = id.tonica;
  const ultimo = original.at(-1)!.degree;
  const antes = original.at(-2)?.degree ?? null;
  const dudaElUltimo = id.dudosos[original.length - 1] === true;
  // Llegar a la tónica solo es resolver si lo tuyo acaba en una dominante suya, **y
  // si se sabe que acaba en ella**: lo que el micro oyó con duda no resuelve nada.
  const aLaTonica =
    !dudaElUltimo && esDominanteDeLaTonica(ultimo, id.especies.at(-1) ?? null)
      ? `Resuelve en la ${tonica}`
      : `Vuelve a la ${tonica}`;
  // Una salida que cierra se premia al final de la canción y después de un puente.
  const ajuste = (id.papel === 'final' ? 1 : 0) + (id.papel === 'puente' ? 0.5 : 0);
  // El vamp va delante: si una cadencia construye lo mismo, el nombre que vale es
  // el de ir al IV y volver.
  const borradores: Borrador[] = [...alCuartoYVuelta(id, original)];
  const empuja = (
    partes: ParteDeSalida[],
    valor: number,
    familia: string,
    nombre: string,
    que: string,
  ) =>
    borradores.push({
      path: 'seguir',
      partes,
      nombre,
      que,
      prioridad: prioridadDe(valor + ajuste),
      familia,
      // Lo que se llama cierre completa lo tuyo; lo demás es la parte que sigue.
      loQueSeAnade:
        partes[0]!.name === CIERRE.nombre || partes[0]!.name === CONSECUENTE.nombre
          ? 'tuya'
          : partes[0]!.name === OTRO_ESTRIBILLO.nombre
            ? 'misma'
            : 'otra',
    });

  for (const añadir of largosQueCuadran(id, original)) {
    // Sin tope de acordes: el de compases ya lo pone `largosQueCuadran`, dos frases
    // como mucho. Contarlo en acordes dejaba sin frase nueva todo lo que va a dos
    // pulsos —una frase son ocho acordes, y completar la tuya y añadir otra, diez—,
    // y una canción larga a dos pulsos se quedaba con un solo cierre posible.
    const reparto = repartir(id, original, añadir, true);
    if (reparto === null) {
      continue;
    }

    // La llegada: si para cuadrar la frase falta un compás, la tónica en ese
    // compás. Es lo que pide una dominante, y no se podía: la parte más corta
    // medía dos compases. **Un compás, no más**: cuadrar estirando un acorde
    // —una I de cuatro compases detrás de un V— es relleno, no música. Y con un
    // compás de sitio no hay línea de bajo que continuar (`siguenLaLinea`): la
    // llegada es lo único que cabe.
    if (reparto.length === 1) {
      // Si tu último compás se oyó con duda, la llegada de un compás descansa entera
      // en él: si el micro se equivocó, no cierra. Mejor una frase que traiga su
      // propia cadencia (lo pidió el corpus final).
      if (!dudaElUltimo && ultimo !== tonica && canFollow(id.mode, ultimo, tonica)) {
        const especie = especieNueva(id, tonica, null);
        empuja(
          [
            {
              name: CIERRE.nombre,
              yours: false,
              steps: [paso(tonica, reparto[0]!, null, especie)],
            },
          ],
          valorDeCierre(id, antes, ultimo, [tonica]),
          'resuelve',
          aLaTonica,
          `Añade la llegada: de tu ${ultimo} a la ${tonica}, ${comoLlega(id, ultimo, id.especies.at(-1) ?? null)}${(pulsosDe(original) + añadir) % id.frase === 0 ? ', y la frase cuadra' : ''}.`,
        );
      }
      continue;
    }

    // Una frase que cuadra, compás a compás y al ritmo de lo tuyo: la que resuelve
    // ya y sigue hasta cerrar, la que prepara la llegada con un ii–V, la plagal…
    // `cierresDesde` reparte las mejores por cómo llegan.
    // Si la parte va a llamarse estrofa o estribillo pase lo que pase, empieza como
    // empiezan; si no, el nombre ya lo decide por dónde empieza (abajo).
    const empieza = primerosDeLoQueSigue(
      id,
      original,
      ultimo === tonica || reparto.length > LARGO_DE_UNA_FRASE
        ? empiezaPor(id, LO_QUE_CIERRA[id.papel], ultimo)
        : null,
    );
    for (const cierre of cierresDesde(id, antes, ultimo, reparto.length, 4, empieza)) {
      const steps = nuevos(id, cierre.grados, reparto);
      const penultimo = [ultimo, ...cierre.grados].at(-2)!;
      const grados = cierre.grados.join(' ');
      const resuelve = ultimo !== tonica && cierre.grados[0] === tonica;
      // Si completa el periodo de lo tuyo —tu cabeza otra vez y en casa—, es su
      // consecuente, y se llama así: el juez lo cuenta como un periodo, y el nombre
      // no puede decir «estribillo» mientras el motivo dice otra cosa.
      const nombreDeLaParte = completaElPeriodo(id, original, steps)
        ? CONSECUENTE
        : ultimo === tonica || resuelve || reparto.length > LARGO_DE_UNA_FRASE
          ? (otraVez(id, steps) ?? LO_QUE_CIERRA[id.papel])
          : CIERRE;
      // Una frase larga va en dos partes: lo que se va y el cierre que vuelve.
      const corte =
        steps.length > LARGO_DE_UNA_FRASE ? steps.length - (steps.length >= 8 ? 4 : 2) : 0;
      const partes: ParteDeSalida[] =
        corte === 0
          ? [{ name: nombreDeLaParte.nombre, yours: false, steps }]
          : [
              { name: nombreDeLaParte.nombre, yours: false, steps: steps.slice(0, corte) },
              { name: CIERRE.nombre, yours: false, steps: steps.slice(corte) },
            ];
      const como = comoLlega(id, penultimo, steps.at(-2)?.especie ?? null);
      const empieza = resuelve ? `${aLaTonica} y añade ` : 'Añade ';
      const esConsecuente = nombreDeLaParte === CONSECUENTE;
      empuja(
        partes,
        // Lo que completa la forma va por delante de lo que la deja abierta.
        cierre.valor - (resuelve && dudaElUltimo ? 0.5 : 0) + (esConsecuente ? 1 : 0),
        `${resuelve ? 'resuelve' : 'cierre'}:${penultimo}`,
        laQueQuepa(
          LARGO_MAXIMO_DEL_NOMBRE,
          `${nombreDeLaParte.nombre}: ${grados}`,
          `${nombreDeLaParte.nombre} de ${steps.length} acordes`,
        ),
        esConsecuente
          ? laQueQuepa(
              LARGO_MAXIMO_DE_LO_QUE_HACE,
              `Añade el consecuente, ${grados}: tu misma cabeza, y llega a la tónica ${como}. Un periodo entero.`,
              `Añade el consecuente: tu misma cabeza, y llega a la tónica ${como}. Un periodo entero.`,
            )
          : laQueQuepa(
              LARGO_MAXIMO_DE_LO_QUE_HACE,
              `${empieza}${conArticulo(nombreDeLaParte)}, ${grados}, que llega a la tónica ${como}.`,
              `${empieza}${conArticulo(nombreDeLaParte)} de ${steps.length} acordes que llega a la tónica ${como}.`,
            ),
      );
    }
  }

  const segunda = segundaVuelta(id, original);
  if (segunda !== null) {
    borradores.push({ ...segunda, prioridad: segunda.prioridad + 2 * ajuste });
  }
  return borradores;
}

/**
 * Lo que sigue a un vamp de un acorde: el mismo vamp en la subdominante y vuelta a
 * casa, `IV7 IV7 I7 I7` detrás de cuatro de I7.
 *
 * Es lo que hace cualquiera con un funk, un soul o un blues que se queda en un
 * acorde: el segundo bloque se va un cuarto arriba y vuelve, y la forma es la del
 * blues. Las cadencias no lo encontraban —desde la tónica sola el camino mejor
 * valorado es una frase que pasa por todo—, y lo que salía era un ii–V–I de
 * manual pegado a un vamp. Con la mitad de lo nuevo en el IV y la otra mitad en
 * casa, al paso de lo tuyo.
 */
function alCuartoYVuelta(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const tonica = id.tonica;
  if (original.length < 2 || original.some((paso) => paso.degree !== tonica)) {
    return [];
  }
  const cuarto: DegreeSymbol = id.mode === 'major' ? 'IV' : 'iv';
  const [añadir] = largosQueCuadran(id, original);
  const reparto = repartir(id, original, añadir!);
  // Con la canción casi en el tope no cabe ir y volver.
  if (reparto === null || reparto.length < 2) {
    return [];
  }
  const fuera = Math.ceil(reparto.length / 2);
  const grados = reparto.map((_, k) => (k < fuera ? cuarto : tonica));
  const dicho = grados.join(' ');
  return [
    {
      path: 'seguir',
      partes: [
        { name: LO_QUE_CIERRA[id.papel].nombre, yours: false, steps: nuevos(id, grados, reparto) },
      ],
      nombre: `Al ${cuarto} y vuelta: ${dicho}`,
      que: `Añade ${conArticulo(LO_QUE_CIERRA[id.papel])}, ${dicho}: tu vamp se va a la subdominante, ${cuarto}, y vuelve a casa, como el segundo bloque de un blues.`,
      prioridad: prioridadDe(2.5),
      familia: 'vamp',
      loQueSeAnade: 'otra',
    },
  ];
}

/**
 * **Una parte que baja hasta el reposo frigio** (`centroFrigio`, la misma regla que el
 * juez y que la comprobación de `seguir`): lo que sigue llega al centro —el V mayor
 * de un menor— por el semitono de encima, o desde el iv en un flamenco, y se para
 * ahí, que es donde se para una copla. Las cadencias no lo construyen —todas acaban
 * en la tónica—, y a una andaluza solo le salía el `V i` de cualquier menor.
 *
 * **En un flamenco es un contraste**: lo que hace esa parte es irse y volver a tu
 * principio por su dominante, que es lo que un contraste promete, y así lo pidieron
 * sus casos. **En una andaluza sin estilo es un seguir**: lo tuyo ya reposa en el V,
 * y lo que sigue acaba como acaba ella, sin resolverlo a la i. Se busca por el grafo
 * sin pasar por casa en una de cuatro —el V que resuelve en tu i se la gastaría—:
 * sale `III VII VI V`, la copla que pasa por el relativo y baja, o la andaluza desde
 * el VII. Dos por largo, que no empiecen igual. Acabar con la bajada entera, `VII VI
 * V`, suma: es el idioma, no un camino más.
 */
function bajadaAndaluza(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const primero = original[0]!.degree;
  const frigio = centroFrigio(
    id.mode,
    id.estilo,
    original.map((paso) => paso.degree),
  );
  const flamenco = id.estilo === 'flamenco';
  // Y en un flamenco, desde el centro tiene que poder volver a tu principio: es lo
  // que hace un contraste.
  if (frigio === null || (flamenco && !canFollow(id.mode, frigio.centro, primero))) {
    return [];
  }
  const { centro, llegan } = frigio;
  const ultimo = original.at(-1)!.degree;
  const parte = flamenco ? LO_QUE_CONTRASTA[id.papel] : CIERRE;
  const de = flamenco ? 'del flamenco' : 'de la andaluza';
  return largosQueCuadran(id, original).flatMap((añadir) => {
    const reparto = repartir(id, original, añadir);
    if (reparto === null || reparto.length < 2) {
      return [];
    }
    const n = reparto.length;
    // Sin estilo, lo que sigue a una andaluza que reposa vuelve a empezar desde la i
    // —su V va a la i, no al VI ni al iv— y baja otra vez por otro camino: la misma
    // bajada sería tu frase repetida, no lo que sigue.
    const admite: Admite = (grado, i, previo) =>
      i === n - 1
        ? grado === centro && llegan.includes(previo)
        : !flamenco && i === 0
          ? grado === id.tonica
          : grado !== centro && (grado !== id.tonica || (n >= 5 && i >= 1 && i <= n - 3));
    const tuyos = original.map((paso) => paso.degree).join(' ');
    const caminos = buscarCaminos(id, ultimo, n, admite)
      .filter((grados) => flamenco || grados.join(' ') !== tuyos)
      .map((grados) => ({
        grados,
        valor:
          media(saltosDelCamino(id, ultimo, grados)) +
          precioDelCamino(id, grados) +
          ([ultimo, ...grados].slice(-3).join(' ') === 'VII VI V' ? 0.5 : 0),
      }));
    return distintos(caminos, (camino) => camino.grados[0]!, 2).map((camino) => {
      const dicho = camino.grados.join(' ');
      const vuelta = !flamenco
        ? ', sin resolverlo a la tónica'
        : esSuDominante(id, centro, primero)
          ? `, y de ahí vuelve a tu ${primero} desde su dominante`
          : `, y de ahí vuelve a tu ${primero}`;
      return {
        path: flamenco ? ('contraste' as const) : ('seguir' as const),
        partes: [{ name: parte.nombre, yours: false, steps: nuevos(id, camino.grados, reparto) }],
        loQueSeAnade: flamenco ? ('otra' as const) : ('tuya' as const),
        nombre: laQueQuepa(
          LARGO_MAXIMO_DEL_NOMBRE,
          `${conArticuloArriba(parte)} hasta el ${centro}: ${dicho}`,
          `${conArticuloArriba(parte)} hasta el ${centro}`,
        ),
        que: laQueQuepa(
          LARGO_MAXIMO_DE_LO_QUE_HACE,
          `Añade ${conArticulo(parte)}, ${dicho}, que llega al ${centro} por el ${camino.grados.at(-2)!} y reposa ahí, el final frigio ${de}${vuelta}.`,
          `Añade ${conArticulo(parte)}, ${dicho}, que reposa en el ${centro}: el final frigio ${de}.`,
        ),
        prioridad: prioridadDe(1 + camino.valor),
        familia: `reposo-frigio:${camino.grados[0]}`,
      };
    });
  });
}

/**
 * La segunda vuelta: tu frase otra vez, con el final cambiado para que cierre.
 *
 * Es el periodo de toda la vida —antecedente que se queda abierto, consecuente
 * que cierra— y es lo primero que propone cualquiera ante cuatro compases que
 * acaban en V. Cambia lo menos posible: el último compás, o los dos o tres
 * últimos si así llega mejor.
 */
function segundaVuelta(id: Idioma, original: readonly PathStep[]): Borrador | null {
  const largo = original.length;
  const ultimo = original.at(-1)!.degree;
  const total = pulsosDe(original);
  // Volver a empezar es lo que sigue a tu último compás, y una línea de bajo que no
  // ha llegado no vuelve al principio (`siguenLaLinea`).
  const linea = siguenLaLinea(id, original);
  if (
    // Lo que sigue a un pre o a un puente es el estribillo, no otra vez el pre: su
    // segunda vuelta volvía del V al ii (corpus final).
    id.papel === 'pre' ||
    id.papel === 'puente' ||
    (linea !== null && !linea.includes(original[0]!.degree)) ||
    ultimo === id.tonica ||
    (total % id.frase !== 0 && (largo * id.pulsos) % id.frase !== 0) ||
    total > 2 * id.frase ||
    largo * 2 > MAX_PATH_STEPS ||
    !canFollow(id.mode, ultimo, original[0]!.degree)
  ) {
    return null;
  }
  let mejor: { k: number; cierre: CaminoValorado; valor: number } | null = null;
  // Como mucho la mitad: cambiar tres compases de cuatro ya no es repetir tu frase.
  // Y lo que se repite no puede ser algo que el micro oyó con duda: tocarlo otra vez
  // es construir encima como si fuera seguro (el arreglista lo tachó en `I iii? vi
  // IV`). Lo que se cambia sí puede serlo: la segunda vuelta lo deja atrás.
  for (let k = 1; k <= Math.min(3, Math.floor(largo / 2)); k += 1) {
    if (id.dudosos.slice(0, largo - k).some((duda) => duda)) {
      continue;
    }
    const desde = original[largo - k - 1]!.degree;
    const antes = original[largo - k - 2]?.degree ?? null;
    const [cierre] = cierresDesde(id, antes, desde, k, 1);
    const valor = cierre === undefined ? -Infinity : cierre.valor - 0.3 * (k - 1);
    if (cierre !== undefined && (mejor === null || valor > mejor.valor)) {
      mejor = { k, cierre, valor };
    }
  }
  // Sin una manera de repetir que no copie lo dudoso, no hay segunda vuelta. Con un
  // compás que se puede tocar dos veces siempre hay un camino a casa en tres pasos:
  // lo vigila la prueba de todos los grados.
  if (mejor === null) {
    return null;
  }
  const { k, cierre } = mejor;
  // A los pulsos habituales: repetir una toma desigual copiaría su accidente.
  const copiados = original
    .slice(0, largo - k)
    .map((_, i) => ({ ...tuyo(id, original, i), beats: id.pulsos }));
  const cambiados = cierre.grados.map((degree) =>
    paso(degree, id.pulsos, null, especieNueva(id, degree, null)),
  );
  const penultimo = [original[largo - k - 1]!.degree, ...cierre.grados].at(-2)!;
  return {
    path: 'seguir',
    partes: [{ name: 'Segunda vuelta', yours: false, steps: [...copiados, ...cambiados] }],
    loQueSeAnade: 'misma',
    nombre: 'Segunda vuelta que cierra',
    que: laQueQuepa(
      LARGO_MAXIMO_DE_LO_QUE_HACE,
      `Repite tu frase y la cierra: los últimos ${k === 1 ? 'compás pasa' : `${k} compases pasan`} a ${cierre.grados.join(' ')}, que llega a la tónica ${comoLlega(id, penultimo, cambiados.at(-2)?.especie ?? null)}.`,
      `Repite tu frase y la cierra en la tónica, ${comoLlega(id, penultimo, null)}.`,
    ).replace('los últimos compás pasa', 'el último compás pasa'),
    prioridad: prioridadDe(mejor.valor + 0.3),
    familia: 'segunda-vuelta',
  };
}

/**
 * Un blues que acaba en el giro del final se cierra con la tónica en el compás 13:
 * el compás fuerte que abre el coro siguiente, que es donde acaba un blues.
 */
function llegadaDelBlues(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const ultimo = original.at(-1)!.degree;
  if (ultimo === id.tonica || !canFollow(id.mode, ultimo, id.tonica)) {
    return [];
  }
  const tonica = id.tonica;
  return [
    {
      path: 'seguir',
      partes: [
        {
          name: CIERRE.nombre,
          yours: false,
          steps: [paso(tonica, id.compas, null, especieNueva(id, tonica, null))],
        },
      ],
      nombre: `Acaba en la ${tonica} del 13`,
      loQueSeAnade: 'tuya',
      que: `Añade la llegada: de tu ${ultimo} a la ${tonica} en el compás 13, el que abriría otro coro, ${comoLlega(id, ultimo, id.especies.at(-1) ?? null)}.`,
      prioridad: prioridadDe(2.8),
      familia: 'resuelve',
    },
  ];
}

/** Si lo tuyo son los ocho primeros compases de un blues, compás a compás (`bluesAMedias`). */
function esUnBluesAMedias(id: Idioma, original: readonly PathStep[]): boolean {
  return (
    original.every((paso) => paso.beats === id.compas) &&
    bluesAMedias(id.mode, (compas) => original[compas]?.degree, original.length, {
      ...(id.estilo === undefined || id.estilo === null ? {} : { estilo: id.estilo }),
      especies: id.especies,
    })
  );
}

/**
 * **Los cuatro compases que le faltan a un blues**: la dominante en el 9 —o lo que
 * la prepara—, la vuelta del 10 y la tónica del 11 y el 12.
 *
 * Con los ocho primeros de un blues, lo que salía eran frases de ocho llamadas
 * estribillo, y la canción acababa en un blues de dieciséis. Lo que hace cualquiera
 * es acabar el coro: el de Chicago (`V IV I I`), el de jazz (`ii V I I`) y el del
 * II7 delante del V; en menor, el `V iv i i`, el VI7 que baja al V y la ii°. Acaban
 * en la tónica porque seguir cierra en casa; el turnaround del 12 lo pone otro coro.
 */
function completarElBlues(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const tonica = id.tonica;
  const formas: readonly (readonly [DegreeSymbol[], string, number])[] =
    id.mode === 'major'
      ? [
          [
            ['V', 'IV', tonica, tonica],
            'la dominante en el 9 y el IV en el 10, el de siempre',
            2.6,
          ],
          [
            ['ii', 'V', tonica, tonica],
            'ii V en el 9 y el 10, el giro del blues de jazz',
            2 + id.secundaria,
          ],
          [
            ['V/V', 'V', tonica, tonica],
            'el II7 en el 9, que prepara el V del 10',
            1.8 + id.secundaria,
          ],
        ]
      : [
          [
            ['V', 'iv', tonica, tonica],
            'la dominante en el 9 y el iv en el 10, el de siempre',
            2.6,
          ],
          [['VI', 'V', tonica, tonica], 'el VI7 en el 9, que baja medio tono al V del 10', 2.3],
          [
            ['ii°', 'V', tonica, tonica],
            'la ii° en el 9 y el V en el 10, la cadencia del menor',
            2,
          ],
        ];
  return formas
    .filter(([grados]) =>
      [original.at(-1)!.degree, ...grados].every(
        (grado, i, todos) => i === 0 || canFollow(id.mode, todos[i - 1]!, grado),
      ),
    )
    .map(([grados, como, valor]) => ({
      path: 'seguir' as const,
      partes: [
        {
          name: CIERRE.nombre,
          yours: false,
          steps: grados.map((grado) => paso(grado, id.compas, null, especieNueva(id, grado, null))),
        },
      ],
      loQueSeAnade: 'tuya' as const,
      nombre: `Acaba el blues: ${grados.join(' ')}`,
      que: `Completa los doce compases del blues: ${grados.join(' ')}, con ${como}, y cierra en la ${tonica}.`,
      prioridad: prioridadDe(valor),
      familia: `acaba-el-blues:${grados[0]}`,
    }));
}

/**
 * Otro coro de blues: la forma otra vez, que acaba en casa. Lo que sigue a un
 * blues es otro coro, no un puente ni una cadencia de dos compases.
 */
function coros(id: Idioma, original: readonly PathStep[]): Borrador[] {
  // Un coro de doce más otro caben siempre: el tope es de treinta y dos.
  const tonica = id.tonica;
  const cuarto: DegreeSymbol = id.mode === 'major' ? 'IV' : 'iv';
  const grados = original.map((paso) => paso.degree);
  const cierra = [...grados];
  let como: string;
  if (cierra[11] !== tonica) {
    cierra[11] = tonica;
    como = `sin el giro del final: acaba en la ${tonica}`;
  } else {
    cierra[1] = cierra[1] === tonica ? cuarto : tonica;
    como = `${cierra[1] === cuarto ? 'con' : 'sin'} el cambio rápido al ${cuarto} en su compás 2, y acaba en la ${tonica}`;
  }
  // Las variantes salen de tu coro si ya acababa en casa, y si no, del que cierra:
  // tocar el compás 2 y el 9 a la vez sería otro blues, no otro coro del tuyo.
  const base = grados[11] === tonica ? grados : cierra;
  // Con el cambio rápido puesto o quitado.
  const conCambio = [...cierra];
  conCambio[1] = cierra[1] === tonica ? cuarto : tonica;
  // El 9 y el 10 preparando la dominante: el ii–V del blues de jazz, o el II7.
  const segundo: DegreeSymbol = id.mode === 'major' ? 'ii' : 'ii°';
  const deJazz = [...base];
  deJazz[8] = segundo;
  deJazz[9] = 'V';
  const conII7 = [...base];
  conII7[8] = 'V/V';
  conII7[9] = 'V';
  // Sin tocar los compases que hacen la forma (1, 5, 7 y 9): el 10 en V o en IV.
  const diez = [...base];
  diez[9] = base[9] === 'V' ? cuarto : 'V';
  // Y el VI7 en el 8, que **va a su ii**: `I VI7 | ii7 | V7`, el blues de jazz
  // entero. Antes el VI7 caía en el V del 9, y una dominante que no llega a lo que
  // prepara es una promesa rota, no un color.
  const conVI7 = [...base];
  if (id.mode === 'major') {
    conVI7[7] = 'V/ii';
    conVI7[8] = 'ii';
    conVI7[9] = 'V';
  }
  const montar = (nuevos: readonly DegreeSymbol[]): PasoPosible[] =>
    nuevos.map((degree, i) =>
      degree === grados[i]
        ? tuyo(id, original, i)
        : paso(degree, original[i]!.beats, null, especieNueva(id, degree, null)),
    );
  // Los compases se cuentan **dentro del coro nuevo** y se dice así —«en su compás
  // 9»—: «en el 9» de la canción entera es tu coro, que no cambia.
  const coro = (
    nuevos: readonly DegreeSymbol[],
    nombre: string,
    que: string,
    valor: number,
    familia: string,
  ): Borrador => ({
    path: 'seguir',
    partes: [{ name: 'Otro coro', yours: false, steps: montar(nuevos) }],
    loQueSeAnade: 'misma',
    nombre,
    que: `Añade otro coro de doce compases, ${que}.`,
    prioridad: prioridadDe(valor),
    familia,
  });
  const delBlues = id.estilo === 'blues' ? 0.5 : 0;
  const cambio = conCambio[1] === cuarto ? 'con' : 'sin';
  return [
    coro(cierra, 'Otro coro que cierra', como, 2.5 + delBlues, 'coro'),
    coro(
      conCambio,
      `Otro coro ${cambio} cambio rápido`,
      `${cambio} el cambio rápido al ${cuarto} en su compás 2, y acaba en la ${tonica}`,
      2.2 + delBlues,
      'coro-cambio',
    ),
    coro(
      deJazz,
      `Otro coro con ${segundo} V en su compás 9`,
      `con ${segundo} V en sus compases 9 y 10, el giro del blues de jazz, y acaba en la ${tonica}`,
      1.6 + id.secundaria + (id.estilo === 'jazz' ? 0.6 : 0),
      'coro-jazz',
    ),
    coro(
      conII7,
      'Otro coro con el II7 en su compás 9',
      `con el II7, la dominante de la dominante, en su compás 9, y acaba en la ${tonica}`,
      1.6 + id.secundaria,
      'coro-ii7',
    ),
    coro(
      diez,
      `Otro coro con el ${diez[9]} en su compás 10`,
      `con el ${diez[9]} en su compás 10, y acaba en la ${tonica}`,
      2,
      'coro-diez',
    ),
    coro(
      conVI7,
      'Otro coro con el VI7 en su compás 8',
      `con el VI7 en su compás 8, que lleva al ii del 9 y al V del 10, y acaba en la ${tonica}`,
      1.5 + id.secundaria,
      'coro-vi7',
    ),
  ];
}

/**
 * Lo que sigue a lo tuyo: las que cierran y las que contrastan.
 *
 * **Una entrada no se continúa cerrando**: lo que viene detrás es la estrofa, que
 * sale de ella y no la termina, y cerrar ahí es tratarla como una canción acabada.
 * Solo si no hay ninguna parte que se vaya y vuelva —una entrada que empieza en un
 * acorde al que no vuelve nadie— queda cerrar, antes que no ofrecer nada.
 *
 * **Y al revés con lo que lleva a una llegada**: detrás de un pre viene el
 * estribillo, detrás de un puente la vuelta a casa y detrás de un final, la coda.
 * Otra parte que se va y vuelve al principio de la tuya es contestar a un pre con
 * otro pre: el arreglista la tachaba arriba del menú, y el juez solo la bajaba un
 * punto. Si los cierres no dan para elegir —tres—, queda contrastar antes que dejar
 * el menú sin nada.
 */
/**
 * Lo que le falta a la forma de lo tuyo (`formasDe`, la misma vara que el juez), si
 * se reconoce en compases enteros y es eso lo que falta.
 */
function faltaALaForma(
  id: Idioma,
  original: readonly PathStep[],
  que: LoQueFalta['que'],
): LoQueFalta | null {
  const compases = compasesDe(original, id.compas);
  const formas = compases === null ? [] : formasDe(id.mode, compases);
  return formas.find((forma) => forma.falta?.que === que)?.falta ?? null;
}

/** El consecuente de un periodo: tu cabeza otra vez, y cierra en casa. */
const CONSECUENTE: NombreDeParte = { nombre: 'Consecuente', un: 'un' };

/**
 * Si lo que se añade **es el consecuente que le falta a lo tuyo** (`formasDe`): mide
 * lo que falta, empieza repitiendo tu cabeza compás a compás y acaba en la tónica.
 * Detrás de un pre o de un puente no: lo que viene es el estribillo, otra parte, y
 * cerrar ahí sería quitarle la llegada.
 */
function completaElPeriodo(
  id: Idioma,
  original: readonly PathStep[],
  nuevos: readonly PathStep[],
): boolean {
  const falta = faltaALaForma(id, original, 'consecuente');
  if (falta === null || id.papel === 'pre' || id.papel === 'puente') {
    return false;
  }
  const cabeza = pasosDelTramo(original, id.compas, falta.repite!);
  return (
    cabeza !== null &&
    pulsosDe(nuevos) === falta.compases * id.compas &&
    nuevos.at(-1)!.degree === id.tonica &&
    cabeza.every((paso, i) => nuevos[i]?.degree === paso.degree && nuevos[i]!.beats === paso.beats)
  );
}

/** Cómo se llama la última sección de una AABA cuando se añade: lo tuyo otra vez. */
const ULTIMA_VUELTA: NombreDeParte = { nombre: 'Última vuelta', un: 'una' };

/**
 * **La última sección de una AABA**: con dos secciones que empiezan igual y una que
 * contrasta, lo que falta es volver a la primera y cerrar. Si alguna de tus dos
 * primeras ya cerraba en casa, vuelve esa tal cual —la segunda antes, que es la que
 * suele cerrar—; si no, su cabeza y un cierre en la tónica (`cierresDesde`).
 *
 * Sin esto, a `AAB` se le proponía otra frase cualquiera, y la forma más corriente de
 * un estándar se quedaba sin su vuelta.
 */
function laUltimaVuelta(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const falta = faltaALaForma(id, original, 'ultima-a');
  const tuyos = original.map((_, i) => tuyo(id, original, i));
  const copia = falta === null ? null : pasosDelTramo(tuyos, id.compas, falta.repite!);
  if (falta === null || copia === null) {
    return [];
  }
  const entera = falta.repite!.compases === falta.compases;
  const quedan = falta.compases - falta.repite!.compases;
  const [cierre] = entera
    ? []
    : cierresDesde(id, copia.at(-2)?.degree ?? null, copia.at(-1)!.degree, quedan, 1);
  /* v8 ignore next 3 -- desde cualquier grado hay un camino a casa en dos compases o mas: lo vigila la prueba de todos los grados de la segunda vuelta */
  if (!entera && cierre === undefined) {
    return [];
  }
  const cierran =
    cierre === undefined
      ? []
      : cierre.grados.map((grado) => paso(grado, id.compas, null, especieNueva(id, grado, null)));
  const dicho = copia.map((pasoTuyo) => pasoTuyo.degree).join(' ');
  return [
    {
      path: 'seguir',
      partes: [{ name: ULTIMA_VUELTA.nombre, yours: false, steps: [...copia, ...cierran] }],
      loQueSeAnade: 'misma',
      nombre: 'Vuelve tu primera parte: la AABA entera',
      que:
        cierre === undefined
          ? `Vuelve tu parte del principio, ${dicho}, que ya cerraba en la ${id.tonica}: con ella la forma AABA queda entera.`
          : `Vuelve tu parte del principio, ${dicho}, y llega a la ${id.tonica} por ${cierre.grados.join(' ')}: la forma AABA queda entera.`,
      prioridad: prioridadDe(2.6),
      familia: 'aaba',
    },
  ];
}

function continuarCon(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const cierran = [...laUltimaVuelta(id, original), ...continuaciones(id, original)];
  // Una forma empezada se completa antes de añadir otra parte.
  if (esUnBluesAMedias(id, original)) {
    return cierran;
  }
  const llevaALaLlegada = PIDEN_LLEGADA.has(id.papel) && cierran.length >= MINIMO_DEL_MENU;
  const vuelven = llevaALaLlegada ? [] : contrastes(id, original);
  return [...(id.papel === 'intro' && vuelven.length > 0 ? [] : cierran), ...vuelven];
}

/** Las partes detrás de las cuales viene una llegada y no otra parte que se va. */
const PIDEN_LLEGADA: ReadonlySet<SectionRole> = new Set(['pre', 'puente', 'final']);

/**
 * Lo que suena detrás del compás `i` de lo tuyo **según lo que es tu parte**.
 *
 * Detrás del último, `loQueSigue` supone un bucle —lo tuyo vuelve a empezar—, y
 * un pre o un puente no vuelven a su principio: llevan a la parte siguiente, que
 * entra en casa. Un final no tiene nada detrás. Es lo mismo que mira el juez
 * (`Juicio.bucle`): un V/vi al final de un puente prepara un vi que no va a sonar.
 */
function loQueSigueEnTuParte(
  id: Idioma,
  original: readonly PathStep[],
  i: number,
): DegreeSymbol | null {
  if (i < original.length - 1) {
    return original[i + 1]!.degree;
  }
  if (id.papel === 'final') {
    return null;
  }
  return id.papel === 'pre' || id.papel === 'puente' ? id.tonica : loQueSigue(id.mode, original, i);
}

/** Si unos grados suenan como lo tuyo, en el mismo orden y sin contar lo que se repite. */
function mismoGiro(grados: readonly DegreeSymbol[], original: readonly PathStep[]): boolean {
  const giro = (todos: readonly DegreeSymbol[]) =>
    todos.filter((grado, i) => i === 0 || grado !== todos[i - 1]).join(' ');
  return giro(grados) === giro(original.map((paso) => paso.degree));
}

/** Lo que pierde un retoque de un vamp de funk que no es su giro (`rearmonizaciones`). */
const DE_OTRO_IDIOMA = 1;

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

/** Contraste: partes que se van y saben volver a tu primer compás, del largo que cuadra la frase. */
function contrastes(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (id.blues) {
    return [];
  }
  const primero = original[0]!.degree;
  const ultimo = original.at(-1)!.degree;
  const parte = LO_QUE_CONTRASTA[id.papel];
  // Un vaivén modal se continúa yéndose y volviendo, no cerrando; después de un
  // puente o en un final, otro contraste es lo último que se busca.
  const ajuste =
    (id.centroModal === null ? 0 : 1.5) -
    (id.papel === 'puente' || id.papel === 'final' ? 1 : 0) +
    (id.papel === 'estrofa' || id.papel === 'pre' ? 0.5 : 0);
  const borradores: Borrador[] = [...bajadaAndaluza(id, original)];
  // Tras dos secciones que empiezan igual, lo que falta es la que contrasta
  // (`formasDe`): del largo de una sección, y sin empezar como ellas.
  const laQueFalta = faltaALaForma(id, original, 'b');
  for (const añadir of largosQueCuadran(id, original)) {
    const reparto = repartir(id, original, añadir);
    if (reparto === null || reparto.length < 2) {
      continue;
    }
    const empieza = primerosDeLoQueSigue(id, original, empiezaPor(id, parte, ultimo));
    for (const camino of partesQueVuelven(id, ultimo, reparto.length, primero, 4, empieza)) {
      const grados = camino.grados.join(' ');
      const final = camino.grados.at(-1)!;
      const fuera = [...new Set(camino.grados.filter((d) => !id.tuyos.has(d)))];
      const vuelta = esSuDominante(id, final, primero)
        ? `y vuelve a tu ${primero} desde su dominante, ${final}`
        : `y desde ${final} vuelve a tu ${primero}`;
      // La sección que contrasta tras tus dos que empiezan igual es la B de tu AABA:
      // se llama puente, y así la juzga el juez (`papelNuevo`).
      const esLaB =
        laQueFalta !== null &&
        añadir === laQueFalta.compases * id.compas &&
        camino.grados[0] !== laQueFalta.vuelveA;
      const suya = esLaB ? PUENTE : parte;
      borradores.push({
        path: 'contraste',
        partes: [{ name: suya.nombre, yours: false, steps: nuevos(id, camino.grados, reparto) }],
        loQueSeAnade: 'otra',
        ...(esLaB ? { papelNuevo: 'puente' as const } : {}),
        nombre: laQueQuepa(
          LARGO_MAXIMO_DEL_NOMBRE,
          `${conArticuloArriba(suya)} por ${grados}`,
          `${conArticuloArriba(suya)} de ${reparto.length} acordes`,
        ),
        que: laQueQuepa(
          LARGO_MAXIMO_DE_LO_QUE_HACE,
          `Añade ${conArticulo(suya)}, ${grados}, ` +
            (fuera.length > 0
              ? `que se va a ${fuera.join(' y ')} `
              : mismoGiro(camino.grados, original)
                ? 'que repite tus acordes '
                : 'que cambia el orden de tus acordes ') +
            `${vuelta}.`,
          `Añade ${conArticulo(suya)}, ${grados}, ${vuelta}.`,
        ),
        prioridad: prioridadDe(
          camino.valor +
            ajuste +
            // Lo que completa la forma va por delante de lo que la deja abierta.
            (esLaB ? 1 : 0),
        ),
        familia: `contraste:${camino.grados[0]}`,
      });
    }
  }
  return borradores;
}

/**
 * Lo que prefiere el generador de cada movimiento en su sitio, antes del estilo.
 * Son matices de oficio: el IV que pasa a ii delante del V hace un ii–V, el V que
 * pasa a iii pierde la dominante, y la interrumpida al final deja la canción
 * abierta a propósito.
 */
function preferencia(
  id: Idioma,
  move: MoveId,
  grado: DegreeSymbol,
  destino: DegreeSymbol,
  siguiente: DegreeSymbol | null,
  alFinal: boolean,
): number {
  switch (move) {
    case 'relativo':
    case 'funcion':
      // El ii o el ii° delante del V hacen un ii–V; quitarle al V su fundamental o su
      // sensible es perder la dominante.
      return (
        0.5 +
        ((destino === 'ii' || destino === 'ii°') && siguiente === 'V' ? 0.6 : 0) -
        (grado === 'V' || grado === 'v' ? 0.4 : 0)
      );
    case 'intercambio':
      return destino === 'iv' && siguiente === id.tonica
        ? 0.9
        : destino === 'V' && siguiente === id.tonica
          ? 1
          : grado === 'V'
            ? -0.3
            : 0.2;
    case 'prestamo':
      return 0.7;
    case 'interrumpida':
      return alFinal ? 0.9 : 0.6;
    case 'modal':
      return 0.5;
    case 'tritono':
      return 0.3 + 0.8 * id.tritono;
    case 'dominante':
      return destino.includes('/')
        ? 0.8
        : ['ii', 'IV', 'iv', 'ii°', 'bVI'].includes(grado)
          ? 0.6
          : 0.2;
    case 'predominante':
      // Tónica, subdominante, dominante: es lo primero que le hace un arreglista a un
      // V que llega sin preparar. El ii delante del V, si la canción ya prepara así.
      return 0.8 + (laIiEsDeCasa(id) && (destino === 'ii' || destino === 'ii°') ? 0.2 : 0);
    case 'cambio-rapido':
      // El retoque de manual del esquema de un blues, y el único que lo deja entero.
      return 1;
    case 'vaiven':
      // Lo que hace cualquiera con un vamp de funk: irse a un vecino y volver.
      return 1;
    case 'frigio':
      // Bajar medio tono a un centro es el idioma del menor —el de la andaluza, el del
      // flamenco, el del metal—. En mayor el semitono es prestado (el bVI, el bII), y
      // solo entra si el estilo los trae: en un country o un pop sin estilo era un
      // color de otra casa.
      return id.mode === 'major' ? -0.6 : id.estilo === 'flamenco' ? 1 : 0.4;
    case 'ii-v':
      // Partir la dominante en su ii es lo que hace el jazz con cualquier V largo; en
      // tríadas de pop también se oye, pero menos.
      return esFuncional(id) || id.lenguaje === 'septimas' ? 0.9 : 0.4;
  }
}

/** Un cambio de un compás que se puede hacer, con lo que vale. */
interface Cambio {
  readonly i: number;
  readonly move: Move;
  readonly destino: DegreeSymbol;
  readonly especie: EspecieDeBloque | null;
  readonly valor: number;
}

/**
 * Si un cambio deja el compás igual que el de al lado, o le pone al lado la otra
 * dominante del menor.
 *
 * Lo primero no es un sustituto, es alargar el vecino —`ii ii`, `V/V V/V`—, y
 * para que un acorde dure más está `estirar`: salían dieciséis así. Lo segundo es
 * la relación falsa del menor: la v y el V a la vez, con la sensible y sin ella
 * pegadas, como `i v V i`.
 */
function repiteAlVecino(
  destino: DegreeSymbol,
  anterior: DegreeSymbol | null,
  siguiente: DegreeSymbol | null,
): boolean {
  const vecinos = [anterior, siguiente];
  const otraDominante = destino === 'V' ? 'v' : destino === 'v' ? 'V' : null;
  return vecinos.includes(destino) || (otraDominante !== null && vecinos.includes(otraDominante));
}

/**
 * Si el movimiento es de verdad el que dice ser **con las especies que suenan**.
 *
 * Los movimientos se calculan con las tríadas del grado, y con otra especie pueden
 * dejar de ser lo que dicen: en quintas, «mayor por menor» de un IV5 da un iv5, que
 * son las mismas dos notas, y «su relativo» de un IV5 es un ii5 que no comparte
 * ninguna. Lo que no cambia el sonido no se construye, y cada movimiento conserva
 * lo que lo define: el relativo, dos notas en común; el sustituto tritonal, la
 * séptima que lleva el tritono.
 */
function esElMovimiento(
  id: Idioma,
  move: MoveId,
  grado: DegreeSymbol,
  especieDeAntes: EspecieDeBloque | null,
  destino: DegreeSymbol,
  especie: EspecieDeBloque | null,
): boolean {
  const antes = notasDelAcorde(id.mode, grado, especieDeAntes);
  const despues = notasDelAcorde(id.mode, destino, especie);
  const comunes = [...despues].filter((nota) => antes.has(nota)).length;
  if (comunes === antes.size && comunes === despues.size) {
    return false;
  }
  if (move === 'relativo' || move === 'funcion') {
    return comunes >= 2;
  }
  return move !== 'tritono' || especie === 'dominant7';
}

/**
 * Si un acorde de lo tuyo **hace de dominante** del que le sigue: es una dominante
 * por su grado —el V, el vii°, una secundaria— o por su especie —un I7, un VI7—, y
 * lo siguiente está una quinta por debajo, o medio tono si va por el sustituto.
 *
 * Es lo que la especie le cambia a un grado. En el gospel `I I7 IV iv I` el I7 no
 * es una tónica: es la dominante del IV, el V/IV que el catálogo no nombra, y
 * cambiarlo por «su relativo» —un vi— se cargaba la llegada al IV con la excusa de
 * que el I y el vi reposan igual. Lo que hace de dominante solo se cambia por algo
 * que siga siéndolo (`conservaLaDominante`).
 */
function haceDeDominante(
  mode: KeyMode,
  grado: DegreeSymbol,
  especie: EspecieDeBloque | null,
  siguiente: DegreeSymbol | null,
): boolean {
  if (
    siguiente === null ||
    !(roleOfDegreeSymbol(grado) === 'dominant' || grado.includes('/') || especie === 'dominant7')
  ) {
    return false;
  }
  const salto =
    (resolveDegree(0, mode, grado).root - resolveDegree(0, mode, siguiente).root + 12) % 12;
  return salto === 7 || salto === 1;
}

/** Si lo que entra sigue siendo una dominante: por su grado, por ser secundaria o por el tritono. */
function conservaLaDominante(move: MoveId, destino: DegreeSymbol): boolean {
  return move === 'tritono' || destino.includes('/') || roleOfDegreeSymbol(destino) === 'dominant';
}

/**
 * Dónde llega lo tuyo a casa **si llega antes del final y se queda**: el primer
 * compás de la tónica que acaba la canción, cuando dura más de un compás —`VI VII
 * i i`, `… IV V I I`—. Nulo si lo tuyo no acaba en la tónica, si la tónica final
 * es un compás solo o si todo es tónica.
 *
 * **La llegada es ese compás, no el último**: el segundo `i` de `VI VII i i` es la
 * llegada que se sostiene. Antes solo se guardaba el último compás, y salían `VI VII
 * VI i` o `VI VII V i`, que cambian justo el compás en el que la canción llega.
 */
function llegadaSostenida(id: Idioma, original: readonly PathStep[]): number | null {
  let desde = original.length - 1;
  if (original[desde]!.degree !== id.tonica) {
    return null;
  }
  while (desde > 0 && original[desde - 1]!.degree === id.tonica) {
    desde -= 1;
  }
  return desde > 0 && desde < original.length - 1 ? desde : null;
}

/**
 * Por qué un cambio es el que dice, **con lo que suena**: el del cambio modal habla
 * de la sensible, y en quintas no hay ninguna que ganar ni que perder.
 */
function porQueDelCambio(cambio: Cambio): string {
  return cambio.move.id === 'modal' && cambio.especie === 'quinta'
    ? 'En quintas no hay tercera ni sensible: los dos tiran a casa, y lo que cambia es el bajo.'
    : cambio.move.why;
}

/**
 * Si lo que entra **se puede tocar sobre el mismo bajo**: tiene la misma
 * fundamental, o lleva dentro la de lo que había y se toca invertido sobre ella
 * —el iv6 sobre el Fa del VI, la v sobre el Sol del VII—. Es lo que deja una línea
 * de bajo entera aunque cambie el acorde.
 */
function sobreElMismoBajo(
  mode: KeyMode,
  grado: DegreeSymbol,
  destino: DegreeSymbol,
  especie: EspecieDeBloque | null,
): boolean {
  const bajo = resolveDegree(0, mode, grado).root;
  // Invertido, solo un acorde de la escala: una dominante secundaria sobre la nota de
  // otro —el A7 sobre el Mi de `I ii iii IV`— tira a otro sitio, no armoniza la línea.
  return (
    resolveDegree(0, mode, destino).root === bajo ||
    (gradosDeLaEscala(mode).includes(destino) && notasDelAcorde(mode, destino, especie).has(bajo))
  );
}

/** Cuántas rearmonizaciones de un compás se construyen como mucho: las mejores. */
const MAX_CAMBIOS_SUELTOS = 12;

/**
 * Rearmonizar: cada movimiento donde cae bien, de uno en uno, y el mismo en todos
 * los compases donde cabe.
 *
 * **La tónica del primer compás y la llegada no se tocan**, que es lo que hacía
 * «donde cabe»: cambiaba la tónica del compás uno por su relativo y la canción
 * pasaba a estar en otra tonalidad. **Pero el compás 1 no siempre es la tónica**:
 * en un final `iv V i i`, un pre o un `ii V I` es la predominante, y cambiarla —el
 * ii° o el bII por el iv, el ii o el iv por el IV— es lo primero que haría un
 * arreglista (lo pidió el corpus final). Se toca si hace de subdominante y no es
 * el centro de un vaivén modal, que entonces es su tónica. La llegada solo se tuerce a propósito: con la interrumpida, que
 * existe para eso. Y un compás que el micro leyó con duda tampoco: rearmonizar lo
 * que no se sabe qué era es construir encima como si fuera seguro.
 */
function rearmonizaciones(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const ultimo = original.length - 1;
  const cambios: Cambio[] = [];
  // En un blues se retoca la vuelta, no el esquema: del 8 al 12 es donde el blues
  // de jazz pone su VI7, su ii–V y su turnaround; un ii en lugar del IV7 del cambio
  // rápido, o un iv en el 2, ya no es ese blues.
  const abreConLaPredominante =
    roleOfDegreeSymbol(original[0]!.degree) === 'subdominant' && id.centroModal === null;
  // **Y la tónica del compás 1 con tu punteo encima** se puede armonizar de otra
  // manera, si lo que entra comparte dos notas con ella y lleva todas las fuertes del
  // punteo. Se construye para que exista —en la balada menor del corpus final era lo
  // único que encajaba con el punteo, `i → III` con el Sol y el Mib—, y el juez le
  // pone su reparo de siempre: cambia el sitio donde la canción dice su tonalidad, y
  // solo entra por la red, cuando no hay tres mejores.
  const fuertesDelUno = (id.melodia[0] ?? []).filter((nota) => nota.fuerte);
  const tonicaConPunteo =
    original[0]!.degree === id.tonica && fuertesDelUno.length > 0 && id.centroModal === null;
  const desde = id.blues ? 7 : abreConLaPredominante || tonicaConPunteo ? 0 : 1;
  // El cambio rápido es la excepción del esquema: se mira también el compás 2.
  const primero = id.blues ? 1 : desde;
  // Y en un blues el 12 no es la llegada —esa es la tónica del 11— sino la vuelta
  // que lleva al coro siguiente: detrás del 12 viene otra vez el 1, y ahí va la V
  // del turnaround.
  const vuelveAEmpezar = id.blues && original[ultimo - 1]!.degree === id.tonica;
  // La llegada que se sostiene (`llegadaSostenida`) es el compás en el que llega, y
  // ese no se toca. Lo que la sostiene, según lo que acaba: en un periodo de dos
  // frases es el final y tampoco; en una frase sola es el sitio de la vuelta, y ahí
  // cabe el `VI VII i III` del arreglista —como en otro final (`otrosFinales`)—.
  const sostenida = llegadaSostenida(id, original);
  const llegada = sostenida ?? ultimo;
  // Si tu canción entera baja por grados —la andaluza—, la bajada es la forma: no se
  // le cambia el bajo a ningún compás (`esUnaBajada`, la vara del juez, que le pone
  // reparo). Otro acorde sobre la misma nota sí, **también uno que la lleva dentro**
  // y se toca con ella debajo: la v sobre el Sol del VII, el iv sobre el Fa del VI.
  // Sin eso la andaluza no tenía ni una rearmonización, y con punteo el menú se
  // quedaba vacío (lo encontró el corpus final).
  const esUnaLinea = esUnaBajada(
    id.mode,
    original.map((paso) => paso.degree),
  );
  const periodo = sostenida !== null && pulsosDe(original) > id.frase;
  for (let i = primero; i <= ultimo; i += 1) {
    const dudoso = id.dudosos[i] === true;
    const grado = original[i]!.degree;
    // Delante del compás 1 no hay nada: lo que entra solo tiene que llevar al 2.
    const anterior = original[i - 1]?.degree ?? null;
    const siguiente =
      vuelveAEmpezar && i === ultimo ? original[0]!.degree : loQueSigueEnTuParte(id, original, i);
    const vistos = new Set<DegreeSymbol>();
    // El compás del coro, para el cambio rápido, que no se ve en los vecinos.
    const entorno: Entorno = {
      anterior,
      siguiente,
      compasDelBlues: id.blues ? i % 12 : null,
      vampDeTonica: esUnVampDeFunk(id.mode, original, id.estilo),
    };
    for (const move of MOVES) {
      // En un blues, antes del 8 solo se pone o se quita el cambio rápido.
      if (i < desde && move.id !== 'cambio-rapido') {
        continue;
      }
      // Un compás que el micro leyó con duda no se rearmoniza encima: se corrige, con
      // lo que comparte dos notas con lo que se oyó —su relativo, el de su misma
      // función—, que es lo que probablemente sonó. Los dos arreglistas lo pidieron
      // así («cambiar lo dudoso por lo más probable»), y antes no se tocaba.
      if (dudoso && move.id !== 'relativo' && move.id !== 'funcion') {
        continue;
      }
      const esLaTonicaDelUno = i === 0 && grado === id.tonica;
      if (esLaTonicaDelUno && move.id !== 'relativo' && move.id !== 'funcion') {
        continue;
      }
      // Un vamp no llega: vuelve a empezar, y su último compás es tan del giro como
      // los demás (`vaiven`).
      const tocaLaLlegada =
        grado === id.tonica &&
        !vuelveAEmpezar &&
        move.id !== 'vaiven' &&
        ((i === llegada && move.id !== 'interrumpida') || (periodo && i > llegada));
      // La predominante tiene dos destinos, el ii y el IV, y los dos se prueban.
      for (const destino of destinosDelMovimiento(id.mode, grado, move.id, entorno)) {
        // Ni poner la tónica en medio: un relativo que da la I a mitad de frase no
        // cambia el color, adelanta la llegada. Quitar el cambio rápido sí la pone, y
        // es lo que hace: la tónica del 2 es la del esquema.
        const quitaElRapido = move.id === 'cambio-rapido';
        if (
          destino === grado ||
          (destino === id.tonica && !quitaElRapido) ||
          vistos.has(destino) ||
          tocaLaLlegada
        ) {
          continue;
        }
        const especie = especieNueva(id, destino, move.id);
        // Con séptima de dominante, el semitono frigio es el sustituto tritonal, y ese
        // solo vale donde había un V que sustituir: es el movimiento `tritono`.
        if (move.id === 'frigio' && especie === 'dominant7') {
          continue;
        }
        if (
          (esUnaLinea && !sobreElMismoBajo(id.mode, grado, destino, especie)) ||
          (repiteAlVecino(destino, anterior, siguiente) && !quitaElRapido) ||
          !esElMovimiento(id, move.id, grado, id.especies[i] ?? null, destino, especie) ||
          (haceDeDominante(id.mode, grado, id.especies[i] ?? null, siguiente) &&
            !conservaLaDominante(move.id, destino)) ||
          pierdeLaGama(id, id.especies[i] ?? null, destino)
        ) {
          continue;
        }
        const encaja =
          (anterior === null || canFollow(id.mode, anterior, destino) ? 1 : 0) +
          (siguiente === null || canFollow(id.mode, destino, siguiente) ? 1 : 0);
        const { fuertes, chocan, debiles } = choquesConElPunteo(id, i, destino, especie);
        // Delante de la tónica, lo que entra cierra con la fuerza que tenga en su
        // estilo, y lo que pierde respecto a lo tuyo se paga: el vii° por el V es
        // cambiar la cadencia de un pop por la de un coral. El sustituto tritonal no
        // pierde nada —lleva el mismo tritono, por eso es sustituto—, y lo que cueste
        // en tu estilo ya lo dice su precio.
        const pierde =
          siguiente === id.tonica && move.id !== 'tritono'
            ? Math.max(0, fuerzaDeCadencia(id, grado) - fuerzaDeCadencia(id, destino))
            : 0;
        // En una bajada, lo que entra se toca sobre la nota de la línea: es otra
        // manera de armonizarla, no un color que se trae. La v sobre el Sol del VII
        // de una andaluza no deshace el V que viene detrás (el arreglista la pidió).
        const precio = esUnaLinea
          ? Math.max(-0.3, precioDelGrado(id, destino))
          : precioDelGrado(id, destino);
        // En un vamp de funk lo de casa es irse y volver (`vaiven`): el relativo, la
        // misma función o el préstamo cambian el color de una balada, no el del vamp
        // —el IIImaj7 que tachó el arreglista en el quinto examen—.
        const fueraDelVamp =
          entorno.vampDeTonica === true && move.id !== 'vaiven' ? DE_OTRO_IDIOMA : 0;
        const valor =
          preferencia(id, move.id, grado, destino, siguiente, i === ultimo) +
          precio +
          0.25 * encaja -
          0.8 * chocan -
          pierde -
          fueraDelVamp;
        // Lo que vale menos que nada no se construye: una dominante en un riff
        // mixolidio, un préstamo en un folk que no lo usa. Que no esté es mejor que
        // dejárselo al juez.
        // La tónica del compás 1 solo cambia por lo que lleva todo tu punteo fuerte.
        const sostieneElPunteo = fuertesDelUno.every((nota) =>
          notasDelAcorde(id.mode, destino, especie).has(nota.nota),
        );
        if (
          encaja === 0 ||
          (fuertes > 0 && chocan === fuertes) ||
          valor < 0 ||
          (esLaTonicaDelUno && !sostieneElPunteo)
        ) {
          continue;
        }
        // Las débiles que rozan no la quitan —el arreglista de la verificación da por
        // bueno el iv bajo un La débil—, pero se miran **al elegir**: lo que no pisa tu
        // punteo va delante (corpus final, la balada menor).
        // El destino es de quien lo construye primero, no de quien lo intenta: el bII
        // que el tritono no puede poner sin séptima lo pone el semitono frigio.
        vistos.add(destino);
        cambios.push({ i, move, destino, especie, valor: valor - 0.4 * debiles });
      }
    }
  }

  const cancionCon = (elegidos: readonly Cambio[]): PasoPosible[] =>
    original.map((_, i) => {
      const cambio = elegidos.find((c) => c.i === i);
      return cambio === undefined
        ? tuyo(id, original, i)
        : paso(cambio.destino, original[i]!.beats, cambio.move.id, cambio.especie);
    });

  // De uno en uno: el mismo cambio en el mismo sitio no se ofrece dos veces.
  const vistos = new Set<string>();
  const sueltos = [...cambios]
    // Con el mismo valor, el más tardío: si el mismo cambio cabe en dos sitios es
    // que tu frase se repite, y lo que hace un arreglista es variar la repetición
    // —el II7 delante del V que cierra el consecuente—, no la primera vez.
    .sort((a, b) => b.valor - a.valor || b.i - a.i)
    .filter((cambio) => {
      // Con el destino: la predominante tiene dos en el mismo sitio, el ii y el IV.
      const clave = `${cambio.move.id}|${original[cambio.i - 1]?.degree}|${original[cambio.i]!.degree}|${original[cambio.i + 1]?.degree}|${cambio.destino}`;
      const nuevo = !vistos.has(clave);
      vistos.add(clave);
      return nuevo;
    })
    .slice(0, MAX_CAMBIOS_SUELTOS)
    .map((cambio) => {
      const cancion = cancionCon([cambio]);
      return {
        path: 'rearmonizar' as const,
        partes: retoque(cancion),
        nombre: `${nombreDelCambio(id.mode, cambio.move.id, original[cambio.i]!.degree, cambio.destino, cambio.especie)}, en el ${compasDelAcorde(id, original, cambio.i)}`,
        que: frase(`Cambia ${cambiosEnTexto(id, original, cancion)}.`, porQueDelCambio(cambio)),
        prioridad: prioridadDe(cambio.valor),
        familia: cambio.move.id,
      };
    });

  // El mismo movimiento en todos los compases donde cabe, sin dos seguidos: un
  // cambio mira a sus vecinos, y si los dos cambian ya no mira a lo que suena.
  const juntos = MOVES.flatMap((move) => {
    const elegidos: Cambio[] = [];
    for (const cambio of cambios.filter((c) => c.move.id === move.id)) {
      if (elegidos.at(-1) === undefined || cambio.i > elegidos.at(-1)!.i + 1) {
        elegidos.push(cambio);
      }
    }
    if (elegidos.length < 2) {
      return [];
    }
    const cancion = cancionCon(elegidos);
    // El intercambio puede ir en las dos direcciones a la vez —`I iv I IV`—, y
    // entonces se dice así.
    const nombres = new Set(
      elegidos.map((c) =>
        nombreDelCambio(id.mode, move.id, original[c.i]!.degree, c.destino, c.especie),
      ),
    );
    return [
      {
        path: 'rearmonizar' as const,
        partes: retoque(cancion),
        // En quintas el cambio modal no gana ni pierde sensible: se dice qué cambia.
        nombre: `${nombres.size === 1 ? [...nombres][0]! : elegidos.every((c) => c.especie === 'quinta') ? [...nombres].join(' y ') : `${move.name} y al revés`}, donde cabe`,
        que: frase(
          `Cambia ${cambiosEnTexto(id, original, cancion)}.`,
          porQueDelCambio(elegidos[0]!),
        ),
        prioridad: prioridadDe(media(elegidos.map((c) => c.valor)) - 0.15 * (elegidos.length - 1)),
        familia: move.id,
      },
    ];
  });
  return [...sueltos, ...juntos, ...sobreLaBajada(id, original, cambios, cancionCon)];
}

/** Cuántas dominantes partidas se ofrecen como mucho: las mejores. */
const MAX_PARTIDAS = 2;

/**
 * **La dominante partida en su ii y ella** (`partir.ts`): el V de un compás pasa a
 * `ii V` a medias, y el de dos, a `ii | V`. Es lo que hace el jazz con cualquier V
 * largo, y la secundaria igual —el V/V se parte en su ii y él—.
 *
 * Aparte de las demás rearmonizaciones porque cambia **cuántos** acordes hay: los
 * pulsos no se mueven, y la comprobación la empareja por pulsos
 * (`gruposPorPulsos`). Los dos acordes llevan el movimiento; el V se queda con su
 * especie, y el ii toma la del idioma de la canción —el ii7, la iiø7—.
 *
 * No se parte lo que el micro oyó con duda, ni lo que ya llega preparado, ni un
 * blues antes de su vuelta, que es el esquema.
 */
function partidas(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const ii = MOVES.find((move) => move.id === 'ii-v')!;
  const borradores: { borrador: Borrador; valor: number }[] = [];
  original.forEach((dominante, i) => {
    const anterior = original[i - 1]?.degree ?? null;
    // Un V suspendido ya se prepara a sí mismo: su cuarta es la que resuelve.
    const suspendido = id.especies[i] === 'sus4' || id.especies[i] === 'sus2';
    const partido =
      id.dudosos[i] === true || (id.blues && i < 7) || suspendido
        ? null
        : partirEnIiV(id.mode, dominante, {
            anterior,
            siguiente: loQueSigueEnTuParte(id, original, i),
          });
    if (partido === null) {
      return;
    }
    const [suIi, ella] = partido;
    const especie = especieNueva(id, suIi.degree, 'ii-v');
    const { fuertes, chocan } = choquesConElPunteo(id, i, suIi.degree, especie);
    const valor =
      preferencia(id, 'ii-v', dominante.degree, suIi.degree, dominante.degree, false) +
      precioDelGrado(id, suIi.degree) +
      (anterior === null || canFollow(id.mode, anterior, suIi.degree) ? 0.25 : 0) -
      0.8 * chocan;
    if ((fuertes > 0 && chocan === fuertes) || valor < 0) {
      return;
    }
    const pasos: PasoPosible[] = original.flatMap((_, k) =>
      k === i
        ? [
            paso(suIi.degree, suIi.beats, 'ii-v', especie),
            paso(ella.degree, ella.beats, 'ii-v', id.especies[i] ?? null),
          ]
        : [tuyo(id, original, k)],
    );
    const compas = compasDelAcorde(id, original, i);
    borradores.push({
      valor,
      borrador: {
        path: 'rearmonizar',
        partes: retoque(pasos),
        nombre: `${ii.name}, en el ${compas}`,
        que: frase(
          `Parte el ${dominante.degree} del ${compas}: la primera mitad pasa a ${suIi.degree}, que lo prepara, y la segunda sigue siendo ${dominante.degree}.`,
          'Llega preparada sin cambiar los pulsos.',
        ),
        prioridad: prioridadDe(valor),
        familia: 'ii-v',
      },
    });
  });
  return borradores
    .sort((a, b) => b.valor - a.valor)
    .slice(0, MAX_PARTIDAS)
    .map(({ borrador }) => borrador);
}

/**
 * **La bajada armonizada entera**: en una canción que baja por grados, cada acorde
 * que se puede tocar sobre la nota de la línea, todos a la vez. Es el lamento de
 * manual —`i v iv V` sobre `i VII VI V`, la v sobre el Sol y el iv sobre el Fa—, y
 * aquí sí van seguidos: el bajo no se mueve, así que cada uno sigue mirando a lo que
 * suena. Con el mejor de cada compás; si solo cabe uno, ya está entre los sueltos.
 */
function sobreLaBajada(
  id: Idioma,
  original: readonly PathStep[],
  cambios: readonly Cambio[],
  cancionCon: (elegidos: readonly Cambio[]) => PasoPosible[],
): Borrador[] {
  const linea = esUnaBajada(
    id.mode,
    original.map((paso) => paso.degree),
  );
  const invertidos = cambios.filter(
    (c) =>
      resolveDegree(0, id.mode, c.destino).root !==
      resolveDegree(0, id.mode, original[c.i]!.degree).root,
  );
  const mejores = [...new Set(invertidos.map((c) => c.i))].map(
    (i) => [...invertidos.filter((c) => c.i === i)].sort((a, b) => b.valor - a.valor)[0]!,
  );
  if (!linea || mejores.length < 2) {
    return [];
  }
  const cancion = cancionCon(mejores);
  return [
    {
      path: 'rearmonizar',
      partes: retoque(cancion),
      nombre: 'Otros acordes sobre tu bajada',
      que: frase(
        `Cambia ${cambiosEnTexto(id, original, cancion)}.`,
        'Cada uno se toca sobre la nota de tu bajo, y la línea que baja sigue entera: el lamento de siempre.',
      ),
      prioridad: prioridadDe(media(mejores.map((c) => c.valor)) - 0.1),
      familia: 'bajada',
    },
  ];
}

/**
 * Estirar: cuadrar lo grabado, a medio tiempo, a doble tiempo, y el último o el
 * primero el doble **si eso cuadra la frase**.
 *
 * Lo grabado desigual se cuadra antes de doblarlo o partirlo: a medio tiempo
 * heredaba el accidente de la toma —cinco y tres pasaban a diez y seis—. Y a doble
 * tiempo no deja compases de un pulso, que no son un compás sino un golpe.
 *
 * **Lo que dice cada una es lo que hace**: «el doble de largo» solo si cada acorde
 * dura el doble que en tu toma —con una toma desigual dura otra cosa, y se dice
 * cuánto—, y «cuadra lo que se tocó desigual» solo si se tocó desigual.
 */
function estiramientos(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const habitual = id.pulsos;
  const ultimo = original.length - 1;
  // La llegada sostenida no es un accidente de la toma: `I I7 IV iv I:8` acaba con
  // la tónica dos compases a propósito. Desigual es lo demás que no va a tu paso.
  const sostieneLaLlegada = (paso: PathStep, i: number) =>
    i === ultimo && paso.degree === id.tonica && paso.beats % habitual === 0;
  const desigual = original.some(
    (paso, i) => paso.beats !== habitual && !sostieneLaLlegada(paso, i),
  );
  const conPulsos = (pulsos: (paso: PathStep, i: number) => number) =>
    retoque(original.map((paso, i) => ({ ...tuyo(id, original, i), beats: pulsos(paso, i) })));
  const total = pulsosDe(original);
  const cuadraLaFrase = (extra: number) =>
    total % id.frase !== 0 && (total + extra) % id.frase === 0;
  // «Cuadra» es una promesa sobre el largo: solo se dice si lo que queda mide
  // frases enteras. Cuadrar a 4 pulsos `5 3 4 4 4` deja cinco compases, y eso no
  // cuadra nada aunque todos duren lo mismo.
  const enFrases = (cuantos: number, pulsos: number) => (cuantos * pulsos) % id.frase === 0;
  // Y ninguna sale del tope de compases de una canción (`MAX_PATH_STEPS`): treinta y
  // dos compases a medio tiempo son sesenta y cuatro, y eso ya no es tu canción
  // tocada más despacio, es una forma que no cabe en ninguna.
  const cabe = (pulsos: number) => pulsos <= MAX_PATH_STEPS * id.compas;
  const borradores: Borrador[] = [];

  if (desigual) {
    const cuadra = enFrases(original.length, habitual);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(() => habitual),
      nombre: `Cuadrada a ${habitual} pulsos`,
      que: cuadra
        ? `Los mismos acordes, cada compás a ${habitual} pulsos: cuadra lo que se tocó desigual.`
        : `Los mismos acordes, cada compás a ${habitual} pulsos: iguala lo que se tocó desigual.`,
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 9,
      familia: 'cuadrar',
    });
  }
  // Con una toma regular cada acorde dura el doble que en la tuya —la llegada
  // sostenida también—; con una desigual, todos lo mismo.
  const doble = (paso: PathStep) => (desigual ? habitual * 2 : paso.beats * 2);
  if (
    original.every((paso) => doble(paso) <= MAX_BEATS) &&
    cabe(pulsosDe(original.map((paso) => ({ ...paso, beats: doble(paso) }))))
  ) {
    const cuadra = desigual && enFrases(original.length, habitual * 2);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(doble),
      nombre: 'A medio tiempo',
      que: desigual
        ? `Los mismos acordes, todos a ${habitual * 2} pulsos: ${cuadra ? 'cuadra' : 'iguala'} lo que se tocó desigual y la canción respira.`
        : 'Los mismos acordes, cada uno el doble de largo: la canción respira.',
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 4.5,
      familia: 'medio-tiempo',
    });
  }
  // Y que quede una frase: una idea de dos compases a doble tiempo cabe en uno, y
  // eso es un golpe de riff, no una manera de tocar tu canción.
  const mitad = habitual / 2;
  const partido = (paso: PathStep) => (desigual ? mitad : paso.beats / 2);
  // Con el habitual par se parte entero, y la llegada sostenida también: dura un
  // múltiplo suyo.
  if (original.length * mitad >= 2 * id.compas && habitual % 2 === 0 && habitual >= 4) {
    const cuadra = desigual && enFrases(original.length, mitad);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(partido),
      nombre: 'A doble tiempo',
      que: desigual
        ? `Los mismos acordes, todos a ${mitad} pulsos: ${cuadra ? 'cuadra' : 'iguala'} lo que se tocó desigual y la armonía corre el doble.`
        : 'Los mismos acordes, cada uno la mitad de largo: la armonía corre el doble.',
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 4,
      familia: 'doble-tiempo',
    });
  }
  // Solo si lo último es la llegada: sostener un acorde abierto no cuadra nada, lo
  // deja colgando un compás más.
  const finalDoble = original[ultimo]!.beats;
  if (
    original[ultimo]!.degree === id.tonica &&
    finalDoble * 2 <= MAX_BEATS &&
    cuadraLaFrase(finalDoble) &&
    cabe(total + finalDoble)
  ) {
    borradores.push({
      path: 'estirar',
      partes: conPulsos((paso, i) => (i === ultimo ? paso.beats * 2 : paso.beats)),
      nombre: 'El último, el doble',
      que: `El último compás, ${original[ultimo]!.degree}, dura el doble: la llegada se sostiene y la frase cuadra.`,
      prioridad: 6,
      familia: 'el-ultimo',
    });
  }
  const primeroDoble = original[0]!.beats;
  if (
    original.length > 1 &&
    primeroDoble * 2 <= MAX_BEATS &&
    cuadraLaFrase(primeroDoble) &&
    cabe(total + primeroDoble)
  ) {
    borradores.push({
      path: 'estirar',
      partes: conPulsos((paso, i) => (i === 0 ? paso.beats * 2 : paso.beats)),
      nombre: 'El primero, el doble',
      que: `El primer compás, ${original[0]!.degree}, dura el doble: tarda más en arrancar y la frase cuadra.`,
      prioridad: 4.5,
      familia: 'el-primero',
    });
  }
  return [...borradores, ...unAcordeEstirado(id, original)];
}

/**
 * Un acorde solo, estirado hasta llenar una frase o recogido en un compás.
 *
 * Con un acorde no hay nada que rearmonizar —el único compás dice la tonalidad—,
 * pero sí cuánto dura: lo que se toca para buscar una canción suele ser eso, un
 * acorde sonando, y lo primero que se le pide es que dure una frase.
 */
function unAcordeEstirado(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (original.length !== 1) {
    return [];
  }
  const { degree, beats } = original[0]!;
  const borradores: Borrador[] = [];
  if (id.frase > beats * 2 && id.frase <= MAX_BEATS) {
    borradores.push({
      path: 'estirar',
      partes: retoque([{ ...tuyo(id, original, 0), beats: id.frase }]),
      nombre: 'Una frase entera',
      que: `El ${degree} dura ${id.frase / id.compas} compases, una frase entera: de ahí puede salir la canción.`,
      prioridad: 5,
      familia: 'la-frase',
    });
  }
  if (beats > id.compas && beats % id.compas === 0 && beats / 2 !== id.compas) {
    borradores.push({
      path: 'estirar',
      partes: retoque([{ ...tuyo(id, original, 0), beats: id.compas }]),
      nombre: 'En un compás',
      que: `El ${degree} dura un compás y no ${beats / id.compas}: lo mismo, sin esperar.`,
      prioridad: 3.5,
      familia: 'un-compas',
    });
  }
  return borradores;
}

/** Adónde puede ir otro final, y cómo se valora llegar ahí. */
interface Destino {
  readonly grado: DegreeSymbol;
  readonly nombre: string;
  /** Lo que hace, según el acorde de antes: el engaño solo existe después de una promesa. */
  readonly dice: string | ((penultimo: DegreeSymbol) => string);
  readonly valora: (
    desde: DegreeSymbol,
    antes: DegreeSymbol | null,
    grados: readonly DegreeSymbol[],
  ) => number;
}

/**
 * Otro final: llegar a la tónica, quedarse en la dominante o caer en el sexto
 * grado, **con los mismos compases**; y acabar antes, si se puede acabar en frase.
 *
 * Antes buscaba el cambio más tardío y no el mejor, y acortaba la canción un
 * compás para llegar antes: un 4 se quedaba en 3, un 12 en 11. Ahora el trozo nuevo
 * ocupa lo mismo que el que sustituye, y de los que llegan gana el que mejor
 * llega; a igualdad, el que toca menos.
 */
function otrosFinales(id: Idioma, original: readonly PathStep[]): Borrador[] {
  // Un acorde solo no tiene segunda mitad en compases, y sí en pulsos: se parte en
  // sus compases, o en dos mitades si dura uno, y otro final cambia la de detrás.
  // Es lo que deja darle a un acorde un acompañamiento —`I` pasa a `I V`— sin
  // tocar lo que dice la tonalidad, que es el principio.
  const base = original.length === 1 ? partirElAcorde(id, original[0]!) : original;
  const largo = base.length;
  const suelo = Math.ceil(largo / 2);
  const tonica = id.tonica;
  const sexto: DegreeSymbol = id.mode === 'major' ? 'vi' : 'VI';
  const ultimoTuyo = original.at(-1)!.degree;
  const valorDeLlegada = (
    desde: DegreeSymbol,
    grados: readonly DegreeSymbol[],
    premio: (penultimo: DegreeSymbol) => number,
  ) =>
    media(saltosDelCamino(id, desde, grados)) +
    precioDelCamino(id, grados) +
    premio([desde, ...grados].at(-2)!);
  // La llegada abierta de una canción sin sensible es la suya —el bVII de un riff
  // mixolidio, la v de un folk eólico, el VII si ya acabas en el bII—, no un V que
  // le metería la sensible que no tiene.
  const modal = id.modales.find((grado) => grado !== ultimoTuyo);
  const abierta: Destino =
    id.modales.length > 0 && modal !== undefined
      ? {
          grado: modal,
          nombre: `Se queda en el ${modal}`,
          dice: `acaba en ${modal}, abierto y sin sensible: pide seguir`,
          valora: (desde, _, grados) =>
            valorDeLlegada(desde, grados, (p) =>
              ['IV', 'iv', 'bVI', 'VI', 'III'].includes(p) ? 0.6 : 0,
            ),
        }
      : {
          grado: 'V',
          nombre: 'Se queda en la dominante',
          dice: 'acaba en V, abierto: pide seguir',
          valora: (desde, _, grados) =>
            valorDeLlegada(desde, grados, (p) =>
              ['ii', 'IV', 'iv', 'ii°', 'V/V', 'bVI', 'VI'].includes(p) ? 0.6 : 0,
            ),
        };
  // Cerrar en la tónica es otro final de lo que no cerraba; de lo que ya cerraba
  // es otra cadencia, y se dice así. Una entrada no se cierra: lleva a la estrofa.
  // Y un vaivén modal no se cierra en la tónica de la armadura, que no es su centro
  // (lo mismo que hace `continuaciones`).
  // Un acorde solo, aunque sea la tónica, no tenía cadencia: se le pone una.
  const yaCerraba = ultimoTuyo === tonica && original.length > 1;
  const cierra: Destino = {
    grado: tonica,
    nombre: yaCerraba
      ? 'Otra cadencia'
      : ultimoTuyo === tonica
        ? 'Una cadencia'
        : 'Cierra en la tónica',
    dice: yaCerraba
      ? 'llega a la tónica por otro camino'
      : ultimoTuyo === tonica
        ? 'sale de la tónica y vuelve a ella'
        : 'llega a la tónica',
    valora: (desde, antes, grados) => valorDeCierre(id, antes, desde, grados),
  };
  // Si lo tuyo llega antes del final y se queda en casa, la llegada es la de ese
  // compás (`llegadaSostenida`): otro final que cierra la prepara de otra manera, y
  // lo que la sostiene se queda. **Quedarse abierto depende de lo que llega**: una
  // frase que llega y se sostiene —`ii V I I`— tiene en el compás que sostiene el
  // sitio de la vuelta, y ahí cabe `ii V I vi`; un periodo de dos frases que
  // cierra —`… IV V I I`— ha acabado, y dejarlo abierto es quitarle la llegada.
  const sostenida = base === original ? llegadaSostenida(id, original) : null;
  const periodo = sostenida !== null && pulsosDe(original) > id.frase;
  const puedeCerrar = id.centroModal === null && id.papel !== 'intro' && id.papel !== 'pre';
  const cae: Destino = {
    grado: sexto,
    nombre: `Cae en el ${sexto}`,
    // Engañar al oído es romper lo que prometía una dominante: `V vi`. Desde la
    // tónica o desde un iv no había promesa, y llegar al sexto grado es quedarse
    // abierto cerca de casa, no un engaño. **Ni desde la v menor**: sin sensible no
    // promete la tónica, y el `v VI` es la bajada del eólico, no una rota.
    dice: (penultimo) =>
      ['V', 'vii°'].includes(penultimo)
        ? `acaba en ${sexto} en vez de en la tónica: engaña al oído`
        : `acaba en ${sexto}, que comparte dos notas con la tónica: se queda abierto sin irse de casa`,
    valora: (desde, _, grados) => valorDeLlegada(desde, grados, (p) => (p === 'V' ? 0.9 : 0)),
  };
  const destinos: readonly Destino[] = [
    ...(puedeCerrar ? [cierra] : []),
    ...(periodo ? [] : [abierta]),
    // El sexto grado de un blues o un funk es de otra gama (`deOtraGama`).
    ...(periodo || deOtraGama(id, sexto) ? [] : [cae]),
  ];
  // Hasta dónde llega el tramo nuevo y desde dónde puede empezar: el que cierra
  // acaba en tu llegada, y el que se queda abierto empieza detrás de ella.
  const tramo = (destino: Destino) =>
    destino === cierra || sostenida === null
      ? { fin: sostenida ?? largo - 1, desdeMin: 0 }
      : { fin: largo - 1, desdeMin: sostenida + 1 };

  // Lo tuyo que se queda, y lo nuevo con los pulsos del compás que sustituye. Lo
  // tuyo de un acorde partido vuelve a ser un acorde.
  const montar = (desde: number, grados: readonly DegreeSymbol[], fin: number): PasoPosible[] => {
    const quedan =
      base === original
        ? original.slice(0, desde).map((_, i) => tuyo(id, original, i))
        : [{ ...tuyo(id, original, 0), beats: pulsosDe(base.slice(0, desde)) }];
    return [
      ...quedan,
      ...grados.map((degree, k) =>
        paso(degree, base[desde + k]!.beats, null, especieNueva(id, degree, null)),
      ),
      ...base.slice(fin + 1).map((_, k) => tuyo(id, original, fin + 1 + k)),
    ];
  };
  const igualQueLoTuyo = (desde: number, grados: readonly DegreeSymbol[]) =>
    grados.every((grado, k) => grado === base[desde + k]!.degree);
  const dondeEmpieza = (desde: number) => desdeElPulso(id, pulsosDe(base.slice(0, desde)));

  // Un final y un estribillo tienen que llegar a casa —el juez descarta lo que los
  // deja abiertos—, así que ahí se buscan varias maneras de llegar, una por acorde
  // de antes; en lo demás, la mejor de cada destino.
  const llega = (id.papel === 'final' || id.papel === 'estribillo') && ultimoTuyo !== tonica;
  const cuantas = (destino: Destino) =>
    llega && destino.grado === tonica ? MINIMO_DEL_MENU + 1 : 1;
  const borradores: Borrador[] = [];
  for (const destino of destinos) {
    const { fin, desdeMin } = tramo(destino);
    const posibles: { desde: number; grados: readonly DegreeSymbol[]; valor: number }[] = [];
    const hasta = Math.min(LARGO_DE_UNA_FRASE, fin + 1 - suelo, fin + 1 - desdeMin);
    for (let k = 1; k <= hasta; k += 1) {
      const desde = fin + 1 - k;
      const previo = base[desde - 1]!.degree;
      const antes = base[desde - 2]?.degree ?? null;
      const admite: Admite = (grado, i, anterior) =>
        i === k - 1
          ? grado === destino.grado && anterior !== grado
          : grado !== destino.grado && grado !== tonica;
      for (const grados of buscarCaminos(id, previo, k, admite)) {
        if (!igualQueLoTuyo(desde, grados)) {
          posibles.push({
            desde,
            grados,
            valor:
              destino.valora(previo, antes, grados) -
              0.1 * (k - 1) -
              (quitaTuColor(id, original, desde, desde + k - 1, grados) ? 1 : 0),
          });
        }
      }
    }
    const vistos = new Set<DegreeSymbol>();
    for (const elegido of posibles.sort((a, b) => b.valor - a.valor || orden(a.grados, b.grados))) {
      const penultimo = [base[elegido.desde - 1]!.degree, ...elegido.grados].at(-2)!;
      if (vistos.size >= cuantas(destino) || vistos.has(penultimo)) {
        continue;
      }
      vistos.add(penultimo);
      borradores.push({
        path: 'otro-final',
        partes: retoque(montar(elegido.desde, elegido.grados, fin)),
        // Si hay varias, cada una dice por dónde llega.
        nombre: cuantas(destino) > 1 ? `${destino.nombre} desde el ${penultimo}` : destino.nombre,
        que: `${dondeEmpieza(elegido.desde)}, ${[...elegido.grados, ...base.slice(fin + 1).map((p) => p.degree)].join(' ')}: ${typeof destino.dice === 'string' ? destino.dice : destino.dice(penultimo)}.`,
        prioridad: prioridadDe(elegido.valor),
        familia: `final:${destino.grado}`,
      });
    }
  }

  // Y la promesa que tu penúltimo no cumple: si es una dominante secundaria y tu
  // último compás no es lo que prepara, el último pasa a serlo. `V/iii ii` acaba
  // en el iii que el VII7 anunciaba; ninguno de los tres finales de arriba lo
  // arregla, porque desde ahí no se llega ni a la tónica ni a la V.
  const penultimo = base[largo - 2]?.degree;
  if (penultimo?.includes('/')) {
    // Lo primero del grafo de una secundaria es lo que prepara.
    const prepara = saltosDe(id.mode, penultimo)[0]!.to;
    if (prepara !== base[largo - 1]!.degree) {
      borradores.push({
        path: 'otro-final',
        partes: retoque(montar(largo - 1, [prepara], largo - 1)),
        nombre: `Llega al ${prepara}`,
        que: `El último compás pasa a ${prepara}, que es lo que prepara tu ${penultimo}.`,
        prioridad: prioridadDe(valorDelSalto(id, penultimo, prepara)),
        familia: 'final:prometido',
      });
    }
  }

  return [...borradores, ...acabaAntes(id, original)];
}

/**
 * **De dónde viene** el color de un grado: un préstamo del menor —o el napolitano—
 * en mayor, una dominante secundaria o un suspendido que retiene la tercera; nulo si
 * no es color. La misma vara del juez (`colorDe` en `encaje.ts`): un color no se cambia
 * por otro de otra casa.
 */
function colorDelGrado(
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): 'prestado' | 'secundaria' | 'suspendido' | null {
  // En menor el bII es de la casa: lo trae su catálogo (el juez dice lo mismo).
  if (mode === 'major' && esPrestado(mode, degree)) {
    return 'prestado';
  }
  if (degree.includes('/')) {
    return 'secundaria';
  }
  return especie === 'sus2' || especie === 'sus4' ? 'suspendido' : null;
}

/**
 * Si cambiar tus compases de `desde` a `hasta` por esos grados **te deja sin el
 * color** que hacía tuya la canción: el iv de `I IV iv I`, el sus4 que retiene el
 * V. Otro final cambia el final, no la canción: entre dos maneras de acabar, la que
 * se lleva todo tu color va detrás, aunque el color fuera tu último acorde —un soul
 * en `I vi IV iv` acabado en `I vi IV I` ya no es soul—. El juez le pone el mismo
 * reparo. Antes esto no se miraba, y en un folk el único «se queda en la dominante»
 * de `I IV iv I` era `I IV ii V`, sin el iv.
 */
function quitaTuColor(
  id: Idioma,
  original: readonly PathStep[],
  desde: number,
  hasta: number,
  grados: readonly DegreeSymbol[],
): boolean {
  const colorTuyo = (i: number) =>
    colorDelGrado(id.mode, original[i]!.degree, id.especies[i] ?? null);
  // Lo que queda sonando: lo tuyo fuera del tramo y lo que pone.
  const quedan = new Set([
    ...original
      .map((_, i) => i)
      .filter((i) => i < desde || i > hasta)
      .map(colorTuyo),
    ...grados.map((grado) => colorDelGrado(id.mode, grado, especieNueva(id, grado, null))),
  ]);
  // Cada clase de color tuya que se pierde entera, también la que era tu final.
  return original.some((_, i) => {
    const suyo = colorTuyo(i);
    return suyo !== null && !quedan.has(suyo);
  });
}

/**
 * Acabar antes, pero en frase: lo más largo que cuadra y deja en pie la mitad.
 *
 * **Solo si tu canción no cuadraba ya**: si mide frases enteras —un AABA de
 * treinta y dos, dos frases de tres—, quitarle compases no cuadra nada, rompe la
 * forma. Y dice lo que mide en compases, no en acordes: con dos acordes por compás
 * los dos números no se parecen.
 */
function acabaAntes(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const largo = original.length;
  const suelo = Math.ceil(largo / 2);
  if (pulsosDe(original) % id.frase === 0) {
    return [];
  }
  for (let corto = largo - 1; corto >= Math.max(suelo, 2); corto -= 1) {
    if (pulsosDe(original.slice(0, corto)) % id.frase !== 0) {
      continue;
    }
    let mejor: { grados: readonly DegreeSymbol[]; valor: number } | null = null;
    for (let k = 1; k <= Math.min(LARGO_DE_UNA_FRASE, corto - suelo); k += 1) {
      const desde = original[corto - k - 1]!.degree;
      // Con «acaba antes» quedan al menos dos compases tuyos delante del cambio.
      const antes = original[corto - k - 2]!.degree;
      const [cierre] = cierresDesde(id, antes, desde, k, 1);
      if (cierre !== undefined && (mejor === null || cierre.valor - 0.1 * (k - 1) > mejor.valor)) {
        mejor = { grados: cierre.grados, valor: cierre.valor - 0.1 * (k - 1) };
      }
    }
    if (mejor === null) {
      return [];
    }
    const desde = corto - mejor.grados.length;
    const cancion = [
      ...original.slice(0, desde).map((_, i) => tuyo(id, original, i)),
      ...mejor.grados.map((degree, k) =>
        paso(degree, original[desde + k]!.beats, null, especieNueva(id, degree, null)),
      ),
    ];
    const compases = (pasos: readonly PathStep[]) => compasesEnPalabras(id, pulsosDe(pasos));
    return [
      {
        path: 'otro-final',
        partes: retoque(cancion),
        nombre: 'Acaba antes',
        que: `${desdeElPulso(id, pulsosDe(original.slice(0, desde)))}, ${mejor.grados.join(' ')}: llega a la tónica en ${compases(cancion)} y no en ${compases(original)}, y la frase cuadra.`,
        prioridad: prioridadDe(mejor.valor - 0.3),
        familia: 'acaba-antes',
      },
    ];
  }
  return [];
}

/**
 * «8 compases» o, si no son compases enteros, «18 pulsos». Nunca uno: lo que se
 * acorta cuadra una frase, que tiene tres compases o más.
 */
function compasesEnPalabras(id: Idioma, pulsos: number): string {
  return pulsos % id.compas === 0 ? `${pulsos / id.compas} compases` : `${pulsos} pulsos`;
}

/** «Desde el compás 3», «Desde la mitad del compás 1»: dónde empieza algo, en compases de verdad. */
function desdeElPulso(id: Idioma, pulso: number): string {
  const compas = Math.floor(pulso / id.compas) + 1;
  const dentro = pulso % id.compas;
  if (dentro === 0) {
    return `Desde el compás ${compas}`;
  }
  return dentro * 2 === id.compas
    ? `Desde la mitad del compás ${compas}`
    : `Desde el pulso ${dentro + 1} del compás ${compas}`;
}

/**
 * Un acorde solo, partido para poder cambiarle la segunda mitad: en sus compases
 * si dura varios, o en dos mitades si dura uno y se puede partir por el pulso.
 */
function partirElAcorde(id: Idioma, acorde: PathStep): PathStep[] {
  const { degree, beats } = acorde;
  if (beats > id.compas && beats % id.compas === 0) {
    return Array.from({ length: beats / id.compas }, () => ({ degree, beats: id.compas }));
  }
  return beats % 2 === 0
    ? [
        { degree, beats: beats / 2 },
        { degree, beats: beats / 2 },
      ]
    : [acorde];
}

// ─── Los colores ────────────────────────────────────────────────────────────

/** Un grado de color oscuro: menor, disminuido o prestado del otro modo. */
function oscuro(mode: KeyMode, degree: DegreeSymbol): boolean {
  return degree.startsWith('b') || resolveDegree(0, mode, degree).quality !== 'major';
}

/**
 * Un grado que tensa: la dominante con sensible, el vii° o la dominante de otro.
 * **El bVII no**: llega a casa sin sensible, y llamar «tensión» a un riff
 * mixolidio era el mismo error que darle el papel del V.
 */
function tenso(degree: DegreeSymbol): boolean {
  return degree.includes('/') || degree === 'V' || degree === 'vii°';
}

/**
 * Los colores de una canción frente a la tuya.
 *
 * Solo cuenta lo que **cambia**: un compás nuevo con un grado que no estaba, o
 * uno tuyo que pasa de un color a otro. Que tu canción ya fuera menor no hace
 * triste a una salida que no ha tocado nada de eso.
 */
function coloresDe(
  mode: KeyMode,
  original: readonly PathStep[],
  cancion: readonly PasoPosible[],
): Color[] {
  const tuyos = new Set(original.map((paso) => paso.degree));
  const cambios = cancion
    .map((paso, i) => ({ paso, antes: original[i]?.degree ?? null }))
    .filter(({ paso, antes }) => antes !== paso.degree);
  const llega = (
    degree: DegreeSymbol,
    antes: DegreeSymbol | null,
    es: (d: DegreeSymbol) => boolean,
  ) => es(degree) && (antes === null ? !tuyos.has(degree) : !es(antes));

  const colores: Color[] = [];
  if (cambios.some(({ paso, antes }) => llega(paso.degree, antes, (d) => oscuro(mode, d)))) {
    colores.push('oscurece');
  }
  if (cambios.some(({ paso, antes }) => llega(paso.degree, antes, (d) => !oscuro(mode, d)))) {
    colores.push('aclara');
  }
  if (
    cambios.some(({ paso, antes }) => paso.move === 'tritono' || llega(paso.degree, antes, tenso))
  ) {
    colores.push('tension');
  }
  if (
    mode === 'major' &&
    cambios.some(({ paso }) => esPrestado(mode, paso.degree) && !tuyos.has(paso.degree))
  ) {
    colores.push('prestado');
  }
  colores.push(cancion[cancion.length - 1]!.degree === tonicOf(mode) ? 'cierra' : 'abierto');
  // Lo que dura solo se cuenta al retocar: al continuar todo alarga, y decir «más
  // lento» de cada salida sería no decir nada.
  if (cancion.length === original.length) {
    const antes = pulsosDe(original);
    const ahora = pulsosDe(cancion);
    if (ahora !== antes) {
      colores.push(ahora > antes ? 'mas-lento' : 'mas-rapido');
    }
  } else if (cancion.length < original.length) {
    colores.push('mas-corto');
  }
  return colores;
}

// ─── El menú ────────────────────────────────────────────────────────────────

/** Lo que se le quita a una salida por cada una ya elegida del mismo camino. */
const PENA_POR_CAMINO = 3;

/** Y por cada una ya elegida de la misma clase: dos cierres desde el V, dos préstamos. */
const PENA_POR_FAMILIA = 5;

/** Lo que hace falta de una candidata para ordenarla. */
export interface CandidataDelMenu {
  readonly path: PathId;
  /** Lo que dijo el juez, de 0 a 100. */
  readonly puntos: number;
  readonly familia: string;
  /** Lo que cree el generador: desempata, no manda. */
  readonly prioridad: number;
  /** Si es relleno (`esRelleno`): la variedad no lo sube a las que se enseñan. */
  readonly relleno?: boolean;
}

/**
 * **Relleno**: estirar una toma que ya iba a tiempo y cuyos acordes se pueden
 * retocar. Los mismos acordes a otra velocidad no proponen nada; entraban entre las
 * tres que se enseñan solo porque eran de otro camino (el quinto examen).
 *
 * Estirar sí propone algo en tres casos: lo que se tocó desigual —cuadrarlo, y lo
 * dice su color—, un acorde solo, que no tiene otro compás que retocar, y una
 * bajada (`esUnaBajada`), que es la forma: ahí lo que se retoca es el reparto (los
 * pidió el corpus de verificación).
 */
export function esRelleno(
  tuyos: readonly PathStep[],
  salida: Pick<SalidaPosible, 'path' | 'colores'>,
): boolean {
  const grados = tuyos.map((paso) => paso.degree);
  // El modo sale de los grados: una bajada lo es en el modo en que existen todos.
  const bajada = (['major', 'minor'] as const).some(
    (mode) =>
      grados.every((grado) => degreesFor(mode).includes(grado)) && esUnaBajada(mode, grados),
  );
  return (
    salida.path === 'estirar' &&
    !salida.colores.includes('cuadra') &&
    new Set(grados).size > 1 &&
    !bajada
  );
}

/**
 * Las mejores primero, **con variedad**: cada vez se elige la que más puntos
 * tiene después de restarle lo que se parece a las ya elegidas —un poco por ser del
 * mismo camino, más por ser de la misma clase—.
 *
 * **Manda la calidad**: la pena es de unos pocos puntos, así que una salida que el
 * juez pone muy por encima sale primero aunque repita camino. Lo que evita es que,
 * entre dos casi iguales, las nueve del menú sean nueve cierres desde el V. Y a
 * igualdad de todo, lo que cree el generador y después el orden en que llegaron:
 * el menú se construye dos veces por petición y tiene que salir igual.
 */
export function ordenarConVariedad<C extends CandidataDelMenu>(
  candidatas: readonly C[],
  cuantas: number,
): C[] {
  const quedan = candidatas.map((candidata, orden) => ({ candidata, orden }));
  const elegidas: C[] = [];
  const porCamino = new Map<string, number>();
  const porFamilia = new Map<string, number>();
  while (elegidas.length < cuantas && quedan.length > 0) {
    const nota = ({ candidata }: { candidata: C }) =>
      candidata.puntos -
      PENA_POR_CAMINO * (porCamino.get(candidata.path) ?? 0) -
      PENA_POR_FAMILIA * (porFamilia.get(candidata.familia) ?? 0);
    // En las que se enseñan, el relleno no entra por variedad: solo si lo que queda
    // no lo supera en puntos.
    const enseñadas = elegidas.length < MINIMO_DEL_MENU;
    const mejorQue = (relleno: { candidata: C }) =>
      quedan.some(
        ({ candidata }) =>
          candidata.relleno !== true && candidata.puntos > relleno.candidata.puntos,
      );
    const vale = (q: { candidata: C }) =>
      !(enseñadas && q.candidata.relleno === true && mejorQue(q));
    let mejor = quedan.findIndex(vale);
    for (let i = mejor + 1; i < quedan.length; i += 1) {
      if (!vale(quedan[i]!)) {
        continue;
      }
      const a = quedan[i]!;
      const b = quedan[mejor]!;
      const diferencia =
        nota(a) - nota(b) || a.candidata.prioridad - b.candidata.prioridad || b.orden - a.orden;
      if (diferencia > 0) {
        mejor = i;
      }
    }
    const [{ candidata }] = quedan.splice(mejor, 1) as [{ candidata: C; orden: number }];
    elegidas.push(candidata);
    porCamino.set(candidata.path, (porCamino.get(candidata.path) ?? 0) + 1);
    porFamilia.set(candidata.familia, (porFamilia.get(candidata.familia) ?? 0) + 1);
  }
  return elegidas;
}

/**
 * Las salidas que el dominio sabe construir para tu canción, **las que mejor
 * encajan primero** y repartidas.
 *
 * **Es la respuesta a que el modelo copiara.** Con el ejemplo en el prompt,
 * `qwen3:8b` devolvía el ejemplo tal cual 21 veces de 22: lo que ponía de suyo era
 * el título. Así que lo que se le da ya no es un ejemplo, es **el menú**: todo lo
 * que hay aquí es válido por construcción —sale de los movimientos, el grafo y
 * las cadencias que lo juzgan, y aun así pasa por `songProblem` antes de
 * entrar—, y lo que hace el modelo es elegir con tus directrices delante y
 * explicar por qué. La línea de [adr/0011] no se mueve: el dominio verifica; lo
 * que cambia es que ahora también propone.
 *
 * **Válida no es buena**, y por eso se construyen muchas más de las que caben y
 * las ordena el juez (`encaje.ts`): lo que tiene un descarte no entra nunca, lo
 * que no llega al mínimo solo entra para que haya tres donde elegir —detrás, con
 * sus puntos—, y de lo demás sale primero lo que mejor encaja, con variedad
 * (`ordenarConVariedad`). Lo que se construye ya mira el contexto —el estilo
 * decide cuánto cuesta un préstamo, el papel cómo se llama lo que sigue, la duda
 * qué no se toca—, para que lo bueno esté entre las candidatas: si una buena
 * salida no se construye, nadie puede elegirla.
 *
 * Deterministas: la ruta lo construye al escribir el prompt y otra vez al validar,
 * y las dos veces tienen que salir iguales, porque el modelo contesta por número.
 */
/** Lo que el juez necesita de una candidata: la canción entera y lo que es lo añadido. */
function aJuzgar(candidata: CandidataDeSalida): CandidataAJuzgar {
  return {
    path: candidata.path,
    cancion: candidata.secciones.flatMap((seccion) => seccion.steps),
    ...(candidata.loQueSeAnade === undefined ? {} : { loQueSeAnade: candidata.loQueSeAnade }),
    ...(candidata.papelNuevo === undefined ? {} : { papelNuevo: candidata.papelNuevo }),
  };
}

export function salidasPosibles(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  /** Lo que se sabe además de los grados: estilo, especies, papel, punteo… */
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): readonly SalidaPosible[] {
  const juzgadas = candidatasDeSalida(mode, kind, original, contexto).flatMap((candidata) => {
    const { prioridad, familia, path, secciones, nombre, que, colores } = candidata;
    // Lo que va al menú es la salida, sin lo que solo sirve para juzgarla y ordenarla.
    const salida: SalidaPosible = { path, secciones, nombre, que, colores };
    const juicio = encaje(mode, kind, original, contexto, aJuzgar(candidata));
    // Lo que tiene un descarte no entra nunca: es un error que el juez sabe nombrar.
    if (juicio.descarte !== null) {
      return [];
    }
    return [
      {
        path: salida.path,
        puntos: juicio.puntos,
        familia,
        prioridad,
        relleno: esRelleno(original, salida),
        salida: { ...salida, encaje: juicio },
      },
    ];
  });
  const buenas = juzgadas.filter((c) => c.puntos >= ENCAJE_MINIMO);
  // **La red**: si lo que llega al mínimo no da para elegir, entra lo mejor de lo
  // que se queda debajo, detrás de todo lo bueno y con sus puntos a la vista. Con
  // una canción rara —un acorde que ningún grado prepara, una toma que no cuadra—
  // todo encaja a medias, y un menú de una salida no deja elegir nada: la que no
  // llega a cincuenta tiene más en contra que a favor, pero no rompe nada que el
  // juez sepa nombrar, que es lo que separa «flojo» de «mal». Las que lo rompen se
  // han quedado fuera arriba, y ahí siguen.
  const faltan = Math.max(0, MINIMO_DEL_MENU - buenas.length);
  // Y en la red, primero lo que no rompe nada que el juez proteja: un reparo —tu
  // tónica del compás 1, tu color, tu línea de bajo— entra solo si no queda otra
  // cosa. Una de 49 puntos que cambiaba la i del compás 1 se colaba entre las tres
  // que se enseñan por delante de otras sin reparo (el quinto examen).
  const red = juzgadas
    .filter((c) => c.puntos < ENCAJE_MINIMO)
    .sort(
      (a, b) =>
        Number(a.salida.encaje.reparo !== undefined) -
          Number(b.salida.encaje.reparo !== undefined) ||
        b.puntos - a.puntos ||
        b.prioridad - a.prioridad,
    )
    .slice(0, faltan);
  return [...ordenarConVariedad(buenas, MAX_SALIDAS_POSIBLES), ...red].map((c) => c.salida);
}

/**
 * Por qué no hay ninguna salida que ofrecer, dicho para quien lo lee, o nulo si
 * las hay.
 *
 * Antes el menú salía vacío sin más, y la pantalla no tenía qué decir. Los motivos
 * son límites de la música o del gasto, no del generador:
 *
 * - **Continuar una canción que llena el tope**: lo tuyo va entero delante y detrás
 *   tiene que caber algo, y con `MAX_PATH_STEPS` acordes no cabe nada —el tope es
 *   el de la factura, no se estira—; con uno menos cabe un acorde, y uno solo solo
 *   sirve si es la llegada.
 * - **Que todo lo que se puede construir lo descarte el juez**: un final que no
 *   llega a casa y no puede llegar sin alargarse, un último acorde que solo sabe ir
 *   a donde la canción no quiere. Se dice con las palabras del juez.
 */
export function porQueNoHaySalidas(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): string | null {
  if (original.length === 0) {
    return 'No hay nada tocado todavía: toca algo y vuelve a pedirlo.';
  }
  const ultimo = original.at(-1)!.degree;
  const tonica = tonicOf(mode);
  if (kind === 'continuar' && original.length >= MAX_PATH_STEPS) {
    return `Tu canción ya tiene ${original.length} acordes, lo más largo que puede ser una salida: detrás no cabe nada más. Prueba a retocarla.`;
  }
  if (
    kind === 'continuar' &&
    original.length === MAX_PATH_STEPS - 1 &&
    (ultimo === tonica || !canFollow(mode, ultimo, tonica))
  ) {
    return `Detrás de tus ${original.length} acordes solo cabe uno más, y con uno no se llega a casa desde tu ${ultimo}. Prueba a retocarla.`;
  }
  if (salidasPosibles(mode, kind, original, contexto).length > 0) {
    return null;
  }
  // Lo que se construye y el juez descarta, dicho con sus palabras: lo que más se
  // repite. Pasa con un último acorde que solo sabe ir a donde la canción no quiere
  // ir —un VII7 que lleva al iii, con su sensible, en un riff que eligió no tenerla—.
  // Todas tienen descarte: lo que no lo tiene entra en el menú por la red.
  const descartes = candidatasDeSalida(mode, kind, original, contexto)
    .map((candidata) => encaje(mode, kind, original, contexto, aJuzgar(candidata)).descarte)
    .filter((descarte): descarte is string => descarte !== null);
  /* v8 ignore next 3 -- no debería pasar nunca, y lo vigila la prueba de «siempre hay
     donde elegir»: si no hay nada construido, es que el generador no sabe, no la música */
  if (descartes.length === 0) {
    return SIN_SALIDA;
  }
  const veces = (motivo: string) => descartes.filter((d) => d === motivo).length;
  const motivo = [...descartes].sort((a, b) => veces(b) - veces(a))[0]!;
  return `Lo que se puede construir desde tu ${ultimo} no encaja: ${motivo}. Prueba a cambiar el final.`;
}

/**
 * Lo que se dice cuando no hay salida y no se sabe decir por qué. **No debería
 * verse nunca**: está para que la pantalla no se quede muda, y la prueba de «siempre
 * hay donde elegir» exige que no salga.
 */
export const SIN_SALIDA =
  'No hay ninguna salida que encaje con lo que llevas. Prueba a cambiar algo.';

/** Lo tuyo con cada acorde en un compás solo, si lo tocas con un ritmo armónico lento. */
interface RitmoLento {
  readonly original: readonly PathStep[];
  readonly contexto: ContextoDeSalidas;
  /** Los pulsos de cada compás tuyo: los que tiene que llevar lo nuevo. */
  readonly pasos: number;
}

/**
 * Si lo tuyo **cambia de acorde cada dos compases o más**, escrito compás a compás
 * —`i i VI VI III III VII VII`—, lo mismo con cada acorde en un solo paso.
 *
 * Lo que se añadía iba a un acorde por compás, porque ese era el largo de tus
 * pasos, y el ritmo armónico de la canción —un acorde cada dos compases— se
 * rompía en todas las salidas menos en la que copiaba tu frase. Lo encontró el
 * corpus final. Ahora lo que sigue se construye sobre tus acordes enteros y se
 * escribe como tú, compás a compás (`alPasoDeLoTuyo`).
 *
 * Solo con todo regular: los mismos pulsos en cada paso, cada acorde el mismo
 * número de pasos —dos o más— y al menos tres acordes, que es cuando un ritmo es
 * un ritmo y no un acorde que se alarga.
 */
function ritmoLento(original: readonly PathStep[], contexto: ContextoDeSalidas): RitmoLento | null {
  const pasos = original[0]!.beats;
  if (original.some((paso) => paso.beats !== pasos)) {
    return null;
  }
  const rachas: number[][] = [];
  original.forEach((paso, i) => {
    if (i > 0 && original[i - 1]!.degree === paso.degree) {
      rachas.at(-1)!.push(i);
    } else {
      rachas.push([i]);
    }
  });
  const largo = rachas[0]!.length;
  if (largo < 2 || rachas.length < 3 || rachas.some((racha) => racha.length !== largo)) {
    return null;
  }
  const deLaRacha = <T>(lista: readonly T[] | undefined, junta: (de: readonly T[]) => T) =>
    lista === undefined ? undefined : rachas.map((racha) => junta(racha.map((i) => lista[i]!)));
  const especies = deLaRacha(contexto.especies, (de) =>
    de.every((especie) => especie === de[0]) ? de[0]! : null,
  );
  const dudosos = deLaRacha(contexto.dudosos, (de) => de.some(Boolean));
  const melodia = deLaRacha(contexto.melodia, (de) => de.flat());
  return {
    original: rachas.map((racha) => ({
      degree: original[racha[0]!]!.degree,
      beats: pasos * largo,
    })),
    contexto: {
      ...contexto,
      ...(especies === undefined ? {} : { especies }),
      ...(dudosos === undefined ? {} : { dudosos }),
      ...(melodia === undefined ? {} : { melodia }),
    },
    pasos,
  };
}

/** Lo que se construyó con tus acordes enteros, escrito compás a compás como lo tuyo. */
function alPasoDeLoTuyo(borrador: Borrador, pasos: number): Borrador {
  return {
    ...borrador,
    partes: borrador.partes.map((parte) => ({
      ...parte,
      steps: parte.steps.flatMap((paso) =>
        // Compás a compás; lo que no llegue a uno entero —cerca del tope, con lo que
        // sobra repartido de pulso en pulso— se queda con lo que dura.
        Array.from({ length: Math.ceil(paso.beats / pasos) }, (_, k) => ({
          ...paso,
          beats: Math.min(pasos, paso.beats - k * pasos),
        })),
      ),
    })),
  };
}

/** Una salida construida y válida, antes de que la juzgue nadie. */
export interface CandidataDeSalida extends SalidaPosible {
  /** Lo que cree el generador que vale: desempata lo que el juez deja igual. */
  readonly prioridad: number;
  /** Qué clase de salida es, para repartir el menú. */
  readonly familia: string;
  /** Al continuar, qué es lo añadido según quien lo nombra: así lo juzga el juez. */
  readonly loQueSeAnade?: LoQueSeAnade;
  /** Y qué papel tiene, si no es el de `PARTE_QUE_SIGUE`: la B de una AABA es un puente. */
  readonly papelNuevo?: SectionRole;
}

/**
 * Todo lo que el dominio sabe construir para tu canción, **válido y sin juzgar**:
 * lo que `salidasPosibles` le pasa al juez. Aparte para poder mirar qué se
 * construye sin depender de lo que el juez opine, que es otra pregunta.
 */
export function candidatasDeSalida(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): readonly CandidataDeSalida[] {
  if (original.length === 0) {
    return [];
  }
  const id = idiomaDe(mode, original, contexto);
  const tuyos = original.map((_, i) => tuyo(id, original, i));
  const lento = kind === 'continuar' ? ritmoLento(original, contexto) : null;
  const borradores =
    kind === 'retocar'
      ? [
          ...rearmonizaciones(id, original),
          ...partidas(id, original),
          ...estiramientos(id, original),
          ...otrosFinales(id, original),
        ]
      : lento === null
        ? continuarCon(id, original)
        : continuarCon(idiomaDe(mode, lento.original, lento.contexto), lento.original).map(
            (borrador) => alPasoDeLoTuyo(borrador, lento.pasos),
          );

  const vistas = new Set<string>();
  const candidatas: CandidataDeSalida[] = [];
  for (const borrador of borradores) {
    const secciones: ParteDeSalida[] =
      kind === 'continuar'
        ? [{ name: 'Lo que llevas', yours: true, steps: tuyos }, ...borrador.partes]
        : [...borrador.partes];
    const cancion = secciones.flatMap((seccion) => seccion.steps);
    const clave = cancion.map((paso) => `${paso.degree}/${paso.beats}`).join(' ');
    if (
      vistas.has(clave) ||
      songProblem(mode, borrador.path, original, secciones, contexto.estilo ?? null) !== null
    ) {
      continue;
    }
    vistas.add(clave);
    const colores = coloresDe(mode, original, cancion);
    candidatas.push({
      path: borrador.path,
      secciones,
      nombre: borrador.nombre.slice(0, LARGO_MAXIMO_DEL_NOMBRE),
      que: borrador.que.slice(0, LARGO_MAXIMO_DE_LO_QUE_HACE),
      colores: borrador.cuadra === true ? [...colores, 'cuadra'] : colores,
      prioridad: borrador.prioridad,
      familia: borrador.familia,
      ...(borrador.loQueSeAnade === undefined ? {} : { loQueSeAnade: borrador.loQueSeAnade }),
      ...(borrador.papelNuevo === undefined ? {} : { papelNuevo: borrador.papelNuevo }),
    });
  }
  return candidatas;
}
