/**
 * Si una salida **encaja** en tu canción, y por qué.
 *
 * `songProblem` contesta otra pregunta: si una salida está permitida —que cada
 * salto esté en el grafo, que un `seguir` respete tus compases—. Con eso solo,
 * las salidas eran todas válidas y la mitad no convencía a nadie: lo que acababa
 * en V se cerraba con `V IV I`, el bVII valía lo mismo que el V en un jazz y una
 * canción de cuatro compases salía de siete. Válido no es bueno.
 *
 * Este es el juez de lo segundo, y lo que dice ordena el menú: lo que mejor
 * encaja va arriba, lo que no llega al mínimo solo entra si no hay tres que
 * lleguen (la red de `salidasPosibles`), lo que tiene descarte no entra nunca, y
 * los motivos son hechos que el porqué puede contar sin inventarse nada.
 *
 * **Un descarte es absoluto**: suena mal con cualquier canción al lado. Lo que solo
 * es peor que otra cosa —una coda larga, quitar tu color— es un reparo, que deja
 * la salida por debajo del mínimo y la manda a la red (`Hecho`): así lo relativo
 * nunca deja el menú vacío.
 *
 * **Determinista y puro**, como `salidasPosibles`: el menú se construye dos veces
 * por petición y tiene que salir igual las dos.
 *
 * ## Cómo se juzga
 *
 * Once criterios, cada uno de -1 a 1, que miran **lo que la salida añade o
 * cambia** y no lo que ya era tuyo: si tu blues tiene un `V IV`, eso no es culpa
 * de ninguna salida. Los que dependen del contexto —punteo, estilo, papel— solo
 * cuentan cuando el contexto los trae; sin estilo no se premia ni se castiga
 * ningún idioma, que es lo que promete `ContextoDeSalidas`.
 *
 * Todo se cuenta en compases de verdad, sacados de los pulsos: un `I IV V IV` a
 * dos pulsos son dos compases, no cuatro, y un acorde de ocho pulsos ocupa dos.
 */

import {
  esEspecieSimple,
  notasDeEspecieSimple,
  seventhNotes,
  type EspecieDeBloque,
} from './chords';
import type { ContextoDeSalidas } from './contexto-de-salidas';
import { roleOfDegreeSymbol, type HarmonicRole } from './harmonic-function';
import type { KeyMode } from './keys';
import type { PathId, PathKind, PathStep } from './paths';
import { degreesFor, gradosDeLaEscala, resolveDegree, type DegreeSymbol } from './progressions';
import {
  centroFrigio,
  compasesDe,
  formasDe,
  reposoFrigio,
  type Compas,
  type LoQueFalta,
} from './formas';
import { gruposPorPulsos } from './partir';
import type { MoveId } from './reharmonization';
import type { SectionRole } from './song';
import { STYLES, type ChordFamily, type StyleId } from './styles';

/** Un compás de la canción que se juzga, tal como quedaría. */
export interface PasoJuzgado {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  /** La especie con la que suena; `null` o ausente es la tríada del grado. */
  readonly especie?: EspecieDeBloque | null;
  /** El movimiento que lo justifica, si viene de rearmonizar. */
  readonly move?: MoveId | null;
}

/**
 * Qué es lo que se añade al continuar, según quien lo construyó: **la tuya
 * completada** —el cierre que le falta a tu frase—, **otra parte** —la que dice
 * `PARTE_QUE_SIGUE`— o **la misma otra vez** —una segunda vuelta, otro coro—.
 */
export type LoQueSeAnade = 'tuya' | 'otra' | 'misma';

/** La salida que se juzga: qué camino toma y cómo queda la canción entera. */
export interface CandidataAJuzgar {
  readonly path: PathId;
  readonly cancion: readonly PasoJuzgado[];
  /**
   * Al continuar, qué parte es lo añadido según quien la construyó, que es quien la
   * nombra. Sin él, el juez lo deduce de dónde acaba tu frase.
   */
  readonly loQueSeAnade?: LoQueSeAnade;
  /**
   * El papel de lo añadido según quien lo nombra, si no es el de `PARTE_QUE_SIGUE`:
   * la B de una AABA es un puente aunque lo tuyo sea una estrofa.
   */
  readonly papelNuevo?: SectionRole;
}

/** Lo que mira el juez, uno por criterio musical. */
export type CriterioId =
  | 'sintaxis'
  | 'cadencia'
  | 'frase'
  | 'ritmo-armonico'
  | 'bajo'
  | 'notas-comunes'
  | 'melodia'
  | 'estilo'
  | 'novedad'
  | 'papel'
  | 'forma';

export interface Criterio {
  readonly id: CriterioId;
  /** De -1 (lo estropea) a 1 (es justo lo que pide). 0 es que no dice nada. */
  readonly valor: number;
  /** El hecho que lo justifica, en una frase y en grados. Vacío si no aporta. */
  readonly motivo: string;
}

export interface Encaje {
  /** De 0 a 100: cuánto encaja. Es lo que ordena el menú. */
  readonly puntos: number;
  readonly criterios: readonly Criterio[];
  /**
   * Por qué no debería ofrecerse nunca, si es el caso: una retrogresión en un
   * estilo que no la admite, una frase que queda coja... `null` si puede ir.
   */
  readonly descarte: string | null;
  /**
   * El reparo, si lo hay: lo que la deja por debajo del mínimo sin descartarla —tu
   * tónica del compás 1, tu color, una coda larga—. La red (`salidasPosibles`) mete
   * primero lo que no lo tiene.
   */
  readonly reparo?: string;
}

/**
 * Los puntos mínimos para entrar en el menú.
 *
 * **Cincuenta, que es «no dice nada»**: por debajo una salida tiene más en
 * contra que a favor. Se midió primero con el volcado de las 38 canciones del
 * arreglista, y ese volcado era el mismo con el que se ajustó el juez: una
 * verificación con 48 canciones que el equipo no había visto lo demostró, con un
 * 14 % de salidas mal en lo que el corpus no probaba.
 *
 * **Recalibrado con los dos corpus** (`corpus-de-salidas.ts` y
 * `corpus-de-verificacion.ts`, 1315 salidas de menú): las que un arreglista
 * rechaza ya no se separan por puntos sino **por descarte** —el papel, el modo
 * sin sensible, el punteo— o **por reparo**, que las deja justo debajo de este
 * mínimo —el relleno, la coda larga—, y las 14 que aún se cuelan puntúan entre
 * 55 y 83: son idioma que el juez no puede ver sin estilo (un ii–V en música de
 * cine), no salidas flojas. Lo bueno, en cambio, baja hasta 50: entre 50 y 60 hay
 * 63 salidas que los dos arreglistas aceptan. Subir el mínimo las quitaría sin
 * quitar ninguna mala, así que se queda en cincuenta, y las pendientes de cada
 * criterio con él: lo que se ajustó al corpus del equipo no eran los números,
 * eran las reglas que faltaban.
 */
export const ENCAJE_MINIMO = 50;

/**
 * Lo que pesa cada criterio en los puntos. Suman uno.
 *
 * - **Sintaxis y cadencia, lo que más** (0,15 cada una): son lo que oye
 *   cualquiera. Una dominante que vuelve atrás o un final que no llega a ningún
 *   sitio estropean la salida aunque todo lo demás esté bien.
 * - **Frase, después** (0,12): siete compases se notan aunque no se sepa
 *   contarlos. Pesa algo menos porque es aritmética, no armonía: un cierre
 *   precioso de seis compases sigue siendo un cierre precioso.
 * - **Estilo** (0,10): es lo que separa un bVII de rock de uno en un jazz, pero
 *   solo cuenta cuando hay estilo elegido, y entonces ya tira también de la
 *   sintaxis. Más peso lo contaría dos veces.
 * - **Notas comunes** (0,09) y **melodía** (0,08): deciden una rearmonización y
 *   casi no dicen nada al continuar. Cuando hablan, hablan claro.
 * - **Ritmo armónico** (0,08) y **bajo** (0,07): el bajo va muy pegado a la
 *   sintaxis —V I es quinta abajo y dominante a tónica a la vez—, así que pesa
 *   lo justo para desempatar sin contar lo mismo dos veces.
 * - **Novedad** (0,06), **papel** (0,05) y **forma** (0,05): matizan. La forma
 *   pesa poco porque cuando habla —un blues de doce, un vamp modal— suele hacerlo
 *   con un valor extremo, y la frase ya ha dicho buena parte.
 */
const PESOS: Readonly<Record<CriterioId, number>> = {
  sintaxis: 0.15,
  cadencia: 0.14,
  frase: 0.12,
  'ritmo-armonico': 0.07,
  bajo: 0.06,
  'notas-comunes': 0.09,
  melodia: 0.08,
  estilo: 0.11,
  novedad: 0.06,
  papel: 0.05,
  forma: 0.07,
};

/**
 * Lo que hace un acorde en la frase, más fino que `roleOfDegreeSymbol`.
 *
 * Hace falta separar dos cosas que allí van juntas como `dominant`: **el V, que
 * lleva la sensible y pide resolver, y el bVII, que cierra sin ella**. Tratarlos
 * igual es lo que hacía valer un bVII lo mismo que un V en un jazz. Lo mismo el
 * `VII` y el `v` del menor natural. Y las dos dominantes que apuntan a otro sitio
 * —una secundaria, un sustituto tritonal— se juzgan por si llegan a lo suyo.
 */
type Funcion =
  'tonica' | 'sustituto' | 'subdominante' | 'dominante' | 'modal' | 'secundaria' | 'tritono';

/**
 * El papel de la tabla, traducido. `approach` solo lo devuelven las dominantes
 * secundarias, que son las que no están en ella por su nombre.
 */
const POR_PAPEL: Readonly<Record<HarmonicRole, Funcion>> = {
  tonic: 'sustituto',
  subdominant: 'subdominante',
  dominant: 'dominante',
  approach: 'secundaria',
};

/** Los que vienen del modo paralelo cuando la canción está en mayor. */
const PRESTADOS_EN_MAYOR: ReadonlySet<DegreeSymbol> = new Set(['bIII', 'bVI', 'bVII', 'iv']);

interface Acorde {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  /** Semitonos de la fundamental sobre la tónica. */
  readonly root: number;
  readonly notas: readonly number[];
  readonly especie: EspecieDeBloque | null;
  readonly move: MoveId | null;
  /** El pulso en el que empieza, contando desde el primero de la canción. */
  readonly inicio: number;
  readonly funcion: Funcion;
}

/**
 * El compás —desde uno— en el que empieza un acorde. **Los motivos cuentan
 * compases, no acordes**: con acordes de dos pulsos, el noveno está en el compás
 * 5, y «V i en el 9» de una canción de ocho compases no estaba en ningún sitio.
 */
function compasDe(j: Pick<Juicio, 'pc'>, acorde: Pick<Acorde, 'inicio'>): number {
  return Math.floor(acorde.inicio / j.pc) + 1;
}

/** «comparten dos notas», «una sola», «ninguna»: dicho como se dice, sin «1 notas». */
function notasEnComun(notas: number): string {
  return notas === 0
    ? 'no comparten ninguna nota'
    : notas === 1
      ? 'comparten una sola nota'
      : `comparten ${notas} notas`;
}

/** Lo que todos los criterios necesitan saber, calculado una vez. */
interface Juicio {
  readonly mode: KeyMode;
  readonly kind: PathKind;
  readonly path: PathId;
  readonly tonica: DegreeSymbol;
  readonly estilo: StyleId | undefined;
  readonly contexto: ContextoDeSalidas;
  /** Pulsos de un compás. */
  readonly pc: number;
  readonly original: readonly Acorde[];
  readonly cancion: readonly Acorde[];
  /** Los compases de la salida que son suyos: añadidos, o cambiados de grado o de pulsos. */
  readonly nuevos: ReadonlySet<number>;
  /**
   * Los que traen **otro acorde**: añadidos o cambiados de grado. Estirar cambia
   * pulsos y no acordes, y un bVII que ya era tuyo no es un préstamo que la
   * salida haya traído.
   */
  readonly cambiados: ReadonlySet<number>;
  /** Largo en compases de la salida y de lo tuyo. */
  readonly largo: number;
  readonly largoOriginal: number;
  /**
   * Si lo tuyo vive en un modo y no en la tonalidad de manual: una canción que
   * eligió no tener sensible, o un vamp de dos acordes que no pasa por la tónica.
   * Ahí la cadencia fuerte no es la de siempre.
   */
  readonly modal: Modal | null;
  /** Los dos acordes de lo tuyo, si es un vamp que los alterna. */
  readonly vamp: readonly [DegreeSymbol, DegreeSymbol] | null;
  /**
   * Si lo que se retoca **vuelve a empezar**: lo tuyo acaba en algo que lleva a tu
   * primer compás y su papel admite repetirse. Solo entonces su último acorde se
   * juzga por cómo enlaza con el primero (`vueltaDelBucle`).
   */
  readonly bucle: boolean;
  /** Qué es lo añadido según quien lo construyó (`CandidataAJuzgar`). */
  readonly loQueSeAnade: LoQueSeAnade | undefined;
  readonly papelNuevo: SectionRole | undefined;
  /** De cuántos compases son tus frases: cuatro, o las tres de un `3 + 3` a propósito. */
  readonly frase: number;
}

/**
 * - `sin-sensible`: lo tuyo eligió cerrar sin la sensible —un bVII sin V en mayor,
 *   la v y el VII sin V en menor—. Es el mixolidio del rock y del folk celta, y el
 *   eólico.
 * - `sin-tonica`: un vamp de dos acordes que no pasa por la tónica, como `ii V`
 *   que es un dórico sobre Re.
 */
type Modal = 'sin-sensible' | 'sin-tonica';

/**
 * Un hecho con su valor: lo que sale de mirar un enlace, un compás, un final.
 *
 * **Descartar y poner reparos son dos cosas.** Un `descarte` es absoluto: suena
 * mal siempre, con cualquier canción al lado —una falsa relación, una nota fuerte
 * a medio tono del acorde, un final que no llega a casa—, y no entra nunca. Un
 * `reparo` es relativo: no está mal, es peor que lo que suele haber —una coda
 * larga, una salida que quita tu color o tu tónica del compás 1—. Antes los dos
 * descartaban, y cuando lo único que cabía tenía un reparo el menú salía vacío: a
 * un rock de 31 compases que acababa en IV le faltaba justo el `IV I` que pedía.
 * Ahora un reparo deja los puntos por debajo del mínimo (`ENCAJE_MINIMO`), así que
 * solo entra por la red de `salidasPosibles`, detrás de todo lo bueno y cuando no
 * hay tres que lleguen. Esa es la red: lo relativo nunca deja el menú vacío.
 */
interface Hecho {
  readonly valor: number;
  readonly motivo: string;
  readonly descarte?: string;
  readonly reparo?: string;
}

const NADA: Hecho = { valor: 0, motivo: '' };

/** Lo que vale cada cierre cuando lo tuyo es modal: el bVII manda y el V sobra. */
const FUERZA_EN_MODAL: Readonly<Partial<Record<Cierre, number>>> = {
  perfecta: 0.3,
  'sin-sensible': 1,
};

/**
 * Lo que vale cada cierre cuando tu canción **llega a casa por su propio color**
 * (`cadenciaPropia`): las dos cadencias se cambian los papeles. La tuya cierra
 * entera, y la del V, que trae la sensible de fuera, como cierra en otro sitio una
 * sin sensible. No es el modo de `FUERZA_EN_MODAL`, que la descarta: el V cabe —en
 * un menor natural lo da por bueno el arreglista detrás de un `iv`—, pero no delante
 * de lo tuyo.
 */
const FUERZA_PROPIA = { perfecta: 0.75, suya: 1 } as const;

/**
 * Por dónde llega a casa tu canción **cuando no es por la dominante**, o nulo: el
 * acorde que va a la tónica dentro de lo tuyo, o tu último si acabas en él y empiezas
 * en ella, que es la vuelta de un bucle. Solo los que eligen un color y no la
 * sensible, y solo si no tocas ninguna dominante que la lleve:
 *
 * - **El VII de un menor sin V**: `VII i`, la cadencia eólica de `i VI III VII` o de
 *   un reggae en `i VII`.
 * - **El iv de un mayor sin V**: `iv I`, la plagal menor de la música de cine, `I iv
 *   I iv`.
 *
 * Esa es la cadencia de esa canción, y cerrar con ella es lo fuerte: antes el V
 * cerraba siempre mejor, y a un reggae le salía primero un V con la sensible «a
 * todo trapo», y a una de cine, un `IV V I`. El IV de un `I IV I IV` no: es la
 * subdominante de la escala, no un color elegido. Lo usa también quien construye
 * las salidas (`paths.ts`): si cada uno oyera otra cadencia, uno construiría lo
 * que el otro baja.
 */
export function cadenciaPropia(
  mode: KeyMode,
  grados: readonly DegreeSymbol[],
): DegreeSymbol | null {
  const tonica = tonicaDe(mode);
  const suya: DegreeSymbol = mode === 'minor' ? 'VII' : 'iv';
  const conSensible = grados.some(
    (grado) => grado === 'V' || grado === 'vii°' || grado.includes('/'),
  );
  if (conSensible) {
    return null;
  }
  const dentro = grados.some((grado, i) => grado === tonica && grados[i - 1] === suya);
  return dentro || (grados.at(-1) === suya && grados[0] === tonica) ? suya : null;
}

/** La tónica como acorde, para lo que viene después de una parte que va hacia fuera. */
const TONICA: Readonly<Record<KeyMode, Pick<Acorde, 'degree' | 'root'>>> = {
  major: { degree: 'I', root: 0 },
  minor: { degree: 'i', root: 0 },
};

function acotar(valor: number): number {
  return Math.max(-1, Math.min(1, valor));
}

function tonicaDe(mode: KeyMode): DegreeSymbol {
  return mode === 'minor' ? 'i' : 'I';
}

/**
 * Las notas de un grado con su especie, con la tónica en cero.
 *
 * Es lo mismo que hace `blockChord`, pero sin pasar por `arrangement.ts`: ese
 * fichero arrastra la captura y la reproducción, y `paths.ts` —que llama a este
 * juez— no debería cargar con ellas ni arriesgar un ciclo de importaciones.
 */
function notasDe(mode: KeyMode, degree: DegreeSymbol, especie: EspecieDeBloque | null) {
  const acorde = resolveDegree(0, mode, degree);
  if (especie === null) {
    return { root: acorde.root, notas: acorde.notes };
  }
  return {
    root: acorde.root,
    notas: esEspecieSimple(especie)
      ? notasDeEspecieSimple(acorde.root, especie)
      : seventhNotes(acorde.root, especie),
  };
}

function funcionDe(
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
  move: MoveId | null,
): Funcion {
  if (degree === tonicaDe(mode)) {
    return 'tonica';
  }
  // El bII es napolitano —una salida de casa— hasta que lleva la séptima de
  // dominante o se declara como tritono: entonces es el sustituto del V.
  if (move === 'tritono' || (degree === 'bII' && especie === 'dominant7')) {
    return 'tritono';
  }
  if (degree === 'bVII' || degree === 'VII' || degree === 'v') {
    return 'modal';
  }
  return POR_PAPEL[roleOfDegreeSymbol(degree)];
}

function acordes(
  mode: KeyMode,
  pasos: readonly PasoJuzgado[],
  especieDe: (paso: PasoJuzgado, i: number) => EspecieDeBloque | null,
): Acorde[] {
  let inicio = 0;
  return pasos.map((paso, i) => {
    const especie = especieDe(paso, i);
    const move = paso.move ?? null;
    const { root, notas } = notasDe(mode, paso.degree, especie);
    const acorde: Acorde = {
      degree: paso.degree,
      beats: paso.beats,
      root,
      notas,
      especie,
      move,
      inicio,
      funcion: funcionDe(mode, paso.degree, especie, move),
    };
    inicio += paso.beats;
    return acorde;
  });
}

function pulsos(pasos: readonly { readonly beats: number }[]): number {
  return pasos.reduce((suma, paso) => suma + paso.beats, 0);
}

/**
 * Los pulsos que puede durar un acorde nuevo sin salirse del compás: medio compás
 * —si eso son dos pulsos o más—, uno entero, dos o cuatro. En cuatro por cuatro,
 * 2, 4, 8 y 16; en tres por cuatro, 3, 6 y 12.
 */
function rejillaDelCompas(pc: number): number[] {
  const medio = pc % 2 === 0 && pc >= 4 ? [pc / 2] : [];
  return [...medio, pc, 2 * pc, 4 * pc, 8 * pc].filter((b) => b <= 16);
}

/**
 * Lo que dura un acorde de lo tuyo **de costumbre**: lo que más se repite, o la
 * media si empatan. Es lo que dura cada acorde que se añade, y la vara con la que
 * el juez mide el paso de la armonía: **la misma en los dos sitios** —por eso se
 * exporta y `paths.ts` no tiene la suya—, o lo que allí cuadra aquí saldría cojo.
 *
 * Una toma de 5, 3, 6 y 2 pulsos es un compás de cuatro tocado desigual, y la
 * media lo dice. **Y lo que sale se lleva a la rejilla del compás**: antes una toma
 * con dos acordes de un pulso entre otros de seis decía que lo de costumbre era un
 * pulso, y cada compás nuevo salía de un golpe —o no salía ninguno, porque una
 * frase de dieciséis golpes no cabe en treinta y dos compases—. Si lo de costumbre
 * no cae en la rejilla, vale el de la rejilla más cercano a la media: lo tocado
 * desigual se cuadra, no se copia.
 */
export function pulsosHabituales(
  pasos: readonly { readonly beats: number }[],
  pulsosPorCompas: number,
): number {
  const cuenta = new Map<number, number>();
  for (const paso of pasos) {
    cuenta.set(paso.beats, (cuenta.get(paso.beats) ?? 0) + 1);
  }
  const maximo = Math.max(...cuenta.values());
  const ganadores = [...cuenta].filter(([, veces]) => veces === maximo);
  const media = pulsos(pasos) / Math.max(1, pasos.length);
  const crudo = ganadores.length === 1 ? ganadores[0]![0] : Math.round(media);
  const rejilla = rejillaDelCompas(pulsosPorCompas);
  if (rejilla.includes(crudo)) {
    return crudo;
  }
  // Un riff a golpes —todo más corto que medio compás y en su sitio— va a golpes
  // de verdad: lo que se añada, también. Dos golpes sueltos entre acordes largos
  // no lo son, y esos se cuadran como cualquier toma desigual.
  const medio = rejilla[0]!;
  let inicio = 0;
  const aGolpes = pasos.every((paso) => {
    const enSuSitio = { beats: paso.beats, inicio };
    inicio += paso.beats;
    return vaAGolpes(enSuSitio, medio) || (paso.beats === medio && enSuSitio.inicio % medio === 0);
  });
  if (aGolpes && crudo < medio) {
    return crudo;
  }
  // El más cercano a la media; a igual distancia, el más largo, que es el que no
  // deja golpes sueltos.
  return rejilla.reduce((mejor, b) => (Math.abs(b - media) <= Math.abs(mejor - media) ? b : mejor));
}

/** El acorde que suena en un pulso, contando desde el primero de la canción. */
function acordeEnPulso(pasos: readonly Acorde[], pulso: number): Acorde | undefined {
  return pasos.find((paso) => paso.inicio <= pulso && pulso < paso.inicio + paso.beats);
}

/** El acorde que suena al empezar un compás. */
function acordeEnCompas(j: Juicio, pasos: readonly Acorde[], compas: number): Acorde | undefined {
  return acordeEnPulso(pasos, compas * j.pc);
}

/**
 * Los compases de la salida que no son tuyos tal cual: los que traen otro acorde
 * y, además, los que solo duran otra cosa.
 */
function compasesNuevos(
  kind: PathKind,
  original: readonly PathStep[],
  cancion: readonly PasoJuzgado[],
): { readonly nuevos: Set<number>; readonly cambiados: Set<number> } {
  const nuevos = new Set<number>();
  const cambiados = new Set<number>();
  cancion.forEach((paso, i) => {
    const antes = original[i];
    // Al continuar, lo tuyo va delante tal cual y lo nuevo empieza detrás.
    if (kind === 'continuar' && antes !== undefined) {
      return;
    }
    if (antes === undefined || antes.degree !== paso.degree) {
      cambiados.add(i);
      nuevos.add(i);
    } else if (antes.beats !== paso.beats) {
      nuevos.add(i);
    }
  });
  return { nuevos, cambiados };
}

/** Si un compás se oyó con duda y sigue siendo el mismo: lo construido encima vale menos. */
function esDudoso(j: Juicio, i: number): boolean {
  return j.contexto.dudosos?.[i] === true && j.cancion[i]!.degree === j.original[i]?.degree;
}

/** Los enlaces que la salida pone: de un acorde a otro, con uno de los dos suyo. */
function enlacesNuevos(j: Juicio): number[] {
  const enlaces: number[] = [];
  for (let k = 1; k < j.cancion.length; k += 1) {
    const toca = j.cambiados.has(k) || j.cambiados.has(k - 1);
    if (toca && j.cancion[k]!.degree !== j.cancion[k - 1]!.degree) {
      enlaces.push(k);
    }
  }
  return enlaces;
}

/**
 * El enlace de vuelta de un bucle retocado: del último compás al primero.
 *
 * Un bucle vuelve a empezar, y entonces su último acorde **prepara el primero**
 * —lo que mira aquí `notasComunes`—. Sin contarlo en la sintaxis y en el bajo, el
 * III7 que lleva de vuelta al vi de `vi IV I III7` se juzgaba como un acorde que
 * sale de casa hacia ningún sitio. Solo si la salida toca uno de los dos
 * extremos: si no, la vuelta ya era tuya.
 *
 * **Y solo si es un bucle** (`Juicio.bucle`). Antes se suponía siempre, y un pre
 * `ii iii IV V` salía con «tu bucle vuelve a empezar por V ii, una retrogresión»:
 * un pre no vuelve a su principio, va al estribillo.
 */
function enlaceDeVuelta(j: Juicio): readonly [Acorde, Acorde] | null {
  const ultimo = j.cancion.length - 1;
  const [primero, final] = [j.cancion[0]!, j.cancion[ultimo]!];
  const toca = j.cambiados.has(ultimo) || j.cambiados.has(0);
  return j.bucle && toca && final.funcion !== 'tonica' && final.degree !== primero.degree
    ? [final, primero]
    : null;
}

/**
 * Junta los hechos de varios enlaces o compases en uno.
 *
 * **La media, pero tirando del peor**: una retrogresión entre cuatro enlaces
 * buenos no se diluye en la media, que es justo lo que hacía que `V IV I`
 * pareciera una salida razonable. Y se cuenta el peor si estropea, o el mejor si
 * no: es el hecho que el porqué tiene que poder contar.
 */
function juntar(hechos: readonly { readonly hecho: Hecho; readonly peso: number }[]): Hecho {
  if (hechos.length === 0) {
    return NADA;
  }
  const pesoTotal = hechos.reduce((suma, { peso }) => suma + peso, 0);
  const media = hechos.reduce((suma, { hecho, peso }) => suma + hecho.valor * peso, 0) / pesoTotal;
  const ordenados = [...hechos].sort((a, b) => a.hecho.valor - b.hecho.valor);
  const peor = ordenados[0]!.hecho;
  const mejor = ordenados[ordenados.length - 1]!.hecho;
  const descarte = hechos.find(({ hecho }) => hecho.descarte !== undefined)?.hecho.descarte;
  const reparo = hechos.find(({ hecho }) => hecho.reparo !== undefined)?.hecho.reparo;
  return {
    valor: acotar(0.6 * media + 0.4 * peor.valor),
    motivo: peor.valor < 0 ? peor.motivo : mejor.motivo,
    ...(descarte === undefined ? {} : { descarte }),
    ...(reparo === undefined ? {} : { reparo }),
  };
}

// ─── 1. Sintaxis funcional ────────────────────────────────────────────────────

/**
 * Cuánto vale que una dominante con sensible vuelva a la subdominante, `V IV`.
 *
 * En blues es el giro de los compases 9 y 10, y en rock y en el pop de guitarras
 * se oye a diario —`vi V IV V`—; en el folk de canción, el country y el
 * bluegrass también existe, aunque menos. Solo en jazz y en bolero es deshacer la
 * tensión sin resolverla, que allí no se hace: su idioma es la dominante que
 * resuelve. Sin estilo se juzga como la armonía de siempre, con una penalización
 * moderada.
 *
 * El folk lo descartaba, y no salía de ningún repertorio: salía de que el corpus
 * del arreglista no tenía un folk con `V IV`.
 */
const RETROGRESION: Readonly<Record<StyleId | 'ninguno', number>> = {
  blues: 0.6,
  // El funk deja la dominante sin resolver a propósito —`V7 IV7`, el vamp que vuelve—,
  // y el reggae va y viene entre los tres de siempre: `I IV V IV`.
  funk: 0.4,
  reggae: 0.4,
  rock: 0.3,
  // `V iv` es la rumba de todos los días: `i iv V iv`.
  flamenco: 0.2,
  metal: 0,
  // El honky-tonk lo tiene, sin que sea su firma: la suya es el II7 que va al V.
  country: 0,
  pop: -0.1,
  cine: -0.2,
  folk: -0.3,
  // El bolero vive de que cada dominante llegue: volver atrás es deshacer lo que es.
  bolero: -0.8,
  jazz: -1,
  ninguno: -0.4,
};

/** Los estilos donde `V IV` no se ofrece nunca: los que viven de que la dominante llegue. */
const SIN_RETROGRESION: ReadonlySet<StyleId> = new Set(['jazz', 'bolero']);

/**
 * Cuánto vale cerrar sin sensible: `bVII I` en mayor, `VII i` o `v i` en menor.
 *
 * El bVII que cierra es **el idioma del rock y del folk**: el mixolidio del rock,
 * el vaivén `I bVII` de la gaita y del folk celta, el eólico de la balada
 * tradicional. Antes el folk lo castigaba en mayor y el porqué decía que «sonaba
 * a otro idioma», que es justo lo contrario de lo que pasa. El pop lo usa como
 * color prestado, y **el jazz y el bolero son los que llegan con la dominante**:
 * en jazz el bVII solo vale como puerta de atrás (`iv bVII I`, aparte). En menor el
 * VII es de la escala, pero los dos cierran con la dominante armónica, `V7 i`: el
 * `VII i` no tiene ni la puerta de atrás que lo salva en mayor, y no se ofrece.
 *
 * De los demás: el funk vive en el mixolidio —el bVII7 es de casa— y el cine sube
 * por `bVI bVII I`; el reggae en menor es `i VII`, la mitad de su repertorio. El
 * country y el flamenco llegan con la sensible y se permiten el bVII de vez en
 * cuando: en flamenco la sensible es la del V mayor, y el VII de la andaluza es un
 * escalón de la bajada, no un cierre.
 */
const SIN_SENSIBLE: Readonly<Record<KeyMode, Readonly<Record<StyleId | 'ninguno', number>>>> = {
  major: {
    rock: 1,
    metal: 1,
    folk: 0.8,
    funk: 0.8,
    cine: 0.8,
    blues: 0.6,
    country: 0.6,
    reggae: 0.6,
    pop: 0.4,
    flamenco: 0.4,
    jazz: -0.6,
    bolero: -0.6,
    ninguno: 0.4,
  },
  minor: {
    rock: 1,
    metal: 1,
    reggae: 1,
    cine: 1,
    folk: 0.9,
    funk: 0.9,
    pop: 0.8,
    blues: 0.6,
    country: 0.6,
    flamenco: 0.4,
    jazz: -1,
    bolero: -1,
    ninguno: 0.6,
  },
};

/**
 * Cuánto vale que el bVII se quede fuera un compás más, `bVII IV`: el doble
 * plagal, del rock y también del folk mixolidio (`I bVII IV I`).
 */
const DOBLE_PLAGAL: Readonly<Record<StyleId | 'ninguno', number>> = {
  rock: 0.7,
  cine: 0.6,
  metal: 0.5,
  folk: 0.5,
  funk: 0.5,
  blues: 0.4,
  reggae: 0.4,
  country: 0.3,
  pop: 0.2,
  flamenco: 0,
  jazz: -0.6,
  bolero: -0.6,
  ninguno: 0,
};

/**
 * Los estilos en los que el bVII es **de la casa**: los que cierran sin sensible
 * tanto como con ella (`SIN_SENSIBLE` de mayor). En ellos el mixolidio es un modo
 * propio: el bVII no resta en el estilo ni cuenta para el tope de préstamos. Antes
 * el folk lo pesaba como un préstamo raro y restaba lo que la sintaxis daba por
 * bueno; en rock y en metal el préstamo ya pesaba como lo de casa.
 */
export function bVIIDeLaCasa(estilo: StyleId | undefined): boolean {
  return estilo !== undefined && SIN_SENSIBLE.major[estilo] >= 0.8;
}

/**
 * Si lo tuyo, en menor, **eligió la sensible**: tiene el V y no tiene ni la v ni
 * el VII. Es el menor armónico de `i iv V7 i`, y ahí cerrar con `VII i` le cambia
 * el idioma aunque el estilo lo admita. Con el VII ya en lo tuyo —la andaluza, el
 * rock de `i VII VI V`— las dos maneras conviven.
 */
function eligioLaSensible(j: Juicio): boolean {
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  return j.mode === 'minor' && tuyos.has('V') && !tuyos.has('v') && !tuyos.has('VII');
}

/**
 * Lo que vale cerrar sin sensible aquí: lo que diga el estilo, y nada si lo tuyo
 * eligió tenerla.
 */
function sinSensible(j: Juicio): number {
  const delEstilo = SIN_SENSIBLE[j.mode][estiloOno(j)];
  return eligioLaSensible(j) ? -1 : delEstilo;
}

function estiloOno(j: Juicio): StyleId | 'ninguno' {
  return j.estilo ?? 'ninguno';
}

/** En qué estilo, dicho en una frase: «en jazz», o «sin estilo elegido». */
function enEstilo(j: Juicio): string {
  return j.estilo === undefined ? 'sin estilo elegido' : `en ${j.estilo}`;
}

/** Si un grado es la relativa de la tónica: donde cae una cadencia rota de verdad. */
function esRelativaDeLaTonica(degree: DegreeSymbol): boolean {
  return degree === 'vi' || degree === 'VI';
}

/**
 * Si un acorde con séptima de dominante **hace de dominante** de `b` aunque su
 * grado no lo sea: el I7 que va al IV es el V/IV, el VI7 de menor que baja al V es
 * el sustituto tritonal de su dominante. Quien construye las salidas ya los cuenta
 * así, y el juez tiene que oír lo mismo: sin esto, el `I7 IV` del gospel salía como
 * «sale de casa» y no como la dominante que llega.
 *
 * **Solo cuando llega**: un I7 que se queda —la tónica de un blues o de un funk—
 * es la tónica con su color, no una promesa sin cumplir. Las que ya son
 * dominantes por su grado —el V, las secundarias, el bII7, el bVII que cierra sin
 * sensible— se juzgan por lo suyo.
 */
function llegaComoDominante(a: Acorde, b: Pick<Acorde, 'root' | 'degree'>): Hecho | null {
  const porSuGrado =
    a.funcion === 'tonica' || a.funcion === 'subdominante' || a.funcion === 'sustituto';
  if (a.especie !== 'dominant7' || !porSuGrado) {
    return null;
  }
  const de = `${a.degree}7 ${b.degree}`;
  if (b.root === (a.root + 5) % 12) {
    return {
      valor: 1,
      motivo: `${de}: el ${a.degree}7 hace de dominante del ${b.degree}, y llega.`,
    };
  }
  if (b.root === (a.root + 11) % 12 && b.degree === 'V') {
    return {
      valor: 0.8,
      motivo: `${de}: el ${a.degree}7 baja medio tono a la dominante, como un sustituto tritonal.`,
    };
  }
  return null;
}

/**
 * Lo que vale el enlace del compás `k - 1` al `k`.
 *
 * `sigue` dice si después de `k` hay más música: una cadencia rota solo lo es
 * si la frase continúa.
 */
function enlace(j: Juicio, k: number, sigue = k < j.cancion.length - 1): Hecho {
  const a = j.cancion[k - 1]!;
  const b = j.cancion[k]!;
  const de = `${a.degree} ${b.degree}`;
  const estilo = estiloOno(j);

  // En un vamp sin tónica, sus dos acordes no son una dominante y una
  // subdominante de Do: son el centro y su vecino. Ir y volver entre ellos es
  // el idioma de lo tuyo, no una retrogresión.
  if (j.modal === 'sin-tonica' && j.vamp!.includes(a.degree) && j.vamp!.includes(b.degree)) {
    return { valor: 0.5, motivo: `${de}: el vaivén de tu vamp.` };
  }
  // La dominante con sensible y sin ella seguidas: la misma nota, natural y
  // alterada, de un acorde al siguiente. Es la falsa relación, y no hay estilo
  // que la quiera entre dos acordes que hacen lo mismo.
  if ((a.degree === 'v' && b.degree === 'V') || (a.degree === 'V' && b.degree === 'v')) {
    return {
      valor: -1,
      motivo: `${de}: la misma dominante sin sensible y con ella, una falsa relación.`,
      descarte: `${de} es una falsa relación`,
    };
  }

  const comoDominante = llegaComoDominante(a, b);
  if (comoDominante !== null) {
    return comoDominante;
  }

  switch (a.funcion) {
    case 'secundaria':
    case 'tritono': {
      // Las dos apuntan a un sitio: la secundaria una quinta abajo, el tritono
      // medio tono abajo. Llegar a otro es prometer algo y no darlo.
      const destino = (a.root + (a.funcion === 'secundaria' ? 5 : 11)) % 12;
      if (b.root === destino) {
        return { valor: 1, motivo: `${de}: ${a.degree} llega a lo que preparaba.` };
      }
      return (
        colorDeCine(j, a, b) ?? {
          valor: -0.8,
          motivo: `${de}: ${a.degree} prepara otro acorde y no llega a él.`,
        }
      );
    }
    case 'dominante':
      return desdeLaDominante(j, sigue, a, b, j.cancion[k + 1], de);
    case 'modal':
      return desdeElModal(j, k, a, b, de, estilo);
    case 'subdominante':
      return desdeLaSubdominante(j, a, b, de);
    case 'sustituto':
      return {
        valor: b.funcion === 'tonica' ? 0.2 : 0.6,
        motivo:
          b.funcion === 'tonica'
            ? `${de}: llega a la tónica de rebote, desde otro reposo.`
            : `${de}: sale del reposo hacia ${b.degree}.`,
      };
    case 'tonica':
      return { valor: 0.5, motivo: `${de}: sale de casa, que puede ir a cualquier sitio.` };
  }
}

/**
 * En el cine, una dominante secundaria **en tríada** que no va a lo suyo no es una
 * promesa rota: es color. Si salta una tercera es una **mediante cromática** —el III
 * mayor de `I V/vi`, el VI mayor de `V/ii I`—, que comparte una nota con el de al
 * lado y cambia el mundo; y el II mayor que vuelve a casa, `I V/V I`, es el **lidio**.
 * Con la séptima de dominante sí promete, y se juzga como cualquier secundaria; y
 * fuera del cine, también. Nulo si no es ninguno de los dos.
 */
function colorDeCine(j: Juicio, a: Acorde, b: Pick<Acorde, 'root' | 'degree'>): Hecho | null {
  if (j.estilo !== 'cine' || a.funcion !== 'secundaria' || a.especie === 'dominant7') {
    return null;
  }
  const de = `${a.degree} ${b.degree}`;
  if ([3, 4, 8, 9].includes((b.root - a.root + 12) % 12)) {
    return {
      valor: 0.5,
      motivo: `${de}: el ${a.degree} en tríada no prepara, colorea: una mediante cromática.`,
    };
  }
  return a.degree === 'V/V' && b.degree === j.tonica
    ? { valor: 0.5, motivo: `${de}: el II mayor que vuelve a casa, el color lidio.` }
    : null;
}

function desdeLaDominante(
  j: Juicio,
  sigue: boolean,
  a: Acorde,
  b: Acorde,
  despues: Acorde | undefined,
  de: string,
): Hecho {
  if (b.funcion === 'tonica') {
    // Sin la sensible —una v menor, un Vsus4— llega a casa, pero no resuelve como
    // dominante: no hay nota que suba. La de quintas sí se dice así: no tiene
    // tercera, ni mayor ni menor, y su bajo es el de la dominante.
    return {
      valor: 1,
      motivo:
        llevaSensible(a) || a.especie === 'quinta'
          ? `${de}: la dominante resuelve en la tónica.`
          : `${de}: la dominante, sin sensible, vuelve a la tónica.`,
    };
  }
  // `V bVI` es la cadencia rota con el bVI prestado, la de las baladas: la tabla
  // pone el bVI con la subdominante, y por eso salía como una retrogresión —en
  // jazz, descartada— cuando es una promesa de casa que se desvía.
  if (j.mode === 'major' && a.degree === 'V' && b.degree === 'bVI') {
    return sigue
      ? { valor: 0.3, motivo: `${de}: cadencia rota, promete la tónica y da el bVI prestado.` }
      : { valor: 0, motivo: `${de}: acaba en el bVI, sin cerrar.` };
  }
  if (
    b.funcion === 'subdominante' &&
    despues?.degree === a.degree &&
    (j.estilo === undefined || !SIN_RETROGRESION.has(j.estilo) || b.root === 2)
  ) {
    // `V ii V` no vuelve atrás: vuelve a preparar la misma dominante, que sigue
    // ahí detrás. Es el ii–V repetido del jazz y el vecino de un pedal de V, y lo
    // que deshace la tensión es irse a la subdominante y quedarse. En jazz y en
    // bolero solo el ii: `V IV V` es el vecino del rock, no su ii–V.
    return {
      valor: Math.max(0.4, RETROGRESION[estiloOno(j)]),
      motivo: `${de} ${a.degree}: vuelve a preparar la dominante, que sigue ahí.`,
    };
  }
  if (b.funcion === 'subdominante') {
    const valor = RETROGRESION[estiloOno(j)];
    const motivo =
      valor > 0
        ? `${de}: la dominante vuelve a la subdominante, que en ${j.estilo} es idioma.`
        : `${de}: la dominante vuelve a la subdominante sin resolver, una retrogresión.`;
    return j.estilo !== undefined && SIN_RETROGRESION.has(j.estilo)
      ? { valor, motivo, descarte: `${de} vuelve atrás, y ${enEstilo(j)} no se hace.` }
      : { valor, motivo };
  }
  if (esRelativaDeLaTonica(b.degree)) {
    // Una cadencia rota de verdad alarga la frase: promete la casa y sigue. Si
    // la canción se acaba ahí, no es un engaño: es un final que no llega.
    return sigue
      ? { valor: 0.3, motivo: `${de}: cadencia rota, promete la tónica y da su relativa.` }
      : { valor: 0, motivo: `${de}: acaba en la relativa, sin cerrar.` };
  }
  if (b.funcion === 'sustituto') {
    return {
      valor: -0.8,
      motivo: `${de}: la dominante va a ${b.degree} sin resolver.`,
    };
  }
  if (b.funcion === 'secundaria' && despues !== undefined && despues.root === (b.root + 5) % 12) {
    // `V III7 vi`: la tensión no se deshace, se desvía hacia otra llegada que sí
    // se da. Es una cadencia rota con su dominante delante, no una promesa rota.
    return {
      valor: 0.4,
      motivo: `${de} ${despues.degree}: la dominante se desvía hacia otra llegada, y llega.`,
    };
  }
  return { valor: -0.2, motivo: `${de}: la dominante pasa a otra tensión sin resolver.` };
}

function desdeElModal(
  j: Juicio,
  k: number,
  a: Acorde,
  b: Acorde,
  de: string,
  estilo: StyleId | 'ninguno',
): Hecho {
  if (b.funcion === 'tonica') {
    // iv bVII I es la «puerta de atrás» del jazz: ahí el bVII sí es idioma.
    if (estilo === 'jazz' && a.degree === 'bVII' && j.cancion[k - 2]?.degree === 'iv') {
      return { valor: 0.3, motivo: `iv ${de}: la puerta de atrás, el bVII del jazz.` };
    }
    const valor = sinSensible(j);
    // Donde cerrar sin sensible no cabe —un jazz menor, un menor que eligió su V—
    // no es un color flojo: es otro idioma, y no se ofrece. Salvo que ese acorde
    // ya sea tuyo: entonces el idioma es el tuyo. Y solo como cadencia final: de
    // paso, en medio de la frase, el VII no cierra nada.
    const tuyo = j.original.some((acorde) => acorde.degree === a.degree);
    const cierra = k === j.cancion.length - 1;
    return {
      valor,
      motivo:
        valor > 0
          ? `${de}: cierra sin sensible.`
          : eligioLaSensible(j)
            ? `${de}: cierra sin sensible, y lo tuyo llega con la del V.`
            : `${de}: cierra sin sensible, y ${enEstilo(j)} se llega con la dominante.`,
      ...(valor <= -1 && !tuyo && cierra
        ? { descarte: `${de} cierra sin la sensible que aquí se pide` }
        : {}),
    };
  }
  if (b.degree === 'IV' || b.degree === 'iv') {
    const valor = DOBLE_PLAGAL[estilo];
    return {
      valor,
      motivo:
        valor >= 0
          ? `${de}: el ${a.degree} se queda fuera un compás más, el doble plagal.`
          : `${de}: el ${a.degree} se queda fuera un compás más, y ${enEstilo(j)} se llega con la dominante.`,
    };
  }
  return { valor: 0.3, motivo: `${de}: sigue fuera de casa, bajando por el modo.` };
}

function desdeLaSubdominante(j: Juicio, a: Acorde, b: Acorde, de: string): Hecho {
  switch (b.funcion) {
    case 'dominante':
    case 'tritono':
      return { valor: 1, motivo: `${de}: la subdominante prepara la dominante.` };
    case 'modal':
      // IV bVII es el mismo idioma que bVII IV, y pesa lo mismo según el estilo;
      // iv bVII en jazz es la puerta de atrás. En menor el VII es de la escala.
      if (b.degree === 'bVII' && !(j.estilo === 'jazz' && a.degree === 'iv')) {
        const valor = DOBLE_PLAGAL[estiloOno(j)];
        const que = bVIIDeLaCasa(j.estilo) ? 'que' : 'un préstamo que';
        return {
          valor,
          motivo:
            valor >= 0
              ? `${de}: de la salida al bVII, ${que} cierra sin sensible.`
              : `${de}: de la salida al bVII, y ${enEstilo(j)} se llega con la dominante.`,
        };
      }
      return { valor: 0.6, motivo: `${de}: de la salida a la tensión.` };
    case 'secundaria':
      return { valor: 0.6, motivo: `${de}: de la salida a la tensión.` };
    case 'tonica':
      return { valor: 0.6, motivo: `${de}: ${llegadaDesdeLaSubdominante(a.degree)}.` };
    case 'sustituto':
      return { valor: 0.3, motivo: `${de}: de la salida a otro reposo.` };
    case 'subdominante':
      // `IV iv` nubla la subdominante camino de casa; `iv IV` la vuelve a aclarar,
      // que es deshacer el color que se acababa de poner.
      if (j.mode === 'major' && a.degree === 'iv' && b.degree === 'IV') {
        return { valor: -0.6, motivo: `${de}: vuelve a aclarar lo que el iv acababa de nublar.` };
      }
      if (b.root === a.root) {
        return { valor: 0.6, motivo: `${de}: el mismo bajo con otro color.` };
      }
      // ii IV vuelve atrás dentro de la misma función; IV ii se adelanta.
      return a.root === 2
        ? { valor: -0.1, motivo: `${de}: retrocede dentro de la subdominante.` }
        : { valor: 0.3, motivo: `${de}: se queda en la zona blanda.` };
  }
}

function sintaxis(j: Juicio): Hecho {
  const vuelta = enlaceDeVuelta(j);
  return juntar([
    ...enlacesNuevos(j).map((k) => ({
      hecho: enlace(j, k),
      peso: esDudoso(j, k - 1) ? 0.5 : 1,
    })),
    ...(vuelta === null ? [] : [{ hecho: enlace({ ...j, cancion: vuelta }, 1, true), peso: 1 }]),
  ]);
}

// ─── 2. Cadencia por posición ─────────────────────────────────────────────────

/**
 * Cómo se llega a la tónica final.
 *
 * `plagal` es **llegar desde la subdominante**, cualquiera: el IV y el iv, que son
 * la plagal de verdad, y también el ii, el bVI o el bII sin séptima, que cierran
 * con la misma fuerza y otro nombre (`nombreDelCierre`). `sensible` es el vii°
 * tríada: lleva la sensible pero no la dominante entera, y no cierra como ella.
 */
type Cierre = 'perfecta' | 'sin-sensible' | 'plagal' | 'sensible' | 'rebote' | 'ninguna';

interface Final {
  readonly cierre: Cierre;
  /** Desde qué paso suena la tónica final, si acaba en ella. */
  readonly desde: number;
  /** El compás —desde cero— en el que llega. */
  readonly compas: number;
  readonly antes: Acorde | undefined;
}

/**
 * Si un acorde es el vii° **tríada**: la sensible con dos notas de la dominante
 * encima y sin su fundamental. Con su séptima —el semidisminuido, el disminuido—
 * es la dominante de novena sin bajo y hace su papel; sin ella, en un pop o un
 * rock, suena a ejercicio de armonía y no a llegada.
 */
function esSensibleSuelta(acorde: Pick<Acorde, 'degree' | 'especie'>): boolean {
  return acorde.degree === 'vii°' && (acorde.especie === null || acorde.especie === 'dim');
}

/**
 * Los estilos en los que el vii° tríada no es una dominante: los de canción, y el
 * flamenco y el cine, donde la sensible sin su V suena a ejercicio de coral. El jazz
 * y el bolero lo tocan con su séptima, y ahí sí hace de dominante.
 */
const POPULARES: ReadonlySet<StyleId> = new Set([
  'pop',
  'rock',
  'metal',
  'folk',
  'blues',
  'funk',
  'country',
  'reggae',
  'flamenco',
  'cine',
]);

/** Si el vii° tríada, aquí, no hace de dominante: en los estilos de canción. */
function sensibleSueltaFloja(j: Juicio, acorde: Acorde): boolean {
  return esSensibleSuelta(acorde) && j.estilo !== undefined && POPULARES.has(j.estilo);
}

/** Cómo cierra la canción, si acaba en la tónica. */
function finalDe(j: Juicio): Final | null {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  if (ultimo.funcion !== 'tonica') {
    return null;
  }
  let desde = j.cancion.length - 1;
  while (desde > 0 && j.cancion[desde - 1]!.funcion === 'tonica') {
    desde -= 1;
  }
  const antes = j.cancion[desde - 1];
  const POR_FUNCION: Readonly<Record<Funcion, Cierre>> = {
    dominante: 'perfecta',
    tritono: 'perfecta',
    modal: 'sin-sensible',
    subdominante: 'plagal',
    sustituto: 'rebote',
    secundaria: 'rebote',
    tonica: 'ninguna',
  };
  const cierre: Cierre =
    antes === undefined
      ? 'ninguna'
      : esSensibleSuelta(antes)
        ? 'sensible'
        : POR_FUNCION[antes.funcion];
  return {
    cierre,
    desde,
    compas: j.cancion[desde]!.inicio / j.pc,
    antes,
  };
}

const FUERZA: Readonly<Record<Cierre, number>> = {
  perfecta: 1,
  'sin-sensible': 0.75,
  plagal: 0.55,
  sensible: 0.5,
  rebote: 0.1,
  ninguna: 0,
};

/**
 * Lo que cierra el vii° tríada: menos que una plagal, y en un estilo de canción
 * casi nada. Contaba como `perfecta`, porque la tabla de papeles lo pone con la
 * dominante, y un `IV vii° I` salía como un cierre fuerte en un pop.
 */
function fuerzaDeLaSensible(j: Juicio, antes: Acorde): number {
  return sensibleSueltaFloja(j, antes) ? 0.3 : FUERZA.sensible;
}

/**
 * Cómo se llama la cadencia, **por el acorde que llega y no solo por su papel**.
 *
 * La plagal es IV I —o iv I, la menor—: el amén. Antes cualquier subdominante que
 * llegaba a casa se llamaba así, y un `ii I` salía como «cadencia plagal, el
 * amén», que no lo es. Y la perfecta desde el bII7 es la del sustituto tritonal.
 */
function nombreDelCierre(cierre: Cierre, antes: Acorde | undefined): string {
  switch (cierre) {
    case 'perfecta':
      return antes?.funcion === 'tritono'
        ? 'cadencia perfecta por el sustituto tritonal'
        : 'cadencia perfecta';
    case 'sin-sensible':
      return 'cierra sin sensible';
    case 'plagal':
      return llegadaDesdeLaSubdominante(antes!.degree);
    case 'sensible':
      return 'llega desde el vii°, con la sensible y sin la dominante entera';
    case 'rebote':
      return 'llega de rebote, sin cadencia';
    case 'ninguna':
      return 'todo es tónica, no hay cadencia';
  }
}

/** Cómo se llama llegar a casa desde una subdominante: la plagal solo desde el IV. */
function llegadaDesdeLaSubdominante(degree: DegreeSymbol): string {
  if (degree === 'IV') {
    return 'cadencia plagal, el amén';
  }
  if (degree === 'iv') {
    return 'cadencia plagal menor';
  }
  return `llega desde el ${degree} sin pasar por la dominante`;
}

/**
 * Lo que cierra una cadencia sin sensible **en este estilo**: entera en un rock,
 * la mitad en un jazz en menor y casi nada en uno en mayor, donde `bVII I` o `v i`
 * suenan a otro idioma. Es lo mismo que ya decía la sintaxis (`SIN_SENSIBLE`), y
 * sin esto la cadencia lo contradecía: un `v i` cerraba un jazz casi tan bien
 * como un `V i`.
 */
function fuerzaSinSensible(j: Juicio): number {
  return FUERZA['sin-sensible'] * (0.5 + 0.5 * sinSensible(j));
}

/**
 * Si la tónica llega donde el oído la espera.
 *
 * Dos sitios valen: **el último compás de un grupo de cuatro** —o el tercero, si
 * la tónica se sostiene hasta el cuarto, como en `ii V I I`— y **el primero del
 * grupo siguiente**, que es donde cae el acorde final de una canción que acababa
 * en V: `I vi IV V | I`. Lo segundo es lo que haría un arreglista con un bucle
 * abierto, y es la razón de que cinco compases no sean una frase coja si el
 * quinto es la llegada.
 */
function llegaATiempo(j: Juicio, final: Final): number {
  const { compas } = final;
  if (!Number.isInteger(compas)) {
    return 0.25;
  }
  // De cuatro en cuatro, o del largo de tus frases si son otro.
  const grupo = j.frase;
  const alAbrir = compas > 0 && compas % grupo === 0 && j.largo - compas <= grupo;
  const alCerrar = j.largo % grupo === 0 && j.largo - compas <= 2;
  if (alAbrir || alCerrar) {
    return compas % (2 * grupo) === 0 || j.largo % (2 * grupo) === 0 ? 1 : 0.9;
  }
  return 0.5;
}

/** Si un acorde deja la frase en tensión: la semicadencia, o la vuelta que vuelve a empezar. */
function esTension(acorde: Acorde): boolean {
  return familia(acorde.funcion) === 'D';
}

/**
 * Cómo llega lo tuyo a casa: **los dos acordes de antes de tu tónica final** —el que
 * va a ella y el que lo prepara— o, si lo tuyo es un bucle que empieza en la tónica y
 * acaba fuera, tus dos últimos, que son los que llevan de vuelta al principio. Nulo
 * si no llega de ninguna manera; el de antes, nulo si no lo hay.
 *
 * Con dos y no con uno: `IV iv I` no es la llegada de `I iv I iv` aunque acabe igual,
 * es la plagal menor preparada —una de las tres respuestas del arreglista—, y
 * mirando solo el iv salía como «otra vuelta más».
 */
function tuLlegada(
  j: Juicio,
): { readonly antes: DegreeSymbol | null; readonly llega: DegreeSymbol } | null {
  const tuyos = j.original;
  const ultimo = tuyos[tuyos.length - 1]!;
  if (ultimo.funcion !== 'tonica') {
    return tuyos[0]!.funcion === 'tonica'
      ? { antes: distintoAntes(tuyos, tuyos.length - 1), llega: ultimo.degree }
      : null;
  }
  let desde = tuyos.length - 1;
  while (desde > 0 && tuyos[desde - 1]!.funcion === 'tonica') {
    desde -= 1;
  }
  const llega = tuyos[desde - 1]?.degree;
  return llega === undefined ? null : { antes: distintoAntes(tuyos, desde - 1), llega };
}

/** El primer acorde distinto que suena antes del `i`: un acorde que se sostiene es uno. */
function distintoAntes(pasos: readonly Acorde[], i: number): DegreeSymbol | null {
  let k = i - 1;
  while (k >= 0 && pasos[k]!.degree === pasos[i]!.degree) {
    k -= 1;
  }
  return pasos[k]?.degree ?? null;
}

function cadencia(j: Juicio, final: Final | null): Hecho {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  if (j.path === 'contraste') {
    // Lo único que no puede contrastar es un final: detrás no viene otra parte.
    const falta = faltaLaLlegada(j, final);
    return falta === null
      ? vueltaDelContraste(j, ultimo)
      : {
          valor: -1,
          motivo: `La parte nueva acaba en ${ultimo.degree}: ${falta}.`,
          descarte: falta,
        };
  }
  if (final !== null) {
    const propia = cadenciaPropia(
      j.mode,
      j.original.map((acorde) => acorde.degree),
    );
    const fuerza =
      (j.modal === null ? undefined : FUERZA_EN_MODAL[final.cierre]) ??
      (propia === null
        ? undefined
        : final.cierre === 'perfecta'
          ? FUERZA_PROPIA.perfecta
          : final.antes?.degree === propia
            ? FUERZA_PROPIA.suya
            : undefined) ??
      (final.cierre === 'sin-sensible'
        ? fuerzaSinSensible(j)
        : final.cierre === 'sensible'
          ? fuerzaDeLaSensible(j, final.antes!)
          : FUERZA[final.cierre]);
    // En un vamp sobre la tónica no hay dominante que esperar: su vuelta es la del
    // cuarto (`alCuartoYVuelta`), y cierra como cierra un modo sin sensible.
    const fuerzaAqui =
      alCuartoYVuelta(j) === null ? fuerza : Math.max(fuerza, FUERZA['sin-sensible']);
    const aTiempo = llegaATiempo(j, final);
    const de = final.antes === undefined ? j.tonica : `${final.antes.degree} ${j.tonica}`;
    const donde =
      j.modal !== null && final.cierre === 'perfecta'
        ? 'pero lo tuyo no tiene sensible'
        : propia !== null && final.cierre === 'perfecta'
          ? `pero lo tuyo llega por el ${propia}`
          : aTiempo >= 0.9
            ? 'y llega en el compás fuerte'
            : 'pero llega a destiempo de la frase';
    // Una cadencia floja solo suena a final por contraste. Si es la misma con la
    // que lo tuyo ya llegaba a casa —o con la que tu bucle da la vuelta—, lo que se
    // oye es otra vuelta más: `I V vi IV` cerrado con `IV I` no acaba, gira. La
    // perfecta no tiene ese problema: cierra por sí misma, y tampoco la que en tu
    // idioma vale lo que ella —el `VII i` de un menor que llega por el VII, el `bVII
    // I` de un riff mixolidio—: es la cadencia fuerte de tu canción, no una floja.
    //
    // **Y solo si de verdad puede venir otra vuelta.** No si lo que se añade es el
    // final —detrás no hay nada, y el `IV I` tras `I V vi IV` es el amén—, ni si
    // la llegada cae dentro de tu última frase, que estaba sin acabar: entonces
    // no empieza otra, completa la tuya. Es lo que pasaba con un rock de 31
    // compases en `I bVII IV I` que acababa en IV: su compás 32 es la I que cierra
    // la frase como cierran todas las suyas.
    const terminaAqui = parteConPapel(j)?.papel === 'final';
    const completaTuFrase = final.compas < Math.ceil(j.largoOriginal / j.frase) * j.frase;
    const tuya = tuLlegada(j);
    const otraVuelta =
      j.kind === 'continuar' &&
      !terminaAqui &&
      !completaTuFrase &&
      fuerza < FUERZA.perfecta &&
      final.antes !== undefined &&
      tuya !== null &&
      final.antes.degree === tuya.llega &&
      (tuya.antes === null || distintoAntes(j.cancion, final.desde - 1) === tuya.antes);
    // Si cerrar sin sensible resta aquí, el motivo dice por qué: el nombre solo no.
    const nombre =
      final.cierre === 'sin-sensible' && j.modal === null && sinSensible(j) < 0
        ? 'cierra sin la sensible que aquí se espera'
        : nombreDelCierre(final.cierre, final.antes);
    const motivo = `${de} en el ${final.compas + 1}: ${nombre}, ${donde}.`;
    // **Lo dudoso no sostiene la llegada**: si lo que lleva a la tónica final es un
    // compás tuyo que el micro oyó con duda y sigue ahí, la canción cierra solo si el
    // micro acertó. Se dice, y no cuenta más que no decir nada (lo encontró el
    // corpus final: «de tu VII a la i» sobre un VII dudoso, como cierre seguro).
    const antes = final.desde - 1;
    if (
      antes >= 0 &&
      antes < j.original.length &&
      j.contexto.dudosos?.[antes] === true &&
      j.cancion[antes]!.degree === j.original[antes]!.degree
    ) {
      return {
        valor: Math.min(0, acotar(fuerzaAqui * aTiempo * 1.2 - 0.2)),
        motivo: `${de} en el ${final.compas + 1}: llega desde tu ${final.antes!.degree}, que se oyó con duda: si no era ese, no cierra.`,
      };
    }
    // **Una cadencia que pone la salida y llega a mitad de compás** deja la frase coja:
    // con acordes de dos pulsos, la tónica cae en el 3 del último compás y la frase se
    // queda con medio compás de más o de menos (el quinto examen). Si ya llegabas así,
    // no es culpa de la salida.
    const aMitad = !Number.isInteger(final.compas) && j.cambiados.has(final.desde);
    if (!otraVuelta) {
      return {
        valor: acotar(fuerzaAqui * aTiempo * 1.2 - 0.2),
        motivo,
        ...(aMitad ? { reparo: 'la cadencia llega a mitad de compás' } : {}),
      };
    }
    // Es tu vuelta tocada otra vez, y cierra a medias: vale la mitad. Si además es
    // floja —plagal o de rebote— no hay nada que la haga final, **pero eso es un
    // reparo y no un descarte**: que haya un final mejor es relativo. Lo modal no
    // entra: su cadencia fuerte es justo la que ya tenía.
    const floja = final.cierre === 'plagal' || final.cierre === 'rebote';
    return {
      valor: acotar(fuerza * 0.5 * aTiempo * 1.2 - 0.2),
      motivo: `${motivo} Es la misma llegada que la tuya: suena a otra vuelta más que a un final.`,
      ...(floja && j.modal === null
        ? { reparo: 'cierra con la misma llegada floja que tu vuelta' }
        : {}),
    };
  }
  // El V de un flamenco es su reposo (`reposoFrigio`): llega como llega una cadencia
  // sin sensible, por su color, y a tiempo o no según dónde caiga.
  const frigio = reposoFrigio(
    j.mode,
    j.estilo,
    j.original.map((acorde) => acorde.degree),
    j.cancion.map((acorde) => acorde.degree),
  );
  if (frigio !== null) {
    const llegada = j.cancion[frigio]!;
    const compas = llegada.inicio / j.pc;
    const aTiempo = llegaATiempo(j, {
      cierre: 'sin-sensible',
      desde: frigio,
      compas,
      antes: j.cancion[frigio - 1],
    });
    return {
      valor: acotar(0.9 * aTiempo * 1.2 - 0.2),
      motivo: `${j.cancion[frigio - 1]!.degree} V en el ${compas + 1}: llega al V, el reposo frigio ${j.estilo === 'flamenco' ? 'del flamenco' : 'de la andaluza'}${aTiempo >= 0.9 ? '' : ', pero a destiempo de la frase'}.`,
    };
  }
  // Acaba abierto. Lo que eso vale depende de para qué sea la parte.
  const falta = faltaLaLlegada(j, final);
  if (falta !== null) {
    // También si tu final ya acababa abierto: retocarlo sin cerrarlo deja un
    // final que no es final, y eso no se ofrece aunque no lo haya traído la salida.
    return { valor: -1, motivo: `Acaba en ${ultimo.degree}: ${falta}.`, descarte: falta };
  }
  // Un bucle que retocas acaba donde acababa lo tuyo, fuera de casa, porque vuelve
  // a empezar: su final es esa vuelta, y se juzga como enlace. Pero solo es un
  // bucle si lo tuyo lo era (`Juicio.bucle`): un pre o un puente van hacia fuera,
  // y su último acorde no prepara su primero sino la parte que viene.
  if (j.bucle) {
    return vueltaDelBucle(j, ultimo);
  }
  const enGrupo = Number.isInteger(j.largo) && j.largo % j.frase === 0;
  let valor: number;
  let motivo: string;
  if (esTension(ultimo)) {
    valor = enGrupo ? 0.2 : -0.2;
    // La semicadencia es la que se para en el V; lo demás que tensa —un vii°, un
    // bVII, una secundaria— deja la frase en tensión, pero no tiene ese nombre.
    const como = ultimo.degree === 'V' ? 'semicadencia' : 'queda en tensión';
    motivo = enGrupo
      ? `Acaba en ${ultimo.degree} en el compás ${j.largo}: ${como}, pide seguir.`
      : `Acaba en ${ultimo.degree} a mitad de un grupo de ${j.frase === 4 ? 'cuatro' : j.frase}.`;
  } else {
    valor = ultimo.funcion === 'subdominante' ? -0.1 : -0.3;
    motivo = `Acaba en ${ultimo.degree}, ni en la tónica ni en la dominante.`;
  }
  const abierta = parteConPapel(j)?.papel;
  if (abierta !== undefined && QUEDAN_ABIERTAS.has(abierta)) {
    const [articulo, abierto] =
      abierta === 'pre' || abierta === 'puente' ? ['Un', 'abierto'] : ['Una', 'abierta'];
    return {
      valor: acotar(valor + 0.5),
      motivo: `${motivo} ${articulo} ${abierta} puede quedar ${abierto}.`,
    };
  }
  return { valor, motivo };
}

/** Cómo vuelve a empezar un bucle retocado: del último compás al primero. */
function vueltaDelBucle(j: Juicio, ultimo: Acorde): Hecho {
  const primero = j.cancion[0]!;
  if (ultimo.degree === primero.degree) {
    return {
      valor: 0,
      motivo: `Tu bucle vuelve a empezar en el mismo ${ultimo.degree} en el que acaba.`,
    };
  }
  const vuelta = enlace({ ...j, cancion: [ultimo, primero] }, 1, true);
  return {
    valor: acotar(vuelta.valor * 0.8),
    motivo: `Tu bucle vuelve a empezar por ${vuelta.motivo}`,
  };
}

/**
 * Un contraste no cierra: lo que importa es **cómo vuelve** al principio.
 *
 * Su último acorde enlaza con tu primero, y ese enlace se juzga como cualquier
 * otro: acabar en V y volver a tu I es la vuelta que suena a vuelta.
 */
function vueltaDelContraste(j: Juicio, ultimo: Acorde): Hecho {
  const vuelta = comoVuelveElContraste(j, ultimo);
  // **Y un contraste que ya ha pasado por casa no tiene vuelta que hacer.** Cada
  // tónica en medio de la parte nueva es una llegada antes de tiempo: un puente
  // `IV V I vi IV I V/V V` resuelve dos veces y luego «vuelve» a donde ya estaba.
  // Solo lo pesaba la novedad, a 0,06, y esos puentes salían primeros; se cuenta
  // aquí, que es la cadencia de la parte, y pesa lo que pesa llegar.
  const tonicas = j.cancion
    .slice(j.original.length, -1)
    .filter((acorde) => acorde.funcion === 'tonica').length;
  if (tonicas === 0 || ultimo.funcion === 'tonica') {
    return vuelta;
  }
  // La vuelta, por buena que sea, ya no suena a vuelta: se queda en la mitad. Y
  // **dos veces es reposar**, no pasar: un contraste que vuelve a casa dos veces
  // por el camino no se ha ido, y solo entra si no hay tres que se vayan.
  return {
    valor: acotar(Math.min(vuelta.valor, 0.5) - 0.5 * tonicas),
    motivo: `La parte nueva ya llega a la ${j.tonica} ${tonicas === 1 ? 'una vez' : `${tonicas} veces`} antes de volver: la vuelta se gasta antes de tiempo.`,
    ...(tonicas >= 2 ? { reparo: 'un contraste que reposa en la tónica' } : {}),
  };
}

/** Cómo enlaza el último acorde del contraste con tu primero. */
function comoVuelveElContraste(j: Juicio, ultimo: Acorde): Hecho {
  const primero = j.original[0]!;
  if (ultimo.funcion === 'tonica') {
    return {
      valor: -0.3,
      motivo: `La parte nueva acaba en ${ultimo.degree}: ya ha cerrado y la vuelta no se nota.`,
    };
  }
  if (ultimo.degree === primero.degree) {
    return {
      valor: -0.2,
      motivo: `La parte nueva acaba en ${ultimo.degree}, el acorde con el que empiezas: la vuelta no se oye.`,
    };
  }
  const vuelta = enlace({ ...j, cancion: [ultimo, primero] }, 1, true);
  return {
    valor: acotar(vuelta.valor * 0.8),
    motivo: `Vuelve a tu principio por ${vuelta.motivo}`,
  };
}

// ─── 3. Frase ─────────────────────────────────────────────────────────────────

/**
 * Lo que puede sonar en el compás 9 de un blues: la dominante, o lo que la
 * prepara si llega a ella en el 10 —el ii–V del blues de jazz, el II7, el bVI7 que
 * baja medio tono al V—, o su sustituto tritonal.
 */
const PREPARAN_EL_DIEZ: ReadonlySet<DegreeSymbol> = new Set(['ii', 'ii°', 'V/V', 'bVI', 'VI']);
const DOMINANTES_DEL_NUEVE: ReadonlySet<DegreeSymbol> = new Set(['V', 'v', 'bII']);

/**
 * Si doce compases son un blues, **por los compases que hacen la forma** y no por
 * los grados exactos: la tónica en el 1, la llegada al cuarto grado en el 5, la
 * vuelta a casa en el 7 o en el 11, y en el 9 la dominante, su sustituto o lo que
 * la prepara para el 10.
 *
 * Antes se pedía un V justo en el 9, y el blues de jazz —`ii V` en el 9 y el 10,
 * el II7 delante del V— salía como «rompe la forma» con el estilo blues puesto: el
 * coro más corriente de un trío de jazz descartado por no ser el de Chicago. Lo
 * que no es blues sigue sin serlo: sin tónica en el 1, sin cuarto en el 5 o sin
 * nada que tire a casa en el 9, la forma no está.
 *
 * Lo usan el juez y quien construye los coros (`paths.ts`): si cada uno
 * reconociera el blues a su manera, uno ofrecería coros que el otro descarta.
 */
export function formaDeBlues(
  mode: KeyMode,
  en: (compas: number) => DegreeSymbol | undefined,
): boolean {
  const tonica = tonicaDe(mode);
  const cuarto = mode === 'minor' ? 'iv' : 'IV';
  const nueve = en(8);
  const llegaAlDiez = en(9) === 'V' || en(9) === 'v';
  const elNueve =
    nueve !== undefined &&
    (DOMINANTES_DEL_NUEVE.has(nueve) || (PREPARAN_EL_DIEZ.has(nueve) && llegaAlDiez));
  return en(0) === tonica && en(4) === cuarto && (en(6) === tonica || en(10) === tonica) && elNueve;
}

/**
 * Si ocho compases son **los ocho primeros de un blues**: la tónica en el 1, el 3 y
 * el 4, el cuarto grado en el 5 y el 6, la vuelta a casa en el 7 y el 8, y en el 2
 * la tónica o el cambio rápido. Es una forma empezada, y lo que la sigue la
 * completa con los cuatro compases que faltan: una frase de ocho detrás deja un
 * blues de dieciséis. Lo encontró el corpus final: con los ocho primeros de un
 * blues en La, todas las salidas añadían ocho y las llamaban estribillo.
 *
 * **Y tiene que sonar a blues**: con el estilo, o con todo en séptimas de blues. `I I
 * I I IV IV I I` en tríadas es también una canción de folk de ocho compases, y esa
 * no pide doce.
 *
 * Como `formaDeBlues`, lo usan el juez y quien construye las salidas.
 */
export function bluesAMedias(
  mode: KeyMode,
  en: (compas: number) => DegreeSymbol | undefined,
  compases: number,
  { estilo, especies }: Pick<ContextoDeSalidas, 'estilo' | 'especies'>,
): boolean {
  const tonica = tonicaDe(mode);
  const cuarto = mode === 'minor' ? 'iv' : 'IV';
  const suenaABlues =
    estilo === 'blues' ||
    (especies !== undefined &&
      especies.every((especie) => especie === 'dominant7' || especie === 'minor7'));
  return (
    suenaABlues &&
    compases === 8 &&
    [0, 2, 3, 6, 7].every((compas) => en(compas) === tonica) &&
    (en(1) === tonica || en(1) === cuarto) &&
    en(4) === cuarto &&
    en(5) === cuarto
  );
}

/** Si lo que suena desde el compás `desde` es un blues de doce (`formaDeBlues`). */
function esBluesDeDoce(j: Juicio, pasos: readonly Acorde[], desde = 0): boolean {
  if (pulsos(pasos) / j.pc - desde < 12) {
    return false;
  }
  return formaDeBlues(j.mode, (compas) => acordeEnCompas(j, pasos, desde + compas)?.degree);
}

function frase(j: Juicio, final: Final | null, blues: boolean): Hecho {
  const { largoOriginal } = j;
  // Una tónica final sostenida no alarga la frase: es la llegada que se queda
  // sonando. `ii V I I` con el último el doble siguen siendo cuatro compases.
  const ultimo = j.cancion[j.cancion.length - 1]!;
  const habitual = pulsosHabituales(j.original, j.pc);
  // Un blues se cuenta de doce en doce; lo demás, de cuatro en cuatro o del largo
  // de tus frases, si son otro a propósito (`fraseDe`).
  const grupo = blues ? 12 : j.frase;
  const deCuantas = grupo === 4 ? 'de cuatro en cuatro' : `de ${grupo} en ${grupo}, como las tuyas`;
  const sostenida =
    final !== null && ultimo.beats > habitual ? (ultimo.inicio + habitual) / j.pc : j.largo;
  // Contar la llegada sostenida como un compás solo vale si eso da compases: una
  // tónica de dos pulsos tras acordes de uno no deja la frase a mitad de compás.
  const largo = j.largo % grupo === 0 || !Number.isInteger(sostenida) ? j.largo : sostenida;
  // Dicho como es: si la tónica sostenida no se cuenta, la canción dura más que la frase.
  const cuantos =
    largo === j.largo ? `${largo} compases` : `${largo} compases y la llegada sostenida`;
  // Continuar y otro final deciden el largo; rearmonizar no lo toca, y estirar lo
  // dobla o lo parte a propósito. Pero un estirar que no da ni el doble ni la
  // mitad de lo tuyo —un acorde largo que no se estira con los demás— también lo
  // ha decidido, y lo ha dejado cojo.
  const proporcionado = j.largo === 2 * largoOriginal || 2 * j.largo === largoOriginal;
  const decideElLargo =
    j.kind === 'continuar' || j.path === 'otro-final' || (j.path === 'estirar' && !proporcionado);
  const coja = (motivo: string, descarte: string): Hecho =>
    decideElLargo ? { valor: -1, motivo, descarte } : { valor: -1, motivo };
  if (j.largo === largoOriginal && largo % grupo !== 0) {
    return {
      valor: 0,
      motivo:
        largoOriginal === 1 ? 'Mantiene tu compás.' : `Mantiene tus ${largoOriginal} compases.`,
    };
  }
  if (!Number.isInteger(largo)) {
    return coja(
      `Acaba a mitad de compás: ${largo.toFixed(1)} compases.`,
      'la frase acaba a mitad de compás',
    );
  }
  if (largo % grupo === 0) {
    return {
      valor: 1,
      motivo: blues
        ? `${cuantos}: la forma de doce del blues, entera.`
        : `${cuantos}: la frase se cuenta ${deCuantas}.`,
    };
  }
  if (
    final !== null &&
    final.compas > 0 &&
    final.compas % grupo === 0 &&
    largo - final.compas <= 2
  ) {
    return {
      valor: 0.7,
      motivo: `${cuantos}: la tónica cae en el ${final.compas + 1}, el compás fuerte que abre el grupo siguiente.`,
    };
  }
  if (blues) {
    return { valor: -0.6, motivo: `${cuantos}: rompe la forma de doce del blues.` };
  }
  // Tus frases son de otro largo, y esta no lo respeta: cuadrar a cuatro una forma
  // de tres en tres es romperla, aunque ocho «cuadre».
  if (grupo !== 4) {
    return coja(
      `${cuantos}: rompe tus frases de ${grupo}.`,
      `rompe tus frases de ${grupo} compases`,
    );
  }
  if (4 % largo === 0) {
    return {
      valor: 0.2,
      motivo: `Una vuelta de ${largo === 1 ? 'un compás' : `${largo} compases`}, que cabe en la frase de cuatro.`,
    };
  }
  if (largoOriginal >= 4 && largo % largoOriginal === 0) {
    return { valor: 0.8, motivo: `${cuantos}: tu frase de ${largoOriginal}, repetida.` };
  }
  if (largo % 2 === 0) {
    return { valor: -0.5, motivo: `${cuantos}: la frase no cuadra de cuatro en cuatro.` };
  }
  return coja(`${cuantos}: la frase queda coja.`, `una frase coja de ${largo} compases`);
}

// ─── 4. Ritmo armónico ────────────────────────────────────────────────────────

/**
 * Si un acorde corto va **a golpes**: dura una fracción exacta de la mitad del
 * compás y cae en su sitio. Un riff a un pulso por acorde es un ritmo armónico
 * tan regular como uno a cuatro; lo desigual es mezclar duraciones que no caben
 * en la rejilla —cinco y tres—, no que sean cortas.
 */
function vaAGolpes(paso: { readonly beats: number; readonly inicio: number }, unidad: number) {
  return paso.beats < unidad && unidad % paso.beats === 0 && paso.inicio % paso.beats === 0;
}

/**
 * Si la salida cuadra una toma desigual; `null` si tu toma ya iba a tiempo.
 *
 * Una toma de 5, 3, 6 y 2 pulsos es un compás de cuatro tocado desigual: lo que
 * se construya encima hereda el tropiezo, y lo que la cuadra lo arregla. Cuadrar
 * es que todo empiece a tiempo y dure lo mismo, o compases enteros: estirar esa
 * toma al doble da 10, 6, 12 y 4, que caen a tiempo y siguen siendo desiguales.
 */
function cuadraLaToma(j: Juicio): boolean | null {
  const unidad = j.pc % 2 === 0 ? j.pc / 2 : j.pc;
  const aTiempo = (paso: Acorde) => paso.inicio % unidad === 0 && paso.beats % unidad === 0;
  if (j.original.every((paso) => aTiempo(paso) || vaAGolpes(paso, unidad))) {
    return null;
  }
  const iguales = new Set(j.cancion.map((paso) => paso.beats)).size === 1;
  return (
    j.cancion.every(aTiempo) && (iguales || j.cancion.every((paso) => paso.beats % j.pc === 0))
  );
}

function ritmoArmonico(j: Juicio): Hecho {
  const habitual = pulsosHabituales(j.original, j.pc);
  const unidad = j.pc % 2 === 0 ? j.pc / 2 : j.pc;
  const tuyos = new Set(j.original.map((paso) => paso.beats));
  // Estirar lo cambia todo a la vez y a propósito; al continuar, un compás de
  // otro largo es la canción cambiando de paso a mitad.
  const uniforme = j.path === 'estirar';
  const ultimo = j.cancion.length - 1;

  const cuadra = cuadraLaToma(j);
  if (cuadra !== null) {
    return cuadra
      ? { valor: 1, motivo: 'Cuadra tu toma: cada acorde dura lo mismo, o compases enteros.' }
      : { valor: -1, motivo: 'Tu toma va desigual y esta salida no la cuadra.' };
  }

  // Un acorde cambiado en su sitio no cambia el paso: solo se mira lo que dura
  // otra cosa o empieza en otro pulso.
  const mira = [...j.nuevos].filter((i) => {
    const antes = j.original[i];
    const paso = j.cancion[i]!;
    return j.kind === 'continuar' || antes?.beats !== paso.beats || antes.inicio !== paso.inicio;
  });
  // Más del doble que el más largo de lo tuyo no es otro paso: es relleno, un
  // acorde que se queda sonando compases enteros para cuadrar y no propone nada.
  // Mantener la llegada el doble sí es música; cuatro veces, tiempo muerto.
  const tope = 2 * Math.max(...j.original.map((paso) => paso.beats));
  const hechos = mira.map((i): Hecho => {
    const paso = j.cancion[i]!;
    const b = paso.beats;
    if (b > tope) {
      return {
        valor: -1,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos, más del doble que el más largo de lo tuyo: rellena.`,
        reparo: 'rellena: un acorde que dura más del doble que los tuyos',
      };
    }
    // Primero el de un pulso: es el que deja a destiempo a todos los de detrás.
    if (b === 1 && !tuyos.has(1)) {
      return {
        valor: -1,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura un pulso, y lo tuyo no tenía ninguno así.`,
      };
    }
    if (paso.inicio % unidad !== 0 && !vaAGolpes(paso, unidad)) {
      return {
        valor: -0.8,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} cambia de acorde a destiempo del compás.`,
      };
    }
    if (b === habitual) {
      return {
        valor: 1,
        motivo: `Los acordes nuevos duran ${b === 1 ? 'un pulso' : `${b} pulsos`}, como los tuyos.`,
      };
    }
    if (i === ultimo && paso.funcion === 'tonica' && b % habitual === 0) {
      return { valor: 1, motivo: `La tónica final dura ${b} pulsos: la llegada se sostiene.` };
    }
    if (b % unidad !== 0) {
      return {
        valor: -0.5,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos: no cuadra con el compás.`,
      };
    }
    // Un riff a golpes que ya mezcla uno y dos pulsos no cambia de paso por
    // repetir una de sus duraciones: es su ritmo.
    if (!uniforme && b < j.pc && tuyos.has(b)) {
      return {
        valor: 0.6,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos, como algunos tuyos.`,
      };
    }
    // El reggae cambia cada compás o cada medio compás: el vaivén a dos pulsos es
    // su paso, no otro.
    if (!uniforme && j.estilo === 'reggae' && 2 * b === j.pc && habitual === j.pc) {
      return {
        valor: 0.4,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura medio compás: el vaivén del reggae.`,
      };
    }
    if (!uniforme) {
      return {
        valor: -0.5,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos donde tú tenías ${habitual}: cambia el paso de la armonía.`,
      };
    }
    if (b < habitual) {
      if (b >= j.pc) {
        return {
          valor: 0.4,
          motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos, un compás entero.`,
        };
      }
      return [...tuyos].some((tuyo) => tuyo <= b)
        ? {
            valor: 0.3,
            motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos, como algunos tuyos.`,
          }
        : {
            valor: -0.6,
            motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${b} pulsos donde tú tenías ${habitual}: corre más que lo tuyo.`,
          };
    }
    return b === habitual * 2
      ? { valor: 0.3, motivo: `Todo dura el doble: ${b} pulsos por acorde.` }
      : {
          valor: 0.1,
          motivo: `El ${paso.degree} del ${compasDe(j, paso)} pasa a durar ${b} pulsos.`,
        };
  });
  return juntar(hechos.map((hecho) => ({ hecho, peso: 1 })));
}

// ─── 5. Bajo ──────────────────────────────────────────────────────────────────

/**
 * Lo que vale cada salto del bajo, en semitonos hacia arriba.
 *
 * Bajar una quinta es lo más fuerte que hay (V I) y subir un tono es el
 * escalón que empuja (IV V, bVII I). Bajar una tercera es suave —comparten dos
 * notas— y subirla es débil: es lo que hace `vi I`, llegar de rebote. El tritono
 * es el salto más raro. Los dos semitonos se deciden aparte, porque dependen de
 * quién baja: el sustituto tritonal lo hace a propósito.
 */
const SALTO_DEL_BAJO: Readonly<Record<number, { valor: number; nombre: string }>> = {
  0: { valor: 0.2, nombre: 'se queda en la misma nota' },
  2: { valor: 0.7, nombre: 'sube un tono' },
  3: { valor: 0, nombre: 'sube una tercera, el salto débil' },
  4: { valor: 0, nombre: 'sube una tercera, el salto débil' },
  5: { valor: 1, nombre: 'baja una quinta, el enlace más fuerte' },
  6: { valor: -0.6, nombre: 'salta una cuarta aumentada' },
  7: { valor: 0.5, nombre: 'sube una quinta' },
  8: { valor: 0.5, nombre: 'baja una tercera, suave' },
  9: { valor: 0.5, nombre: 'baja una tercera, suave' },
  10: { valor: 0.4, nombre: 'baja un tono' },
};

function saltoDelBajo(a: Acorde, b: Acorde): Hecho {
  const salto = (b.root - a.root + 12) % 12;
  const de = `${a.degree} ${b.degree}`;
  if (salto === 11) {
    if (a.funcion === 'tritono') {
      return { valor: 0.8, motivo: `${de}: el bajo baja medio tono hasta lo que preparaba.` };
    }
    if (b.funcion === 'tritono') {
      return {
        valor: 0.6,
        motivo: `${de}: el bajo baja por semitonos hacia el sustituto tritonal.`,
      };
    }
    // VI V, la bajada frigia de la andaluza, también llega a algo. Y una secundaria
    // es una dominante, la de otro grado: Fa Mi7 en Do baja a la del vi.
    if (b.funcion === 'dominante') {
      return { valor: 0.4, motivo: `${de}: el bajo baja medio tono hasta la dominante.` };
    }
    if (b.funcion === 'secundaria') {
      return {
        valor: 0.4,
        motivo: `${de}: el bajo baja medio tono hasta una dominante secundaria.`,
      };
    }
    if (b.funcion === 'tonica') {
      return { valor: 0.4, motivo: `${de}: el bajo baja medio tono hasta la tónica.` };
    }
    return { valor: -0.4, motivo: `${de}: el bajo baja medio tono sin ir a ningún sitio.` };
  }
  if (salto === 1) {
    return a.funcion === 'dominante' && (b.funcion === 'tonica' || b.funcion === 'sustituto')
      ? { valor: 0.4, motivo: `${de}: el bajo sube medio tono, como una sensible.` }
      : { valor: -0.4, motivo: `${de}: el bajo sube medio tono sin resolver nada.` };
  }
  const { valor, nombre } = SALTO_DEL_BAJO[salto]!;
  return { valor, motivo: `${de}: el bajo ${nombre}.` };
}

function bajo(j: Juicio): Hecho {
  const vuelta = enlaceDeVuelta(j);
  return juntar([
    ...enlacesNuevos(j).map((k) => ({
      hecho: saltoDelBajo(j.cancion[k - 1]!, j.cancion[k]!),
      peso: esDudoso(j, k - 1) ? 0.5 : 1,
    })),
    ...(vuelta === null ? [] : [{ hecho: saltoDelBajo(...vuelta), peso: 1 }]),
  ]);
}

// ─── 6. Notas comunes y coherencia de los sustitutos ──────────────────────────

function comunes(a: Acorde, b: Acorde): number {
  return b.notas.filter((nota) => a.notas.includes(nota)).length;
}

/** Tónica y sustituto reposan igual; dominante y modal tensan igual. */
function familia(funcion: Funcion): string {
  const FAMILIA: Readonly<Record<Funcion, string>> = {
    tonica: 'T',
    sustituto: 'T',
    subdominante: 'S',
    dominante: 'D',
    modal: 'D',
    secundaria: 'D',
    tritono: 'D',
  };
  return FAMILIA[funcion];
}

/**
 * El grado que se trae del modo paralelo en lugar de cada diatónico de mayor.
 *
 * Se comprueba el resultado y no la etiqueta: bajar medio tono un `bVI` da un
 * `V`, y llamar a eso «el mismo grado del modo paralelo» sería mentir.
 */
const PRESTAMO: Readonly<Partial<Record<DegreeSymbol, DegreeSymbol>>> = {
  ii: 'bII',
  iii: 'bIII',
  vi: 'bVI',
  'vii°': 'bVII',
};

/** Si el sustituto que se ha puesto en el compás `i` se sostiene. */
function sustitucion(j: Juicio, i: number): Hecho {
  const antes = j.original[i]!;
  const ahora = j.cancion[i]!;
  const de = `${antes.degree} por ${ahora.degree} en el ${compasDe(j, ahora)}`;
  const previo = j.cancion[i - 1];
  let hecho: Hecho;
  if (
    antes.funcion === 'tonica' &&
    esRelativaDeLaTonica(ahora.degree) &&
    previo?.funcion === 'dominante'
  ) {
    hecho = {
      valor: 1,
      motivo: `${de}: cadencia rota de verdad, la relativa donde se esperaba la tónica tras ${previo.degree}.`,
    };
  } else if (PRESTAMO[antes.degree] === ahora.degree) {
    hecho = {
      valor: 0.4,
      motivo: `${de}: el mismo grado traído del modo paralelo, otro color.`,
    };
  } else {
    const notas = comunes(antes, ahora);
    const mismaFuncion = familia(antes.funcion) === familia(ahora.funcion);
    hecho =
      notas >= 2 || mismaFuncion
        ? {
            valor: notas >= 2 ? 0.8 : 0.5,
            motivo: `${de}: ${notasEnComun(notas)}${mismaFuncion ? ' y hacen el mismo papel' : ''}.`,
          }
        : {
            valor: -1,
            motivo: `${de}: ${notasEnComun(notas)} y no hacen el mismo papel.`,
          };
  }
  // Lo que se oyó con duda se puede **corregir**: lo que comparte dos notas con lo que
  // se oyó es lo que probablemente sonó —el micro confunde los parientes—, y eso es
  // lo que pidieron los dos arreglistas. Lo demás sería construir encima.
  if (j.contexto.dudosos?.[i] === true && hecho.valor > 0) {
    return comunes(antes, ahora) >= 2
      ? {
          valor: 0.6,
          motivo: `El ${compasDe(j, ahora)} se oyó con duda: ${ahora.degree} comparte dos notas con lo que se oyó, y puede ser lo que sonó.`,
        }
      : {
          valor: 0,
          motivo: `El ${compasDe(j, ahora)} se oyó con duda: sustituirlo es construir sobre algo que no se sabe.`,
        };
  }
  return hecho;
}

/**
 * Cuántos acordes tiene la línea de bajo de lo tuyo que pasa por el compás `i`, o
 * cero si no hay: una que baja —o sube— por grados conjuntos durante cuatro
 * acordes o más, o que **cae por quintas**: el
 * tetracordo del lamento, el bajo de la andaluza, el ciclo de quintas de `i iv
 * VII III VI ii° V`. Esa línea es lo que se oye de la progresión, y cambiar un
 * acorde de en medio por otro con otra fundamental la rompe aunque el acorde nuevo
 * encaje. La quinta del ciclo diatónico puede ser disminuida (`VI ii°`).
 */
function lineaDeBajo(j: Juicio, i: number): number {
  const paso = (k: number) => (j.original[k + 1]!.root - j.original[k]!.root + 12) % 12;
  const maneras = [
    (p: number) => p === 10 || p === 11,
    (p: number) => p === 1 || p === 2,
    (p: number) => p === 5 || p === 6,
  ];
  const pasos = j.original.length - 1;
  let larga = 0;
  for (const va of maneras) {
    let desde = 0;
    while (desde < pasos) {
      if (!va(paso(desde))) {
        desde += 1;
        continue;
      }
      let hasta = desde;
      while (hasta + 1 < pasos && va(paso(hasta + 1))) {
        hasta += 1;
      }
      // Los pasos de `desde` a `hasta` unen los acordes de `desde` a `hasta + 1`.
      const acordes = hasta - desde + 2;
      if (acordes >= 4 && desde <= i && i <= hasta + 1) {
        larga = Math.max(larga, acordes);
      }
      desde = hasta + 1;
    }
  }
  return larga;
}

/**
 * Si **toda la canción es una línea de bajo por grados**: cuatro acordes o más cuya
 * fundamental baja —o sube— un tono o un semitono cada vez, de principio a fin. Es
 * la andaluza, `i VII VI V`, el tetracordo del lamento: ahí la bajada es lo que se
 * oye, y es la forma aunque no llegue a seis. Lo usa también quien construye las
 * salidas (`paths.ts`), que no rompe esa línea.
 */
export function esUnaBajada(mode: KeyMode, grados: readonly DegreeSymbol[]): boolean {
  if (grados.length < 4) {
    return false;
  }
  // **Tocada dos veces sigue siendo una bajada**: `i VII VI V i VII VI V` es la
  // andaluza dos veces, y entre una vuelta y otra el V sube a la i. Se mira una.
  const vuelta = [4, 5, 6, 7, 8].find(
    (largo) =>
      largo < grados.length &&
      grados.length % largo === 0 &&
      grados.every((grado, i) => grado === grados[i % largo]),
  );
  if (vuelta !== undefined) {
    return esUnaBajada(mode, grados.slice(0, vuelta));
  }
  const raices = grados.map((grado) => resolveDegree(0, mode, grado).root);
  const pasos = raices.slice(1).map((raiz, i) => (raiz - raices[i]! + 12) % 12);
  return pasos.every((p) => p === 10 || p === 11) || pasos.every((p) => p === 1 || p === 2);
}

/**
 * Una línea de seis acordes o más ya no es un detalle del bajo: **es la forma de
 * la canción**, como el ciclo de quintas que la recorre entera. Romperla no se
 * ofrece; romper una de cuatro —la andaluza con un iv en vez del VII— resta.
 */
const LINEA_QUE_ES_LA_FORMA = 6;

/**
 * Lo que vale un compás cambiado por un movimiento **que cambia el papel a
 * propósito**, o nulo si no es uno de esos.
 *
 * La predominante pone una subdominante donde había tónica, el cambio rápido el IV
 * donde había I, el semitono frigio un acorde mayor que no se parece a nada de lo
 * que había: con la vara de la sustitución —dos notas en común o el mismo papel—
 * los tres salían «no hacen el mismo papel», que es justo lo que hacen. Se
 * validan como las dominantes, con lo que viene detrás: la predominante con la
 * dominante a la que lleva, el semitono con el centro al que baja, y el cambio
 * rápido con la tónica del 3, a la que vuelve.
 */
function porSuSitio(j: Juicio, i: number): Hecho | null {
  const ahora = j.cancion[i]!;
  const siguiente = j.cancion[i + 1];
  const compas = compasDe(j, ahora);
  switch (ahora.move) {
    case 'predominante':
      return siguiente !== undefined && (siguiente.degree === 'V' || siguiente.degree === 'v')
        ? {
            valor: 0.8,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: prepara la dominante, tónica, subdominante, dominante.`,
          }
        : null;
    case 'frigio':
      return siguiente !== undefined && siguiente.root === (ahora.root + 11) % 12
        ? {
            valor: 0.6,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: baja medio tono sin dominante, la cadencia frigia.`,
          }
        : null;
    case 'ii-v':
      return siguiente !== undefined && siguiente.move === 'ii-v'
        ? {
            valor: 0.8,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: la dominante partida en su ${ahora.degree} y ella, que llega preparada.`,
          }
        : null;
    case 'cambio-rapido':
      return {
        valor: 0.8,
        motivo: `${j.original[i]!.degree} por ${ahora.degree} en el ${compas}: el cambio rápido del blues, que vuelve a la tónica en el 3.`,
      };
    default:
      return null;
  }
}

function notasComunes(j: Juicio): Hecho {
  const hechos: Hecho[] = [];
  for (const i of j.cambiados) {
    const ahora = j.cancion[i]!;
    const tuyo = j.original[i];
    // Lo que lleva dentro la nota de tu bajo se toca sobre ella —el iv6 sobre el Fa
    // del VI de una andaluza— y la bajada sigue entera: no la rompe.
    // Solo en una bajada por grados: en un ciclo de quintas lo que se oye es la
    // secuencia de acordes, y un ii° sobre el Re del iv ya la rompe.
    const sobreTuBajo =
      tuyo !== undefined &&
      ahora.root !== tuyo.root &&
      ahora.notas.includes(tuyo.root) &&
      gradosDeLaEscala(j.mode).includes(ahora.degree) &&
      esUnaBajada(
        j.mode,
        j.original.map((acorde) => acorde.degree),
      );
    const linea = ahora.root === tuyo?.root || sobreTuBajo ? 0 : lineaDeBajo(j, i);
    if (j.path === 'rearmonizar' && sobreTuBajo && lineaDeBajo(j, i) > 0) {
      hechos.push({
        valor: 0.6,
        motivo: `${tuyo.degree} por ${ahora.degree} en el ${compasDe(j, ahora)}: se toca sobre la nota de tu bajo, y la línea sigue entera.`,
      });
    }
    if (j.path === 'rearmonizar' && linea > 0) {
      // La línea es la forma si es larga o si **toda tu canción baja —o sube— por
      // grados**: la andaluza son cuatro acordes y los cuatro son su bajada, y un V/V
      // en medio ya no es ella. Un ciclo de quintas corto no: ahí cambiar un eslabón
      // por su sustituto es el oficio (`esUnaBajada`).
      const esLaForma =
        linea >= LINEA_QUE_ES_LA_FORMA ||
        esUnaBajada(
          j.mode,
          j.original.map((acorde) => acorde.degree),
        );
      hechos.push({
        valor: -1,
        motivo: `Cambia el bajo del ${compasDe(j, ahora)}, que iba en línea con los de al lado: la rompe.`,
        ...(esLaForma ? { reparo: 'rompe la línea que hace la canción' } : {}),
      });
    }
    // Los movimientos que cambian el papel a propósito no se juzgan por lo que se
    // parecen a lo que había, sino por su sitio (`porSuSitio`).
    const suSitio = j.path === 'rearmonizar' ? porSuSitio(j, i) : null;
    if (suSitio !== null) {
      hechos.push(suSitio);
      continue;
    }
    // Lo que prepara se valida con lo que viene detrás, no con lo que había: una
    // secundaria, un tritono, y también la V que entra como «su dominante delante».
    if (
      ahora.funcion === 'secundaria' ||
      ahora.funcion === 'tritono' ||
      ahora.move === 'dominante'
    ) {
      // Se valida con el siguiente. El último de un bucle vuelve al principio, y el
      // de un contraste a tu primer compás; el de una parte que va hacia fuera
      // —un pre, un puente— prepara la que viene, que empieza en casa.
      const vuelve = j.bucle || j.kind === 'continuar';
      const siguiente = j.cancion[i + 1] ?? (vuelve ? j.cancion[0]! : TONICA[j.mode]);
      // Lo que va detrás, dicho como es: lo que suena, la vuelta a tu principio, o
      // la parte siguiente, que no está en la canción y empieza en casa.
      const detras =
        j.cancion[i + 1] !== undefined
          ? `y detrás viene ${siguiente.degree}`
          : vuelve
            ? `y al volver viene ${siguiente.degree}`
            : 'y lo que sigue empieza en casa';
      const saltoQueToca = ahora.funcion === 'tritono' ? 11 : 5;
      const llega = siguiente.root === (ahora.root + saltoQueToca) % 12;
      const color = llega ? null : colorDeCine(j, ahora, siguiente);
      hechos.push(
        llega
          ? {
              valor: 1,
              motivo: `${ahora.degree} ${siguiente.degree} en el ${compasDe(j, ahora)}: llega a lo que preparaba.`,
            }
          : color !== null
            ? { valor: 0.6, motivo: `${color.motivo.slice(0, -1)}, en el ${compasDe(j, ahora)}.` }
            : {
                valor: -1,
                motivo: `${ahora.degree} en el ${compasDe(j, ahora)} prepara otro acorde, ${detras}.`,
              },
      );
      // Pero esa V sí quita lo que había: vale si el compás solo alargaba el de
      // antes —el turnaround del 12 de un blues anuncia la I, no sustituye a
      // nadie— y si no, tiene que hacer su papel. Un IV cambiado por V en `I IV I V`
      // llega a la I y aun así se lleva la subdominante.
      const antes = j.original[i];
      const prolonga = antes !== undefined && j.cancion[i - 1]?.degree === antes.degree;
      if (llega && ahora.funcion === 'dominante' && j.path === 'rearmonizar' && !prolonga) {
        hechos.push(sustitucion(j, i));
      }
    } else {
      // El I7 que va al IV es su dominante (`llegaComoDominante`): se valida igual
      // que una secundaria cuando llega, y si no llega es su grado con color.
      const siguiente = j.cancion[i + 1];
      const comoDominante = siguiente === undefined ? null : llegaComoDominante(ahora, siguiente);
      if (comoDominante !== null) {
        hechos.push({
          valor: comoDominante.valor,
          motivo: `${ahora.degree}7 ${siguiente!.degree} en el ${compasDe(j, ahora)}: llega a lo que preparaba.`,
        });
      }
      // Solo rearmonizar pone un acorde **en lugar de** otro; otro final pone
      // una música distinta, y no tiene por qué parecerse a la que había.
      if (j.path === 'rearmonizar') {
        hechos.push(sustitucion(j, i));
      }
    }
  }
  return juntar(hechos.map((hecho) => ({ hecho, peso: 1 })));
}

// ─── 7. Melodía ───────────────────────────────────────────────────────────────

/**
 * Las tensiones que cada estilo admite sobre un acorde, en semitonos sobre su
 * fundamental: la novena en casi todos, la séptima menor en el rock y el blues
 * —y la tercera menor sobre el mayor, que es la gracia del blues—, y en jazz y
 * bolero también la sexta y la séptima mayor.
 */
const TENSIONES: Readonly<Record<StyleId | 'ninguno', readonly number[]>> = {
  jazz: [2, 9, 10, 11],
  // El bolero canta la sexta, la novena y la séptima mayor como el jazz.
  bolero: [2, 9, 10, 11],
  blues: [2, 3, 10],
  // El funk, las del blues y además la oncena del 7sus4 y la trecena.
  funk: [2, 3, 5, 9, 10],
  rock: [2, 10],
  country: [2, 9, 10],
  reggae: [2, 10],
  metal: [2],
  pop: [2],
  folk: [2, 5],
  // Y sobre el V, además, las del frigio mayor (`SOBRE_EL_V_DEL_FLAMENCO`).
  flamenco: [2, 10],
  // El cine canta la cuarta aumentada del lidio y la séptima mayor.
  cine: [2, 6, 11],
  ninguno: [],
};

/**
 * Lo que se canta sobre el V mayor de un flamenco, además de lo de todos: **la
 * novena menor y la tercera menor**, el Fa y el Sol natural sobre el Mi de una
 * andaluza en La. Es el frigio mayor, y en ese acorde no es un choque sino la
 * cadencia misma. Solo ahí: sobre el VI o el VII de la bajada, el semitono de
 * encima choca como en cualquier otro sitio.
 */
const SOBRE_EL_V_DEL_FLAMENCO: readonly number[] = [1, 3];

/** Las tensiones que admite un acorde en concreto: las del estilo, y las del V flamenco. */
function tensionesDe(j: Juicio, acorde: Acorde): readonly number[] {
  const delEstilo = TENSIONES[estiloOno(j)];
  return j.estilo === 'flamenco' && acorde.degree === 'V'
    ? [...delEstilo, ...SOBRE_EL_V_DEL_FLAMENCO]
    : delEstilo;
}

/**
 * Lo que es una nota del punteo contra un acorde: suya, color o choque. El choque
 * se dice por el lado: **encima** de una nota del acorde es la novena menor —un
 * Mib sobre Re, un Do sobre el Si de un Sol7—, la que no se aguanta en ningún
 * pulso; **debajo** es la que se oye y aun así se canta —el Fa contra el Fa# de un
 * Re7 es su novena aumentada, la del blues—.
 */
type NotaContra = 'cabe' | 'color' | 'choca-encima' | 'choca-debajo';

function notaContra(nota: number, acorde: Acorde, tensiones: readonly number[]): NotaContra {
  const sobreLaFundamental = (nota - acorde.root + 12) % 12;
  if (acorde.notas.includes(nota) || tensiones.includes(sobreLaFundamental)) {
    return 'cabe';
  }
  // La novena no choca aunque roce la tercera de un menor: se canta a diario.
  if (sobreLaFundamental === 2) {
    return 'color';
  }
  const a = (distancia: number) =>
    acorde.notas.some((suya) => (nota - suya + 12) % 12 === distancia);
  return a(1) ? 'choca-encima' : a(11) ? 'choca-debajo' : 'color';
}

function choca(como: NotaContra): boolean {
  return como === 'choca-encima' || como === 'choca-debajo';
}

/** Los acordes de la salida que suenan entre dos pulsos. */
function acordesEntre(j: Juicio, desde: number, hasta: number): Acorde[] {
  return j.cancion.filter(
    (acorde) => acorde.inicio < hasta && acorde.inicio + acorde.beats > desde,
  );
}

/**
 * Si el punteo sigue cabiendo en lo que suena debajo.
 *
 * **El punteo es tuyo y no se mueve**: cada compás de notas suena donde sonaba tu
 * acorde, y debajo va lo que la salida ponga en ese tiempo. Antes se miraba solo
 * el acorde que la salida cambiaba en su sitio, y estirar se daba por bueno «porque
 * el punteo se estira con los acordes»: no se estira, lo tocas tú. A doble tiempo
 * la canción dura la mitad y **la otra mitad del punteo se queda sin acordes**; a
 * medio tiempo, la nota de tu segundo compás cae sobre tu primer acorde, que dura
 * el doble. Ahora se mira por pulsos: la nota fuerte contra el acorde que suena al
 * empezar su compás, y la débil contra todos los que suenan mientras dura el suyo.
 * Lo que sigue siendo tu acorde no se mira: no es cosa de la salida.
 *
 * **Las débiles también cuentan, con la mitad de peso.** Que una nota de paso no
 * sea del acorde es lo normal —eso no resta—, pero una que roza a medio tono una
 * nota del acorde se oye aunque caiga en el pulso flojo, y más si se sostiene: un
 * Fa sobre un Re7 pasaba con 82 puntos porque no caía en el fuerte.
 */
function melodia(j: Juicio): Hecho & { readonly aplica: boolean } {
  const punteo = j.contexto.melodia;
  const hayNotas = punteo?.some((notas) => notas.length > 0) === true;
  const hayFuertes = punteo?.some((notas) => notas.some((nota) => nota.fuerte)) === true;
  // Al continuar el punteo es el tuyo y suena sobre tus acordes, que no cambian:
  // lo que se añade va detrás y no tiene punteo encima.
  if (!hayNotas || j.kind === 'continuar') {
    return { ...NADA, aplica: hayFuertes };
  }
  const otroAcorde = (acorde: Acorde, tuyo: Acorde) =>
    acorde.degree !== tuyo.degree || acorde.especie !== tuyo.especie;
  let fuertes = 0;
  let caben = 0;
  let choque: string | null = null;
  let choqueDebil: { readonly encima: boolean; readonly motivo: string } | null = null;
  let sinAcordes: { readonly fuerte: boolean; readonly compas: number } | null = null;
  for (const [i, tuyo] of j.original.entries()) {
    const notas = punteo![i] ?? [];
    const hasta = tuyo.inicio + tuyo.beats;
    const enElFuerte = acordeEnPulso(j.cancion, tuyo.inicio);
    const debajo = acordesEntre(j, tuyo.inicio, hasta).filter((acorde) => otroAcorde(acorde, tuyo));
    for (const nota of notas) {
      if (nota.fuerte) {
        if (enElFuerte === undefined) {
          // La primera fuerte que se queda sin nada es la que se cuenta.
          if (sinAcordes === null || !sinAcordes.fuerte) {
            sinAcordes = { fuerte: true, compas: compasDe(j, tuyo) };
          }
          continue;
        }
        if (!otroAcorde(enElFuerte, tuyo)) {
          continue;
        }
        const como = notaContra(nota.nota, enElFuerte, tensionesDe(j, enElFuerte));
        fuertes += 1;
        if (como === 'cabe') {
          caben += 1;
        }
        if (choca(como)) {
          choque ??= `En el ${compasDe(j, tuyo)}, una nota fuerte del punteo queda a medio tono de una del ${enElFuerte.degree}: choca de frente.`;
        }
        continue;
      }
      if (acordesEntre(j, tuyo.inicio, hasta).length === 0) {
        sinAcordes ??= { fuerte: false, compas: compasDe(j, tuyo) };
        continue;
      }
      // Una débil no se sabe en qué pulso cae, así que choca si choca con algo nuevo
      // de lo que suena mientras dura. Que no sea del acorde no dice nada: es una
      // nota de paso, lo normal.
      const comos = debajo.map((acorde) => notaContra(nota.nota, acorde, tensionesDe(j, acorde)));
      const peor = comos.includes('choca-encima')
        ? 'choca-encima'
        : comos.includes('choca-debajo')
          ? 'choca-debajo'
          : null;
      if (peor !== null && (choqueDebil === null || peor === 'choca-encima')) {
        const contra = debajo[comos.indexOf(peor)]!;
        const donde = peor === 'choca-encima' ? 'medio tono por encima' : 'medio tono por debajo';
        choqueDebil = {
          encima: peor === 'choca-encima',
          motivo: `En el ${compasDe(j, tuyo)}, una nota débil del punteo queda ${donde} de una del ${contra.degree}: se oye aunque no caiga en el fuerte.`,
        };
      }
    }
  }
  // Lo que no tiene acordes debajo no se acompaña: la canción se ha acabado antes
  // que tu punteo. Si es una nota fuerte, no es una versión de tu canción.
  if (sinAcordes !== null) {
    const motivo = `Tu punteo sigue en el compás ${sinAcordes.compas} y la canción ya se ha acabado: se queda sin acordes debajo.`;
    return sinAcordes.fuerte
      ? { valor: -1, motivo, aplica: true, descarte: 'deja el punteo sin acordes debajo' }
      : { valor: -1, motivo, aplica: true };
  }
  // **Una sola nota fuerte que choca de frente basta**: medio tono contra una nota
  // del acorde, en el pulso que más se oye, no es un color sino una disonancia
  // que nadie ha pedido. Antes hacían falta tres, y un Fa sobre el Re7 de un
  // punteo de una nota por compás pasaba siempre.
  if (choque !== null) {
    return { valor: -1, motivo: choque, aplica: true, descarte: 'choca con el punteo' };
  }
  // La débil que choca no descarta —pasa por debajo del pulso—, pero resta entera:
  // es lo que se oye de esa salida. Y si es la novena menor, además tiene reparo:
  // solo entra si no hay tres salidas sin ella.
  if (choqueDebil !== null) {
    return {
      valor: -1,
      motivo: choqueDebil.motivo,
      aplica: true,
      ...(choqueDebil.encima ? { reparo: 'una nota débil del punteo choca' } : {}),
    };
  }
  // Sin notas fuertes debajo de algo nuevo no hay nada que medir; y si tu punteo
  // solo tiene débiles y ninguna choca, no cuenta en los puntos.
  if (fuertes === 0) {
    return { ...NADA, aplica: hayFuertes };
  }
  // Lo que no cabe sin chocar —una sexta, una cuarta lejos de la tercera— resta, y
  // si es casi todo el punteo fuerte, la salida tiene un reparo: no suena mal, pero
  // tu punteo ya no se apoya en sus acordes.
  const fraccion = caben / fuertes;
  return {
    valor: acotar(2 * fraccion - 1),
    motivo:
      fuertes === 1
        ? `La nota fuerte del punteo ${caben === 1 ? 'cabe' : 'no cabe'} en el acorde cambiado.`
        : `${caben} de ${fuertes} notas fuertes del punteo caben en los acordes cambiados.`,
    aplica: true,
    ...(fuertes >= 3 && fraccion < 1 / 3 ? { reparo: 'no cabe en el punteo' } : {}),
  };
}

// ─── 8. Estilo ────────────────────────────────────────────────────────────────

/** La familia de `styles.ts` a la que pertenece un acorde por su grado. */
function familiaDelGrado(j: Juicio, acorde: Acorde): ChordFamily {
  switch (acorde.funcion) {
    case 'tritono':
      return 'tritoneSub';
    case 'secundaria':
      // La mediante cromática del cine es color prestado, no una dominante (`colorDeCine`).
      return j.estilo === 'cine' && acorde.especie !== 'dominant7'
        ? 'borrowed'
        : 'secondaryDominant';
    default:
      if (acorde.degree === 'bII') {
        return 'neapolitan';
      }
      // Un préstamo en quintas solo lo es si su fundamental o su quinta salen de la
      // escala: el iv5 de Do son el Fa y el Do del IV5, y lo prestado era la tercera.
      if (
        j.mode === 'major' &&
        PRESTADOS_EN_MAYOR.has(acorde.degree) &&
        !(acorde.especie === 'quinta' && quintaEnLaEscala(acorde))
      ) {
        return 'borrowed';
      }
      return acorde.degree.endsWith('°') ? 'diminished' : 'diatonic';
  }
}

/** Si las dos notas de un acorde de quintas son de la escala mayor. */
function quintaEnLaEscala(acorde: Pick<Acorde, 'notas'>): boolean {
  return acorde.notas.every((nota) => [0, 2, 4, 5, 7, 9, 11].includes(nota));
}

/** La familia que pone la especie, si la hay. */
const FAMILIA_DE_ESPECIE: Readonly<Record<EspecieDeBloque, ChordFamily>> = {
  quinta: 'power',
  sus2: 'suspended',
  sus4: 'suspended',
  dim: 'diminished',
  aug: 'altered',
  menor: 'borrowed',
  major7: 'seventh',
  dominant7: 'seventh',
  minor7: 'seventh',
  halfDiminished7: 'seventh',
  diminished7: 'diminished',
  minorMajor7: 'seventh',
  augmentedMajor7: 'altered',
};

/** Cómo se dice cada familia en un motivo. */
const NOMBRE_DE_FAMILIA: Readonly<Record<ChordFamily, string>> = {
  diatonic: 'de la tonalidad',
  power: 'una quinta sin tercera',
  suspended: 'un acorde suspendido',
  added: 'un acorde con una nota añadida',
  seventh: 'una cuatríada',
  borrowed: 'un préstamo',
  secondaryDominant: 'una dominante secundaria',
  tritoneSub: 'un sustituto tritonal',
  diminished: 'un disminuido',
  neapolitan: 'un napolitano',
  altered: 'un acorde alterado',
};

/**
 * Los giros típicos de cada estilo, buenos y malos, como grados seguidos.
 *
 * Se busca **el más largo** que acaba en cada compás nuevo, para que `ii V I` no
 * cuente además como `ii V` y como `V I`. Y por eso la puerta de atrás del jazz,
 * `iv bVII I`, gana al `bVII I` que el jazz no usa.
 */
const GIROS: Readonly<
  Record<StyleId, readonly (readonly [patron: string, bueno: boolean, texto: string])[]>
> = {
  jazz: [
    ['iii vi ii V', true, 'iii vi ii V, el turnaround del jazz'],
    ['ii V I', true, 'ii V I, la célula del jazz'],
    ['ii° V i', true, 'ii° V i, la célula del jazz en menor'],
    ['iv bVII I', true, 'iv bVII I, la puerta de atrás del jazz'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['vi ii V', true, 'vi ii V, cayendo por quintas'],
    ['bII I', true, 'bII I, el sustituto tritonal'],
    ['bII i', true, 'bII i, el sustituto tritonal'],
    ['V/ii ii', true, 'V/ii ii, una dominante secundaria'],
    ['V/V V', true, 'V/V V, la dominante de la dominante'],
    ['V/vi vi', true, 'V/vi vi, una dominante secundaria'],
    ['ii V', true, 'ii V, la preparación del jazz'],
    ['V I', true, 'V I, la resolución'],
    ['V i', true, 'V i, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no jazz'],
    ['V IV', false, 'V IV es blues, no jazz'],
    ['bVII I', false, 'bVII I cierra sin sensible, que en jazz no se usa'],
  ],
  blues: [
    ['V IV I', true, 'V IV I, el final del giro de blues'],
    ['V IV', true, 'V IV, el giro del blues'],
    ['IV I', true, 'IV I, la vuelta del blues'],
    ['I IV', true, 'I IV, el cambio del blues'],
    ['i iv', true, 'i iv, el cambio del blues menor'],
    ['iv i', true, 'iv i, la vuelta del blues menor'],
  ],
  rock: [
    ['bVI bVII I', true, 'bVI bVII I, la escalera del rock'],
    ['VI VII i', true, 'VI VII i, la escalera del rock menor'],
    ['bVII I', true, 'bVII I, la cadencia del rock'],
    ['VII i', true, 'VII i, la cadencia del rock menor'],
    ['bVII IV', true, 'bVII IV, el doble plagal'],
    ['I bVII', true, 'I bVII, el giro mixolidio'],
    ['bIII IV', true, 'bIII IV, el riff que sube'],
    ['IV I', true, 'IV I, el amén del rock'],
    ['i VII', true, 'i VII, la bajada por tonos'],
    ['ii V I', false, 'ii V I suena a jazz, no a rock'],
    ['V/ii ii', false, 'una dominante secundaria suena a otro estilo'],
  ],
  metal: [
    ['VI VII i', true, 'VI VII i, la escalera del metal'],
    ['bII i', true, 'bII i, el semitono frigio'],
    ['i bII', true, 'i bII, el color frigio'],
    ['VII i', true, 'VII i, cierra sin sensible'],
    ['i VI', true, 'i VI, la bajada del menor'],
    ['ii V I', false, 'ii V I suena a jazz, no a metal'],
  ],
  pop: [
    ['I V vi IV', true, 'I V vi IV, el eje del pop'],
    ['V vi IV', true, 'V vi IV, el eje del pop'],
    ['IV V I', true, 'IV V I, la cadencia del pop'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['VI VII i', true, 'VI VII i, la subida del pop menor'],
    ['vi IV', true, 'vi IV, el eje del pop'],
    ['V/vi vi', true, 'V/vi vi, la secundaria que levanta'],
    ['iv I', true, 'iv I, la plagal menor'],
    ['IV I', true, 'IV I, la plagal'],
    ['V I', true, 'V I, la resolución'],
  ],
  folk: [
    ['IV V I', true, 'IV V I, la cadencia de siempre'],
    ['VI VII i', true, 'VI VII i, el giro eólico'],
    ['IV I', true, 'IV I, la plagal del folk'],
    ['I IV', true, 'I IV, el vaivén del folk'],
    ['V I', true, 'V I, la resolución'],
    ['VII i', true, 'VII i, la cadencia eólica'],
    ['bVII I', true, 'bVII I, la cadencia mixolidia del folk'],
    ['I bVII', true, 'I bVII, el vaivén mixolidio del folk'],
    ['iv i', true, 'iv i, la plagal menor'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no folk'],
    ['bII I', false, 'el bII no es del folk'],
  ],
  // El vamp: uno o dos acordes con séptima que van y vuelven, y la dominante que no
  // tiene prisa por resolver. Lo que lo parte es la cadena de secundarias.
  funk: [
    ['bVII IV I', true, 'bVII IV I, el doble plagal del funk'],
    ['I IV', true, 'I IV, el vamp del funk'],
    ['IV I', true, 'IV I, la vuelta del vamp'],
    ['i iv', true, 'i iv, el vamp del funk menor'],
    ['iv i', true, 'iv i, la vuelta del vamp menor'],
    ['I bVII', true, 'I bVII, el mixolidio del funk'],
    ['bVII I', true, 'bVII I, vuelve sin sensible'],
    ['i VII', true, 'i VII, el vaivén del funk menor'],
    ['VII i', true, 'VII i, vuelve sin sensible'],
    // Los giros del vamp (`vaiven`, en `reharmonization.ts`): el IV del IV y la v
    // menor del dórico, y la cadencia clásica que lo rompe.
    ['IV bVII', true, 'IV bVII, el IV del IV'],
    ['i v', true, 'i v, la v menor del dórico'],
    ['v i', true, 'v i, vuelve sin sensible'],
    ['iv VII', true, 'iv VII, la puerta de atrás del funk menor'],
    ['V I', false, 'V I con sensible es la cadencia clásica, no el vamp'],
    ['iv I', false, 'iv I, la plagal menor, es de balada: el vamp vuelve desde el cuarto mayor'],
    ['I iv', false, 'I iv, la subdominante menor, es de balada: el vamp va al cuarto mayor'],
    ['V i', false, 'V i con sensible es la cadencia clásica, no el vamp'],
    ['V IV', true, 'V IV, la dominante que no resuelve'],
    ['iii vi ii V', false, 'iii vi ii V es el turnaround del jazz, no un vamp de funk'],
    ['V/vi vi', false, 'una dominante secundaria parte el vamp'],
    ['V/ii ii', false, 'una dominante secundaria parte el vamp'],
  ],
  // Los tres de siempre y la dominante de la dominante delante del V: el II7.
  country: [
    ['V/V V I', true, 'V/V V I, el II7 del country'],
    ['IV V I', true, 'IV V I, la cadencia del country'],
    ['V/V V', true, 'V/V V, el II7 que empuja al V'],
    ['IV I', true, 'IV I, la vuelta del country'],
    ['I IV', true, 'I IV, el cambio del country'],
    ['V I', true, 'V I, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no country'],
    ['iii vi ii V', false, 'iii vi ii V suena a jazz, no a country'],
    ['V/ii V/V', false, 'encadenar secundarias suena a jazz, no a country'],
    ['V/vi V/ii', false, 'encadenar secundarias suena a jazz, no a country'],
    ['bII I', false, 'el bII no es del country'],
  ],
  // Dos acordes en vaivén. El contratiempo es de la guitarra y no se ve en los grados;
  // lo que sí se ve es que los dos acordes van y vienen, y que nadie prepara nada.
  reggae: [
    ['I IV', true, 'I IV, el vaivén del reggae'],
    ['IV I', true, 'IV I, la vuelta del vaivén'],
    ['I V', true, 'I V, el vaivén del reggae'],
    ['V IV', true, 'V IV, el ir y venir del reggae'],
    ['V I', true, 'V I, la resolución'],
    ['i iv', true, 'i iv, el vaivén del reggae menor'],
    ['iv i', true, 'iv i, la vuelta del vaivén menor'],
    ['i VII', true, 'i VII, el vaivén del reggae menor'],
    ['VII i', true, 'VII i, cierra sin sensible'],
    ['ii V I', false, 'ii V I suena a jazz, no a reggae'],
    ['V/V V', false, 'una dominante secundaria suena a otro estilo'],
    ['bII i', false, 'el bII no es del reggae'],
  ],
  // La cadena de dominantes y el menor armónico: cada acorde llega a lo suyo.
  bolero: [
    ['V/ii ii V I', true, 'V/ii ii V I, la cadena del bolero'],
    ['V/V V I', true, 'V/V V I, la dominante de la dominante'],
    ['ii V I', true, 'ii V I, la cadencia del bolero'],
    ['ii° V i', true, 'ii° V i, la cadencia del bolero en menor'],
    ['iv V i', true, 'iv V i, el menor armónico'],
    ['V/iv iv', true, 'V/iv iv, la tónica que se hace dominante del iv'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['V/vi vi', true, 'V/vi vi, una dominante secundaria'],
    ['V/ii ii', true, 'V/ii ii, una dominante secundaria'],
    ['V/V V', true, 'V/V V, la dominante de la dominante'],
    ['bII I', true, 'bII I, el sustituto tritonal'],
    ['bII i', true, 'bII i, el sustituto tritonal'],
    ['V I', true, 'V I, la resolución'],
    ['V i', true, 'V i, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no bolero'],
    ['V IV', false, 'V IV vuelve atrás, y el bolero no lo hace'],
    ['bVII I', false, 'bVII I cierra sin sensible, que en bolero no se usa'],
    ['VII i', false, 'VII i cierra sin sensible, y el bolero llega con la dominante'],
  ],
  // La andaluza baja hasta el V y ahí reposa: el VI V es el semitono frigio que llega.
  // El V del flamenco es mayor, y la v menor le quita justo lo que lo hace centro.
  flamenco: [
    ['i VII VI V', true, 'i VII VI V, la cadencia andaluza'],
    ['VII VI V', true, 'VII VI V, la bajada andaluza'],
    ['VI V', true, 'VI V, el semitono frigio que llega al V'],
    ['iv V', true, 'iv V, la llegada al V'],
    ['V i', true, 'V i, la andaluza que vuelve a empezar'],
    ['bII i', true, 'bII i, el semitono frigio'],
    ['i bII', true, 'i bII, el color frigio'],
    ['V/iv iv', true, 'V/iv iv, la tónica mayor que va al iv'],
    ['ii V I', false, 'ii V I suena a jazz, no a flamenco'],
    ['V/V V', false, 'la dominante de la dominante no es del flamenco'],
    ['VI v', false, 'VI v: en flamenco la dominante es mayor'],
    ['v i', false, 'v i: en flamenco la dominante es mayor'],
  ],
  // El menor prestado y las mediantes que saltan una tercera; lo que suena a otro
  // sitio es la cadena funcional del jazz.
  cine: [
    ['bVI bVII I', true, 'bVI bVII I, la subida épica del cine'],
    ['VI VII i', true, 'VI VII i, la subida épica en menor'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['iv I', true, 'iv I, la plagal menor del cine'],
    ['bVII I', true, 'bVII I, llega sin sensible'],
    ['I bVI', true, 'I bVI, la mediante cromática'],
    ['bVI I', true, 'bVI I, vuelve desde la mediante'],
    ['I bIII', true, 'I bIII, la mediante cromática'],
    ['I V/vi', true, 'I V/vi, el III mayor: la mediante cromática'],
    ['I V/V', true, 'I V/V, el II mayor: el color lidio'],
    ['i VI', true, 'i VI, la bajada del menor'],
    ['ii V I', false, 'ii V I suena a jazz, no a cine'],
    ['V/ii ii', false, 'una cadena de secundarias suena a otro estilo'],
  ],
};

type Giro = (typeof GIROS)[StyleId][number];

/**
 * El giro más largo del estilo que acaba en el compás `k` **y pasa por algo que
 * trae la salida**, si hay alguno.
 *
 * Que pase, no que acabe: un III7 que se mete delante de tu vi hace un `V/vi vi`
 * aunque el vi ya fuera tuyo, y un ii delante de tu `V I` hace un `ii V I`. Antes
 * solo contaba el giro que acababa en un compás nuevo, y esos dos no existían.
 */
function giroEn(
  estilo: StyleId,
  grados: readonly DegreeSymbol[],
  nuevo: readonly boolean[],
  k: number,
): { readonly giro: Giro; readonly desde: number } | null {
  let mejor: { giro: Giro; desde: number } | null = null;
  for (const giro of GIROS[estilo]) {
    const patron = giro[0].split(' ');
    const desde = k - patron.length + 1;
    const coincide =
      desde >= 0 &&
      patron.every((grado, i) => grados[desde + i] === grado) &&
      nuevo.slice(desde, k + 1).some(Boolean);
    if (coincide && (mejor === null || desde < mejor.desde)) {
      mejor = { giro, desde };
    }
  }
  return mejor;
}

/**
 * Los giros del estilo en unos acordes, **los que pasan por algo cambiado** —o
 * todos, sin `cambiados`—, sin contar dos veces uno que cabe en otro: `ii V`
 * dentro de `ii V I`. Y cuántos compases nuevos hay, contados sin repetir.
 */
function girosDelEstilo(
  estilo: StyleId,
  pasos: readonly Acorde[],
  cambiados: ReadonlySet<number> | null,
): { readonly giros: readonly Giro[]; readonly enlaces: number } {
  // Los giros se buscan sobre los grados sin repetir: `ii V I I` es `ii V I`.
  const colapsado: { degree: DegreeSymbol; nuevo: boolean }[] = [];
  pasos.forEach((acorde, i) => {
    const esNuevo = cambiados === null || cambiados.has(i);
    const previo = colapsado[colapsado.length - 1];
    if (previo?.degree === acorde.degree) {
      previo.nuevo ||= esNuevo;
    } else {
      colapsado.push({ degree: acorde.degree, nuevo: esNuevo });
    }
  });
  const grados = colapsado.map((paso) => paso.degree);
  const nuevo = colapsado.map((paso) => paso.nuevo);
  const hallados = colapsado.flatMap((_, k) => {
    const giro = giroEn(estilo, grados, nuevo, k);
    return giro === null ? [] : [{ ...giro, hasta: k }];
  });
  const giros = hallados
    .filter(
      (giro) =>
        !hallados.some(
          (otro) =>
            otro !== giro &&
            otro.desde <= giro.desde &&
            giro.hasta <= otro.hasta &&
            otro.hasta - otro.desde > giro.hasta - giro.desde,
        ),
    )
    .map(({ giro }) => giro);
  return { giros, enlaces: Math.max(1, colapsado.filter((paso) => paso.nuevo).length) };
}

/**
 * Los pesos de `STYLES` **en este modo**: los de siempre, salvo el bII del flamenco
 * en mayor, que no existe —su bII es el semitono frigio de un menor—. Lo mismo mira
 * quien construye las salidas (`paths.ts`, `napolitanoDe`).
 */
function pesosDelEstilo(mode: KeyMode, estilo: StyleId): Readonly<Record<ChordFamily, number>> {
  const pesos = STYLES[estilo].weights;
  return estilo === 'flamenco' && mode === 'major' ? { ...pesos, neapolitan: 0 } : pesos;
}

function estilo(j: Juicio): Hecho & { readonly aplica: boolean } {
  if (j.estilo === undefined) {
    return { ...NADA, aplica: false };
  }
  const pesos = pesosDelEstilo(j.mode, j.estilo);
  const nuevos = [...j.cambiados].map((i) => j.cancion[i]!);
  if (nuevos.length === 0) {
    return { valor: 0, motivo: 'Los mismos acordes: el estilo no cambia.', aplica: true };
  }
  // Cada peso, contra el de la familia que más pesa en ese estilo: en jazz lo
  // de casa son las cuatríadas, no las tríadas, y en rock las tríadas y las
  // quintas. Por debajo de siete décimas del máximo, el acorde resta.
  const maximo = Math.max(...Object.values(pesos));
  const familias = nuevos.map((acorde) => {
    // Un bVII en un estilo que cierra sin sensible es un préstamo que no resta:
    // pesa por lo menos lo que lo de casa.
    const delGrado =
      acorde.degree === 'bVII' && bVIIDeLaCasa(j.estilo)
        ? Math.max(pesos.borrowed, 0.7 * maximo)
        : pesos[familiaDelGrado(j, acorde)];
    if (acorde.especie === null) {
      return delGrado;
    }
    // En el idioma de dominantes la séptima mayor es de otra música: el IIImaj7 o el
    // VImaj7 en un vamp de funk suenan a balada (el quinto examen), y en un blues a
    // otro grupo. Las de `STYLES` no separan las cuatríadas entre sí.
    if (acorde.especie === 'major7' && (j.estilo === 'funk' || j.estilo === 'blues')) {
      return 0;
    }
    // Un grado de la escala con su especie **es** esa especie: el peso «de la
    // tonalidad» de `STYLES` es el de la tríada, y el ii7 de un jazz no es una
    // tríada a medias. Promediándolos, lo más de casa en jazz —una cuatríada de la
    // escala— valía 0,17 y no separaba nada; al retocar, donde casi todo lo que
    // entra es de la escala, el estilo apenas movía el menú. Lo que viene de fuera
    // —un préstamo, una secundaria— sí es las dos cosas, y pesa la media.
    const deLaEspecie = pesos[FAMILIA_DE_ESPECIE[acorde.especie]];
    return familiaDelGrado(j, acorde) === 'diatonic' ? deLaEspecie : (delGrado + deLaEspecie) / 2;
  });
  const media = familias.reduce((suma, peso) => suma + peso, 0) / familias.length;
  const base = acotar((media / maximo - 0.7) * 3.4);
  // Un sustituto tritonal o un napolitano donde el estilo no los usa nunca no
  // es un color: es otro idioma. Los demás que pesan cero —un disminuido en
  // pop— restan, pero son de la tonalidad y no se descartan.
  // Si ya lo tocas, es tu idioma: un bII que abre tu canción puede volver a sonar.
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  const ajeno = nuevos.find((acorde) => {
    const familia = familiaDelGrado(j, acorde);
    return (
      (familia === 'tritoneSub' || familia === 'neapolitan') &&
      pesos[familia] === 0 &&
      !tuyos.has(acorde.degree)
    );
  });

  const { giros, enlaces } = girosDelEstilo(j.estilo, j.cancion, j.cambiados);
  const buenos = giros.filter(([, bueno]) => bueno);
  const malos = giros.filter(([, bueno]) => !bueno);
  // **Al retocar, un giro de casa también se puede quitar**, y eso cuenta como
  // ponerlo. Al continuar lo tuyo va delante tal cual y no se pierde nada; al
  // retocar, cambiar el iv de un `IV iv I` de cine o el ii de un `ii V I` de jazz
  // salía gratis, y el estilo solo sabía premiar lo que entraba.
  // Pero cambiar un giro por otro de casa no quita nada —el bII7 en lugar del V de
  // un `ii V I` es el sustituto tritonal, jazz igual—: solo cuenta lo que se pierde
  // sin otro giro bueno en su lugar. Y cuenta una vez, y la mitad que ponerlo: un
  // acorde cambiado deshace a la vez todos los giros que pasan por él —el `I IV` y
  // el `IV V I` de un folk—, y retocar es cambiar acordes; contarlos todos y enteros
  // castigaba cualquier cambio de un acorde muy usado. Echar de menos un giro se
  // nota menos que oír uno de casa. Se nombra el más largo, que es el que más dice.
  const quedan = new Set(girosDelEstilo(j.estilo, j.cancion, null).giros);
  const quitados =
    j.kind === 'retocar'
      ? girosDelEstilo(j.estilo, j.original, j.cambiados).giros.filter(
          (giro) => giro[1] && !quedan.has(giro),
        )
      : [];
  const perdidos =
    quitados.length > buenos.length
      ? [...quitados].sort((x, y) => y[0].length - x[0].length).slice(0, 1)
      : [];
  // Un giro que el estilo no usa resta más de lo que suma uno típico: oírlo
  // fuera de sitio se nota más que echarlo de menos.
  const valor = acotar(
    0.5 * base + (0.8 * buenos.length - 0.4 * perdidos.length - 1.2 * malos.length) / enlaces,
  );

  // El motivo cuenta lo que pesa en el valor: si resta, lo que resta. Antes decía
  // «acordes de la tonalidad, lo de casa» de un V/V que restaba en folk.
  const cual = familias.indexOf(Math.min(...familias));
  const raro = nuevos[cual]!;
  const suyas = [familiaDelGrado(j, raro)];
  if (raro.especie !== null) {
    suyas.push(FAMILIA_DE_ESPECIE[raro.especie]);
  }
  const suFamilia = suyas.sort((a, b) => pesos[a] - pesos[b])[0]!;
  const nombre = `${raro.degree}${raro.especie === null ? '' : `(${raro.especie})`}`;
  const deCasa = familias[cual]! >= 0.7 * maximo;
  let motivo: string;
  if (malos.length > 0 && (valor < 0 || buenos.length === 0)) {
    motivo = `${malos[0]![2]}.`;
  } else if (perdidos.length > 0 && (valor < 0 || buenos.length === 0)) {
    motivo = `Quita ${perdidos[0]![2]}.`;
  } else if (buenos.length > 0 && valor >= 0) {
    motivo = `${buenos[buenos.length - 1]![2]}.`;
  } else if (!deCasa) {
    motivo = `${nombre} es ${NOMBRE_DE_FAMILIA[suFamilia]}, y en ${j.estilo} pesa poco.`;
  } else if (suFamilia === 'diatonic') {
    motivo = `Acordes de la tonalidad, lo de casa en ${j.estilo}.`;
  } else {
    motivo = `${nombre} es ${NOMBRE_DE_FAMILIA[suFamilia]}, de casa en ${j.estilo}.`;
  }
  if (ajeno !== undefined) {
    return {
      valor: -1,
      motivo: `${ajeno.degree} como ${ajeno.funcion === 'tritono' ? 'sustituto tritonal' : 'napolitano'} no se usa en ${j.estilo}.`,
      aplica: true,
      descarte: `${ajeno.degree} no es de ${j.estilo}`,
    };
  }
  return { valor, motivo, aplica: true };
}

// ─── 9. Novedad frente a coherencia ───────────────────────────────────────────

/**
 * Si tu canción, en mayor, **vive de la mezcla con el menor**: más de la mitad de
 * los compases que no son la tónica son prestados —`I iv I iv`, `I bVI bVII I`, `I
 * iv I bVI`—, y ninguno es una dominante secundaria. Es el idioma de la música de
 * cine y del rock épico, y su color sale del menor paralelo: la escalera
 * bVI–bVII–I, el iv que nubla la plagal, el bIII.
 *
 * Un iv de paso en una canción de la escala —el `I vi IV iv` de un soul, el `I IV iv
 * I` de un cantautor— no es eso: ahí el color es un acento, y las secundarias caben
 * al lado (el arreglista pide un III7 en ese mismo soul). Lo usa también quien
 * construye las salidas (`paths.ts`).
 */
export function vivePrestado(mode: KeyMode, grados: readonly DegreeSymbol[]): boolean {
  const fuera = grados.filter((grado) => grado !== 'I');
  const prestados = fuera.filter((grado) => PRESTADOS_EN_MAYOR.has(grado) || grado === 'bII');
  return (
    mode === 'major' &&
    prestados.length * 2 > fuera.length &&
    !grados.some((grado) => grado.includes('/'))
  );
}

/**
 * Cuántos préstamos caben antes de que la canción cambie de color: sin tope donde lo
 * prestado es la casa —el rock, el metal y el cine, que viven del menor—, dos donde
 * es un color corriente —el bIII y el bVII del blues y del funk, el bII del flamenco—
 * y uno en lo demás.
 */
function topeDePrestamos(j: Juicio): number {
  if (j.estilo === 'rock' || j.estilo === 'metal' || j.estilo === 'cine') {
    return Number.POSITIVE_INFINITY;
  }
  return j.estilo === 'blues' || j.estilo === 'funk' || j.estilo === 'flamenco' ? 2 : 1;
}

/**
 * Los estilos en los que **repetir tu vuelta es el idioma**: el riff del rock, el coro
 * del blues, el vamp del funk y del reggae, la andaluza que vuelve a bajar y el
 * ostinato del cine. En lo demás, repetir no aporta nada que no tuvieras.
 */
const REPETIR_ES_IDIOMA: ReadonlySet<StyleId> = new Set([
  'rock',
  'blues',
  'funk',
  'reggae',
  'flamenco',
  'cine',
]);

function conTopeDePrestamos(j: Juicio, hecho: Hecho): Hecho {
  // Lo que ya tocas es tu idioma y no cuenta, y si tu canción vive de lo prestado
  // (`vivePrestado`), no hay tope: es su color, no uno que se le añade.
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  if (vivePrestado(j.mode, [...j.original.map((acorde) => acorde.degree)])) {
    return hecho;
  }
  const prestados = [...j.cambiados]
    .map((i) => j.cancion[i]!)
    .filter((acorde) => {
      const familia = familiaDelGrado(j, acorde);
      const deLaCasa = acorde.degree === 'bVII' && bVIIDeLaCasa(j.estilo);
      return (
        !tuyos.has(acorde.degree) &&
        ((familia === 'borrowed' && !deLaCasa) || familia === 'neapolitan')
      );
    });
  const sobran = prestados.length - topeDePrestamos(j);
  if (sobran <= 0) {
    return hecho;
  }
  const cuales = [...new Set(prestados.map((acorde) => acorde.degree))].join(', ');
  return {
    valor: acotar(hecho.valor - 0.35 * sobran),
    motivo: `${prestados.length} compases prestados (${cuales}): más de lo que pide una canción ${enEstilo(j)}.`,
  };
}

function novedad(j: Juicio, vamp: boolean, blues: boolean): Hecho {
  if (j.kind === 'retocar') {
    return conTopeDePrestamos(j, novedadAlRetocar(j, blues));
  }
  const parte = j.cancion.slice(j.original.length).map((acorde) => acorde.degree);
  const tuyos = j.original.map((acorde) => acorde.degree);
  if (parte.length === 0) {
    return { valor: -1, motivo: 'No añade ningún compás a lo tuyo.' };
  }
  const comparte =
    new Set(parte.filter((grado) => tuyos.includes(grado))).size / new Set(parte).size;
  let hecho: Hecho;
  if (j.path === 'contraste') {
    // Y la que se va no vuelve a casa por el camino: cada tónica en medio de la
    // parte nueva le quita contraste, que es lo único que se le pide.
    const tonicas = parte.filter((grado) => grado === j.tonica).length;
    hecho =
      comparte <= 0.5
        ? { valor: 1, motivo: 'La parte nueva va a acordes que tú no tocas: contrasta.' }
        : comparte < 1
          ? { valor: 0.3, motivo: 'La parte nueva repite buena parte de tus acordes.' }
          : { valor: -0.5, motivo: 'La parte nueva usa solo tus acordes: no contrasta.' };
    if (tonicas > 0) {
      hecho = {
        valor: acotar(hecho.valor - 0.4 * tonicas),
        motivo: `La parte nueva pasa ${tonicas === 1 ? 'una vez' : `${tonicas} veces`} por la ${j.tonica}: contrasta menos.`,
      };
    }
  } else if (parte.join(' ') === tuyos.join(' ')) {
    // Repetir tu vuelta es lo que se hace en un vamp, un riff o un blues: otro
    // coro. En lo demás no aporta nada que no tuvieras.
    const idioma = vamp || (j.estilo !== undefined && REPETIR_ES_IDIOMA.has(j.estilo));
    hecho = idioma
      ? { valor: 0.5, motivo: 'Repite tu vuelta, otro coro.' }
      : { valor: 0, motivo: 'Repite tu vuelta sin aportar nada.' };
  } else if (comparte === 0) {
    hecho = { valor: -0.2, motivo: 'El cierre no usa ninguno de tus acordes.' };
  } else {
    hecho = {
      valor: 0.6,
      motivo:
        j.cancion[j.cancion.length - 1]!.funcion === 'tonica'
          ? 'Sigue con tus acordes y añade lo que hace falta para cerrar.'
          : 'Sigue con tus acordes y añade otros nuevos.',
    };
  }
  return conTopeDePrestamos(j, hecho);
}

/** El acorde con su especie, como se nombra en un motivo: `V(sus4)`. */
function nombreDe(acorde: Acorde): string {
  return acorde.especie === null ? acorde.degree : `${acorde.degree}(${acorde.especie})`;
}

/**
 * Si un acorde es **color** y de dónde viene: lo que la tonalidad de manual no trae
 * —un préstamo, un napolitano, una dominante secundaria o un sustituto— o un
 * suspendido que retiene la tercera. Nulo si no es color. Por el modo y no por el
 * estilo: un bVII es de la casa en rock, pero sigue siendo lo que hace que tu riff
 * sea ese y no `I IV V`.
 *
 * Hace falta porque un color no se cambia por otro de otra casa: el iv de un soul
 * cambiado por un III7 deja la canción sin nada prestado, y el arreglista lo tachó
 * aunque «pusiera otro color». Lo mismo dice quien construye las salidas
 * (`paths.ts`, `colorDelGrado`).
 */
function colorDe(mode: KeyMode, acorde: Acorde): 'prestado' | 'secundaria' | 'suspendido' | null {
  // En menor el bII es de la casa —el frigio, el napolitano del menor armónico—: el
  // catálogo del menor ya lo trae (`prestamo`, en `reharmonization.ts`). Cambiarlo por
  // la subdominante que inflexiona no le quita el color a la canción: es el cambio de
  // casa que el arreglista pide en un metal neoclásico. En mayor sí viene de fuera.
  if (mode === 'major' && (acorde.degree === 'bII' || PRESTADOS_EN_MAYOR.has(acorde.degree))) {
    return 'prestado';
  }
  if (acorde.funcion === 'secundaria' || acorde.funcion === 'tritono') {
    return 'secundaria';
  }
  return acorde.especie === 'sus2' || acorde.especie === 'sus4' ? 'suspendido' : null;
}

function novedadAlRetocar(j: Juicio, blues: boolean): Hecho {
  const n = j.original.length;
  const cambiados = j.cancion.filter(
    (acorde, i) => j.original[i]?.degree !== acorde.degree && i < n,
  ).length;
  const primero = j.original[0]!;
  // También cuando lo que entra armoniza tu punteo (`paths.ts` lo construye): sigue
  // siendo cambiar el sitio donde la canción dice su tonalidad, y los arreglistas lo
  // tachan con un punteo encima igual que sin él. Queda para la red, detrás de todo.
  if (primero.funcion === 'tonica' && j.cancion[0]!.degree !== primero.degree) {
    return {
      valor: -1,
      motivo: `Cambia el ${primero.degree} del compás 1, que es donde la canción dice su tonalidad.`,
      reparo: `cambia la tónica del compás 1`,
    };
  }
  const ultimo = j.original[n - 1]!;
  // En un blues la llegada es la tónica del 11, y el 12 es la vuelta al coro
  // siguiente: poner ahí la V del turnaround no quita nada.
  const turnaround = blues && j.cancion[n - 2]?.funcion === 'tonica';
  // Y si lo tuyo llega antes del final y se sostiene, la llegada es el compás en que
  // llega. Lo que la sostiene es el final en un periodo de dos frases; en una frase
  // sola es el sitio de la vuelta —`ii V I vi`, `VI VII i III`—, y cambiarlo no la
  // quita (lo mismo construye `paths.ts`).
  let llegada = n - 1;
  while (llegada > 0 && j.original[llegada - 1]!.funcion === 'tonica') {
    llegada -= 1;
  }
  const periodo = j.largoOriginal > j.frase;
  // Rearmonizar no cambia el largo: la canción tiene tus mismos compases.
  const quita = () =>
    j.cancion[llegada]!.funcion !== 'tonica' ||
    ((periodo || llegada === 0) && j.cancion[n - 1]!.funcion !== 'tonica');
  if (j.path === 'rearmonizar' && ultimo.funcion === 'tonica' && !turnaround && quita()) {
    return {
      valor: -0.8,
      motivo: `Quita la llegada a ${ultimo.degree} del compás ${compasDe(j, j.original[llegada]!)}, que ya cerraba.`,
    };
  }
  if (cambiados === 0) {
    return cuadraLaToma(j) === true
      ? { valor: 0.8, motivo: 'Cuadra tu toma sin tocar un solo acorde.' }
      : { valor: 0, motivo: 'Los mismos acordes: lo nuevo es el reparto.' };
  }
  // Rearmonizar es poner **otro** acorde. El que copia al de al lado no pone
  // ninguno: alarga el vecino y se lleva el que había —`ii ii` donde había `V/V
  // ii`, `bII bII7` donde había `bII V`—, y la novedad no lo pesaba más que
  // cualquier otro cambio. Lo que se repetía ya en lo tuyo no cuenta.
  if (j.path === 'rearmonizar') {
    const copia = [...j.cambiados].find((i) =>
      [i - 1, i + 1].some(
        (vecino) =>
          j.cancion[vecino]?.degree === j.cancion[i]!.degree &&
          j.original[vecino]?.degree !== j.original[i]!.degree,
      ),
    );
    if (copia !== undefined) {
      const grado = j.cancion[copia]!.degree;
      return {
        valor: -1,
        motivo: `El ${copia + 1} pasa a ser ${grado}, el mismo de al lado: no pone otro acorde, alarga uno.`,
        reparo: `repite el ${grado} de al lado`,
      };
    }
  }
  // Lo que hace tuya la canción es su color: el iv de `I IV iv I`, el sus4 que
  // retiene el V. Una salida que lo quita entero y no pone otro deja la canción
  // de manual, y eso no es retocarla.
  // **Cada clase de color**, no el color a secas: el iv cambiado por un III7 pone
  // color, pero ya no es el tuyo (`colorDe`).
  const quedan = new Set(j.cancion.map((acorde) => colorDe(j.mode, acorde)));
  const perdida = (acorde: Acorde) => {
    const suyo = colorDe(j.mode, acorde);
    return suyo !== null && !quedan.has(suyo);
  };
  const tuyos = new Set(j.original.filter(perdida).map(nombreDe));
  if (tuyos.size > 0) {
    // **También si el color era tu último acorde y lo que se pide es otro final**:
    // cambiar el final no obliga a dejar la canción de manual. El `I vi IV iv` de un
    // soul acabado en `I vi IV I` ha perdido lo que lo hacía soul, y el arreglista lo
    // tachó; antes aquí se le perdonaba porque «no podía dejarlo en su sitio».
    return {
      valor: -1,
      motivo: `Quita ${[...tuyos].join(' y ')}, el color que hacía tuya la canción, y no pone otro.`,
      reparo: 'quita el color que hacía tuya la canción',
    };
  }
  // Retocar es enriquecer: una salida que deja tu canción con menos acordes
  // distintos que los que tenía la empobrece aunque cada enlace sea bueno. `I IV I
  // V` con el IV cambiado por V es un vaivén de dos acordes, no tu frase retocada.
  const distintos = (acordes: readonly Acorde[]) =>
    new Set(acordes.map((acorde) => acorde.degree)).size;
  if (distintos(j.cancion) < distintos(j.original)) {
    return {
      valor: -0.5,
      motivo: `Se queda con ${distintos(j.cancion)} acordes distintos de los ${distintos(j.original)} que tenías: empobrece.`,
    };
  }
  const parte = cambiados / n;
  if (cambiados === 1) {
    return { valor: 0.7, motivo: 'Cambia un solo compás: tu canción sigue siendo la tuya.' };
  }
  if (parte <= 0.5) {
    return {
      valor: 1,
      motivo: `Cambia ${cambiados} de ${n} compases: se nota y sigue siendo tuya.`,
    };
  }
  return parte <= 0.75
    ? { valor: -0.2, motivo: `Cambia ${cambiados} de ${n} compases: más de la mitad.` }
    : { valor: -1, motivo: `Cambia ${cambiados} de ${n} compases: ya no es tu canción.` };
}

// ─── 10. Papel ────────────────────────────────────────────────────────────────

/**
 * Qué parte viene después de la tuya cuando se continúa: **lo que se añade es otra
 * parte**, y se juzga con el papel que le toca a ella. Antes el papel de lo tuyo
 * se aplicaba a todo, y el estribillo que seguía a tu pre salía castigado con «el
 * pre cierra en la tónica».
 *
 * **Una parte, y la misma para quien la construye y para quien la juzga.** Antes
 * aquí tras una estrofa podían ir un pre o un estribillo y valía el que mejor le
 * sentara, mientras las salidas lo llamaban siempre estribillo: «Un estribillo por
 * I V/ii ii V» salía con el motivo «Lo que sigue, el pre, acaba en V». Lo encontró
 * el corpus final en casi la mitad de los menús de continuar. Ahora esta tabla es
 * la única, y las salidas la leen para nombrar lo que añaden (`paths.ts`).
 *
 * Tras una estrofa, el estribillo. Seguir un estribillo es acabar la canción —el
 * final, que es corto—; contrastarlo, un puente. Tras un final no hay más que una
 * coda, que también es final. Después de un puente vuelve el estribillo, también
 * cuando se pide un contraste: lo que se va del puente tiene que entrar en casa.
 * La idea no tiene papel, y lo que la sigue tampoco.
 */
export const PARTE_QUE_SIGUE: Readonly<
  Record<'seguir' | 'contraste', Readonly<Record<SectionRole, SectionRole | null>>>
> = {
  seguir: {
    idea: null,
    intro: 'estrofa',
    estrofa: 'estribillo',
    pre: 'estribillo',
    estribillo: 'final',
    puente: 'estribillo',
    solo: 'solo',
    final: 'final',
  },
  contraste: {
    idea: null,
    intro: 'estrofa',
    estrofa: 'estribillo',
    pre: 'estribillo',
    estribillo: 'puente',
    puente: 'estribillo',
    solo: 'puente',
    final: 'final',
  },
};

const EL_PAPEL: Readonly<Record<SectionRole, string>> = {
  idea: 'la idea',
  intro: 'la intro',
  estrofa: 'la estrofa',
  pre: 'el pre',
  estribillo: 'el estribillo',
  puente: 'el puente',
  solo: 'el solo',
  final: 'el final',
};

/** Si un acorde tira hacia otro sitio: la tensión o la subdominante que lleva a la parte siguiente. */
function tira(acorde: Acorde): boolean {
  return esTension(acorde) || acorde.funcion === 'subdominante';
}

/** Las partes que pueden acabar en el aire: las que llevan a otra. */
const QUEDAN_ABIERTAS: ReadonlySet<SectionRole> = new Set(['intro', 'estrofa', 'pre', 'puente']);

/** Los papeles que se repiten: los únicos en los que lo tuyo puede ser un bucle. */
const SE_REPITEN: ReadonlySet<SectionRole> = new Set([
  'idea',
  'intro',
  'estrofa',
  'estribillo',
  'solo',
]);

/** La parte de la canción que se juzga con un papel, y cuál. */
interface ParteConPapel {
  /** Una sola: la que dice `PARTE_QUE_SIGUE`, la misma que nombra quien la construye. */
  readonly papel: SectionRole;
  /** Desde qué paso de la canción. */
  readonly desde: number;
  /** Si es la tuya —retocada o completada— o la que viene detrás. */
  readonly tuya: boolean;
}

/**
 * A qué parte se le aplica qué papel.
 *
 * Al retocar, el tuyo a la canción entera. Al continuar, **lo que completa tu
 * frase sigue siendo tuyo** —dos compases más a una estrofa de dos son su
 * segunda mitad—, y lo que empieza en la frase siguiente es la parte que viene
 * detrás.
 */
function parteConPapel(j: Juicio): ParteConPapel | null {
  const rol = j.contexto.papel;
  if (rol === undefined || rol === 'idea') {
    return null;
  }
  if (j.kind === 'retocar' || j.loQueSeAnade === 'tuya') {
    return { papel: rol, desde: 0, tuya: true };
  }
  const queSigue = PARTE_QUE_SIGUE[j.path === 'contraste' ? 'contraste' : 'seguir'][rol];
  if (j.loQueSeAnade !== undefined) {
    return {
      papel: j.loQueSeAnade === 'misma' ? rol : (j.papelNuevo ?? queSigue!),
      desde: j.original.length,
      tuya: false,
    };
  }
  const frontera = Math.ceil(j.largoOriginal / j.frase) * j.frase;
  const desde = j.cancion.findIndex(
    (acorde, i) => i >= j.original.length && acorde.inicio / j.pc >= frontera,
  );
  if (desde === -1) {
    return { papel: rol, desde: 0, tuya: true };
  }
  return { papel: queSigue!, desde, tuya: false };
}

/** Si la canción, acabando fuera de casa, llega a la tónica al volver a tu principio. */
function llegaAlVolver(j: Juicio): boolean {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  const primero = j.original[0]!;
  return (
    primero.funcion === 'tonica' &&
    ultimo.funcion !== 'tonica' &&
    enlace({ ...j, cancion: [ultimo, primero] }, 1, true).valor >= VUELTA_QUE_LLEGA
  );
}

/**
 * Cuánto tiene que valer el enlace del último acorde al primero para que eso sea
 * una vuelta: una dominante o una subdominante que llevan a casa, el bVII que
 * cierra sin sensible, la rota `V vi`. Un `vi I` o un `III i` llegan de rebote, y
 * eso no es volver: es empezar otra vez.
 */
const VUELTA_QUE_LLEGA = 0.3;

/**
 * Si la canción **tiene que llegar** a casa y no llega: un final que acaba en el
 * aire, o un estribillo sin llegada. Eso no es una salida floja: es no hacer lo
 * que la parte hace, y no se ofrece.
 *
 * Un estribillo llega si acaba en la tónica o si su último acorde la trae al
 * volver a empezar —`I IV bVI bVII` llega cada vez que se repite—. Lo modal no
 * llega a la tónica de manual, y no se le pide.
 */
function faltaLaLlegada(j: Juicio, final: Final | null): string | null {
  // Un vamp sin tónica no tiene casa a la que llegar: su final es su centro. Y el V
  // de un flamenco es su reposo (`reposoFrigio`).
  if (
    final !== null ||
    j.modal === 'sin-tonica' ||
    reposoFrigio(
      j.mode,
      j.estilo,
      j.original.map((acorde) => acorde.degree),
      j.cancion.map((acorde) => acorde.degree),
    ) !== null
  ) {
    return null;
  }
  const parte = parteConPapel(j);
  if (parte === null) {
    return null;
  }
  if (parte.papel === 'final') {
    return 'un final que acaba abierto';
  }
  // Lo que sigue a un puente vuelve a casa: si contrasta, al entrar, que es lo
  // único que un contraste puede hacer.
  const entraEnCasa = !parte.tuya && j.cancion[parte.desde]!.funcion === 'tonica';
  if (j.path === 'contraste' && j.contexto.papel === 'puente' && !entraEnCasa) {
    return 'lo que sigue al puente no vuelve a casa';
  }
  // El estribillo que contrasta vuelve a tu principio por definición: de él solo
  // se mira cómo entra, en el papel.
  const estribillo = parte.papel === 'estribillo';
  if (j.path === 'contraste' || !estribillo) {
    return null;
  }
  // El que viene detrás de otra parte puede llegar al entrar: el compás fuerte
  // del estribillo, en casa, es la llegada que el pre o el puente preparaban. El
  // tuyo, si cerraba, tiene que seguir cerrando: llegar solo al repetirse es
  // quitarle el final que tenía. Si no cerraba, vale que llegue al volver, o que
  // sea modal, que llega a su manera.
  const tuCerrabas = parte.tuya && j.original[j.original.length - 1]!.funcion === 'tonica';
  if (entraEnCasa || (!tuCerrabas && (llegaAlVolver(j) || j.modal !== null))) {
    return null;
  }
  // Retocar un estribillo que ya no llegaba no le quita nada: lo que se descarta
  // es la salida que se lleva tu llegada, no la que respeta que no la tuvieras.
  const tuLlegabas =
    j.original[j.original.length - 1]!.funcion === 'tonica' ||
    llegaAlVolver({ ...j, cancion: j.original });
  return parte.tuya && !tuLlegabas ? null : 'un estribillo sin llegada';
}

/** Cómo juzga cada papel la parte que le toca. */
function juzgarPapel(
  j: Juicio,
  final: Final | null,
  rol: SectionRole,
  parte: ParteConPapel,
): Hecho {
  const pasos = j.cancion.slice(parte.desde);
  const ultimo = pasos[pasos.length - 1]!;
  const primero = pasos[0]!;
  const cierraFuerte = final?.cierre === 'perfecta' || final?.cierre === 'sin-sensible';
  // Al retocar, lo que trae la salida; al continuar, la parte nueva entera.
  const nuevos = parte.tuya ? [...j.cambiados].map((i) => j.cancion[i]!) : pasos;
  // Cómo acababa lo tuyo: lo que la salida respeta no es culpa suya. Y solo al
  // retocar: al continuar, lo que completa tu frase llega donde lo tuyo pedía.
  const retoca = j.kind === 'retocar';
  const tuUltimo = j.original[j.original.length - 1]!;
  const tuyoCerraba = tuUltimo.funcion === 'tonica';
  const tuyoTiraba = tira(tuUltimo);
  // Lo que se añade a un final o a un solo es más de lo mismo: se nombra así.
  const quien = parte.tuya
    ? EL_PAPEL[rol].charAt(0).toUpperCase() + EL_PAPEL[rol].slice(1)
    : j.contexto.papel === rol
      ? `Lo que se añade a${EL_PAPEL[rol].replace(/^el /, 'l ').replace(/^la /, ' la ')}`
      : `Lo que sigue, ${EL_PAPEL[rol]},`;
  switch (rol) {
    case 'estrofa':
      return final === null
        ? {
            valor: 0.5,
            motivo: `${quien} acaba en ${ultimo.degree}: queda abierta para repetirse.`,
          }
        : { valor: 0.3, motivo: `${quien} cierra en la tónica.` };
    case 'intro':
      if (esTension(ultimo)) {
        return {
          valor: 0.6,
          motivo: `${quien} acaba en ${ultimo.degree}: deja la entrada servida.`,
        };
      }
      // Una intro que cierra con cadencia suena a final antes de empezar: lo que
      // la hace intro es que deja algo por llegar.
      return cierraFuerte
        ? { valor: -0.5, motivo: `${quien} cierra con cadencia: suena a final antes de empezar.` }
        : { valor: 0.3, motivo: `${quien} deja puesto el tono.` };
    case 'pre': {
      if (tira(ultimo)) {
        return {
          valor: 1,
          motivo: `${quien} acaba en ${ultimo.degree}: deja el estribillo servido.`,
        };
      }
      // Solo se descarta lo que trae la salida: un pre tuyo que ya cerraba, o que
      // ya acababa sin empujar, es cosa tuya.
      const cierra = final !== null && cierraFuerte && !tuyoCerraba;
      const descarte = !retoca
        ? null
        : cierra
          ? 'un pre que cierra'
          : tuyoTiraba
            ? 'quita lo que llevaba a la parte siguiente'
            : null;
      return {
        ...(final !== null
          ? {
              valor: -1,
              motivo: `${quien} cierra en la tónica y le quita la llegada al estribillo.`,
            }
          : { valor: -0.5, motivo: `${quien} acaba en ${ultimo.degree}, que no empuja.` }),
        ...(descarte !== null && parte.tuya ? { descarte } : {}),
      };
    }
    case 'estribillo': {
      // Un estribillo llega: empieza en casa —o en el IV o la relativa, que son
      // llegadas de otro color— y cierra fuerte. El que contrasta vuelve a tu
      // principio, así que de él solo se mira cómo entra.
      // Pero entrar en uno de los dos acordes de tu vaivén no es llegar: detrás de un
      // pre en `VI VII VI VII`, el VI es más de lo mismo.
      const delVaiven = !parte.tuya && j.vamp?.includes(primero.degree) === true;
      const entra =
        primero.funcion === 'tonica' ||
        (!delVaiven &&
          (primero.degree === 'IV' ||
            primero.degree === 'iv' ||
            esRelativaDeLaTonica(primero.degree)));
      const inicio = entra ? 0.3 : -0.3;
      if (j.path === 'contraste') {
        return {
          valor: acotar(2 * inicio),
          motivo: entra
            ? `${quien} entra en ${primero.degree}, que es llegar.`
            : `${quien} entra en ${primero.degree}, que no es llegar a ningún sitio.`,
        };
      }
      const llega = llegaAlVolver(j) || (!parte.tuya && primero.funcion === 'tonica');
      const cierre = cierraFuerte ? 0.7 : final !== null ? 0.2 : llega ? 0 : -0.7;
      return {
        valor: acotar(inicio + cierre),
        motivo: cierraFuerte
          ? `${quien} empieza en ${primero.degree} y cierra fuerte.`
          : final !== null
            ? `${quien} empieza en ${primero.degree} y cierra sin cadencia fuerte.`
            : `${quien} empieza en ${primero.degree} y acaba en ${ultimo.degree}, sin cerrar.`,
      };
    }
    case 'puente': {
      // Un puente se va y prepara la vuelta: no pasa por casa, y su último acorde
      // tira hacia ella. El que acaba en la tónica ya ha vuelto, y lo que venía
      // detrás pierde la llegada, como un pre que cierra.
      const tonicas = nuevos.filter((acorde) => acorde.funcion === 'tonica').length;
      const prepara = tira(ultimo);
      const yaHaVuelto = parte.tuya && final !== null && !tuyoCerraba;
      const descarte = !retoca
        ? null
        : yaHaVuelto && cierraFuerte
          ? 'un puente que ya ha vuelto'
          : tuyoTiraba && !prepara
            ? 'quita lo que llevaba a la parte siguiente'
            : null;
      // Al retocar se cuentan las tónicas que trae la salida, no las tuyas: si tu
      // puente ya pasaba por casa, decir que «no pasa» sería mentira, y lo que se
      // cuenta es lo que cambia.
      const lasTuyas =
        retoca && j.original.some((acorde) => acorde.funcion === 'tonica') ? 'Lo que cambia' : null;
      return {
        valor: acotar((tonicas === 0 ? 0.5 : -0.5 * tonicas) + (prepara ? 0.5 : -0.5)),
        motivo: yaHaVuelto
          ? `${quien} acaba en la tónica: ya ha vuelto, y la vuelta pierde su llegada.`
          : tonicas > 0
            ? `${lasTuyas ?? quien} pasa ${tonicas === 1 ? 'una vez' : `${tonicas} veces`} por la tónica: la vuelta se gasta antes de tiempo.`
            : prepara
              ? lasTuyas === null
                ? `${quien} no pasa por la tónica y acaba en ${ultimo.degree}, que tira hacia ella.`
                : `${lasTuyas} no trae la tónica, y ${quien.toLowerCase()} acaba en ${ultimo.degree}, que tira hacia ella.`
              : `${quien} acaba en ${ultimo.degree}, que no prepara la vuelta.`,
        ...(descarte === null ? {} : { descarte }),
      };
    }
    case 'final': {
      // Una coda plagal: después de llegar con V I, un IV I de despedida.
      const coda =
        final?.cierre === 'plagal' &&
        (final.antes!.degree === 'IV' || final.antes!.degree === 'iv') &&
        j.cancion.some(
          (acorde, i) => acorde.funcion === 'dominante' && j.cancion[i + 1]?.funcion === 'tonica',
        );
      // Lo que sigue a un final es una coda, y una coda es corta: más de una frase
      // —cuatro acordes al paso de lo tuyo— detrás de un final es otra canción.
      const largoDeLaParte = (j.largo * j.pc - pasos[0]!.inicio) / j.pc;
      const unaFrase = (4 * pulsosHabituales(j.original, j.pc)) / j.pc;
      if (!parte.tuya && largoDeLaParte > unaFrase) {
        return {
          valor: -1,
          motivo: `${quien} dura ${largoDeLaParte} compases: una coda no es otra canción.`,
          reparo: 'una coda que es otra canción',
        };
      }
      return coda
        ? { valor: 1, motivo: `${quien} llega con la dominante y se despide con una coda plagal.` }
        : cierraFuerte
          ? { valor: 1, motivo: `${quien} cierra fuerte.` }
          : final !== null
            ? { valor: 0.5, motivo: `${quien} cierra, pero sin dominante.` }
            : { valor: -1, motivo: `${quien} acaba en ${ultimo.degree}, sin cerrar.` };
    }
    case 'solo': {
      const tuyos = new Set(j.original.map((acorde) => acorde.degree));
      const ajenos = new Set(
        nuevos.map((acorde) => acorde.degree).filter((grado) => !tuyos.has(grado)),
      );
      return ajenos.size === 0
        ? { valor: 1, motivo: `${quien} va sobre acordes que ya han sonado.` }
        : {
            valor: acotar(1 - 0.5 * ajenos.size),
            motivo: `${quien} mete ${[...ajenos].join(', ')}, que no habían sonado.`,
          };
    }
    /* v8 ignore next 2 -- `parteConPapel` no devuelve nunca la idea: no tiene papel que juzgar */
    case 'idea':
      return NADA;
  }
}

function papel(j: Juicio, final: Final | null): Hecho & { readonly aplica: boolean } {
  const parte = parteConPapel(j);
  if (parte === null) {
    return { ...NADA, aplica: false };
  }
  return { ...juzgarPapel(j, final, parte.papel, parte), aplica: true };
}

// ─── 11. Forma y centro ───────────────────────────────────────────────────────

/**
 * Si un acorde lleva la sensible: la nota medio tono por debajo de la tónica. El
 * sustituto tritonal la lleva como séptima aunque se escriba sin ella: declararlo
 * tritono es decir que suena como dominante.
 */
function llevaSensible(acorde: Acorde): boolean {
  return acorde.notas.includes(11) || acorde.funcion === 'tritono';
}

/**
 * El modo en el que vive lo tuyo, si no es el de la tonalidad de manual.
 *
 * **Sin sensible es una elección, no una ausencia.** En mayor el bVII ya lo dice:
 * no es de la escala, y quien lo pone en vez del V ha elegido el mixolidio. En
 * menor el VII sí es de la escala, y un rock en `i VII VI V` mezcla las dos
 * dominantes sin elegir ninguna; lo que elige es **la v menor**, que es la
 * dominante con la sensible quitada a propósito, junto al VII que cierra en su
 * lugar.
 */
function modalDe(
  mode: KeyMode,
  kind: PathKind,
  original: readonly Acorde[],
  papel: SectionRole | undefined,
  estilo: StyleId | undefined,
): Modal | null {
  const vamp = vampDe(original);
  // **El papel manda sobre el vamp**: un pre, un puente o un final en `VI VII VI VII`
  // no viven en otro modo, preparan la tónica. Lo que sigue a un pre es un estribillo
  // que llega, y un puente vuelve: castigar que cierre en la i era castigar que
  // llegue (el quinto examen). Es la misma regla que `PIDEN_LLEGADA` en `paths.ts`.
  if (vamp !== null && !vamp.includes(tonicaDe(mode)) && !PREPARAN_LA_LLEGADA.has(papel!)) {
    return 'sin-tonica';
  }
  const grados = new Set(original.map((acorde) => acorde.degree));
  const eligeSinSensible =
    (mode === 'major' ? grados.has('bVII') : grados.has('v') && grados.has('VII')) ||
    // Al retocar: continuar un vamp puede acabar en un turnaround con su V7.
    (kind === 'retocar' && esVampDeFunk(mode, original, estilo));
  // Y la elección se mira en lo que suena: si algún acorde tuyo ya lleva la
  // sensible —un iii, una secundaria—, lo tuyo no la ha dejado fuera.
  const sinNinguna = !original.some(
    (acorde) => llevaSensible(acorde) || acorde.funcion === 'secundaria',
  );
  return eligeSinSensible && sinNinguna ? 'sin-sensible' : null;
}

/**
 * La sensible del centro de un vamp modal: medio tono por debajo de su fundamental,
 * con la tónica en cero. La de un dórico sobre Re, escrito en Do, es el Do#. Lo usa
 * también quien construye las salidas (`paths.ts`).
 */
export function sensibleDelCentro(mode: KeyMode, centro: DegreeSymbol): number {
  return (resolveDegree(0, mode, centro).root + 11) % 12;
}

/**
 * **Un vamp de funk** —la tónica y su cuarto, nada más— **elige no tener sensible**:
 * el I7 y el IV7 no la llevan, y el im7 y el iv7 tampoco. Meterle un V7 que resuelve
 * es la cadencia clásica que el vamp evita (el quinto examen). La misma vara que
 * `esUnVampDeFunk` en `paths.ts`, sobre los grados.
 */
function esVampDeFunk(mode: KeyMode, original: readonly Acorde[], estilo: StyleId | undefined) {
  const tonica = tonicaDe(mode);
  const cuarto = mode === 'major' ? 'IV' : 'iv';
  return (
    estilo === 'funk' &&
    original.length >= 2 &&
    original[0]!.degree === tonica &&
    original.every((acorde) => acorde.degree === tonica || acorde.degree === cuarto)
  );
}

/** Los papeles que preparan una llegada: lo que va detrás de ellos entra en casa. */
const PREPARAN_LA_LLEGADA: ReadonlySet<SectionRole> = new Set(['pre', 'puente', 'final']);

/** Si lo tuyo son dos acordes que se alternan: un vamp. Devuelve los dos. */
function vampDe(original: readonly Acorde[]): readonly [DegreeSymbol, DegreeSymbol] | null {
  if (original.length < 2) {
    return null;
  }
  const [a, b] = [original[0]!.degree, original[1]!.degree];
  const alterna = a !== b && original.every((acorde, i) => acorde.degree === (i % 2 === 0 ? a : b));
  return alterna ? [a, b] : null;
}

/**
 * Si lo tuyo es **un vamp sobre la tónica** —un solo acorde, el I7 de un funk, el
 * im7 de un groove menor— y lo que se añade va al cuarto grado y vuelve: `IV IV I
 * I`. Es el movimiento de toda la vida de esa música, el del blues en el compás 5,
 * y el juez no lo veía: no hay cadencia fuerte que premiar ni sustituto que
 * validar —ir al IV y volver no es poner un acorde en lugar de otro—, así que
 * salía con lo justo y fuera del menú.
 */
function alCuartoYVuelta(j: Juicio): Hecho | null {
  if (j.kind !== 'continuar' || !j.original.every((acorde) => acorde.funcion === 'tonica')) {
    return null;
  }
  const parte = j.cancion.slice(j.original.length);
  const cuarto = j.mode === 'minor' ? 'iv' : 'IV';
  const va = parte[0]!.degree === cuarto && parte[parte.length - 1]!.funcion === 'tonica';
  const soloEsos = parte.every((acorde) => acorde.degree === cuarto || acorde.funcion === 'tonica');
  return va && soloEsos
    ? {
        valor: 1,
        motivo: `Tu vamp en ${j.tonica} va al ${cuarto} y vuelve: el movimiento de un vamp sobre la tónica.`,
      }
    : null;
}

/** Si dos compases suenan igual: los mismos acordes, durando lo mismo. */
function mismoCompas(a: Compas, b: Compas | undefined): boolean {
  return (
    b !== undefined &&
    a.length === b.length &&
    a.every((acorde, k) => acorde.degree === b[k]!.degree && acorde.beats === b[k]!.beats)
  );
}

/** Cómo se dice lo que se ha completado, por lo que faltaba. */
const LO_COMPLETADO: Readonly<Record<LoQueFalta['que'], string>> = {
  consecuente: 'el consecuente cierra en casa con tu misma cabeza: un periodo entero',
  b: 'tras tus dos secciones que empiezan igual, una que contrasta: la AABA va por su tercera',
  'ultima-a': 'vuelve tu primera sección tras la que contrasta: la AABA entera',
};

/**
 * Si lo que se añade **completa la forma de lo tuyo** (`formasDe`, la misma vara que
 * quien construye): a lo tuyo le faltaba algo —el consecuente, la sección que
 * contrasta, la vuelta— y la canción entera ya lo tiene. Nulo si no.
 *
 * Lo que completa una forma repite a propósito: el consecuente empieza como el
 * antecedente y la última vuelta es tu primera sección. Sin esto, la novedad y la
 * frase lo leían como copiar lo tuyo. Y lo que cierra la forma, la cierra con una
 * cadencia: perfecta o sin sensible.
 */
function completaLaForma(j: Juicio, final: Final | null): Hecho | null {
  const tuyos = j.kind === 'continuar' ? compasesDe(j.original, j.pc) : null;
  // El consecuente y la última A son tu parte, o la misma otra vez: un estribillo
  // detrás de una estrofa no es su consecuente, es otra parte. La B sí es otra.
  const otraParte = j.loQueSeAnade === 'otra';
  const cancion = compasesDe(j.cancion, j.pc);
  if (tuyos === null || cancion === null) {
    return null;
  }
  const antes = formasDe(j.mode, tuyos);
  const ahora = formasDe(j.mode, cancion);
  for (const forma of antes) {
    if (forma.falta === null || (otraParte && forma.falta.que !== 'b')) {
      continue;
    }
    // Y hace lo que faltaba: lo que tenía que repetir de lo tuyo, lo repite. Un
    // consecuente con otra cabeza también es un periodo, pero no el que faltaba.
    const { repite } = forma.falta;
    const repetido =
      repite === null ||
      tuyos
        .slice(repite.desde, repite.desde + repite.compases)
        .every((compas, k) => mismoCompas(compas, cancion[tuyos.length + k]));
    const sigue = ahora.find(
      (otra) =>
        otra.forma === forma.forma &&
        otra.compasesPorSeccion === forma.compasesPorSeccion &&
        otra.secciones.length === forma.secciones.length + 1,
    );
    // Lo que cierra la forma la cierra con una cadencia de verdad, como el periodo de
    // siempre: una plagal tras la dominante —`V IV I`— no es el consecuente que
    // faltaba, es una retrogresión con tu cabeza delante.
    const cierraBien =
      forma.falta.acaba === 'abierta' ||
      (final !== null && (final.cierre === 'perfecta' || final.cierre === 'sin-sensible'));
    if (sigue !== undefined && repetido && cierraBien) {
      return { valor: 1, motivo: `La forma: ${LO_COMPLETADO[forma.falta.que]}.` };
    }
  }
  return null;
}

/**
 * Si la canción es **un periodo**: la forma que reconoce `formasDe` —la misma vara que
 * quien construye—, con secciones de la mitad, y **una sola parte**. Lo que sigue a un
 * puente es la vuelta al estribillo, otra parte: un puente que acaba en V y un
 * estribillo que cierra no son antecedente y consecuente, aunque lo parezcan contados
 * en compases (lo encontró el quinto examen).
 */
function esUnPeriodo(j: Juicio, mitad: number): boolean {
  const compases = compasesDe(j.cancion, j.pc);
  const otraParte = j.kind === 'continuar' && j.loQueSeAnade === 'otra';
  return (
    !otraParte &&
    compases !== null &&
    formasDe(j.mode, compases).some(
      (forma) =>
        forma.forma === 'periodo' &&
        forma.compasesPorSeccion === mitad &&
        forma.secciones.length === 2,
    )
  );
}

/**
 * Cómo dice su forma un coro de blues que empieza en el compás `desde` (desde
 * cero): la tónica en su 1, el cuarto en su 5 y **lo que suena de verdad en su 9**
 * —la dominante, o el VI7 o el ii que la preparan—. Contado en compases de la
 * canción: el coro nuevo empieza en el 13. Antes era un texto fijo, y decía «la
 * dominante en el 9» de un blues menor con el VI7 ahí (el quinto examen).
 */
function comoVaElCoro(j: Juicio, desde: number): string {
  const nueve = acordeEnCompas(j, j.cancion, desde + 8)!;
  const elNueve =
    nueve.degree === 'V' || nueve.degree === 'v'
      ? 'la dominante'
      : `el ${nueve.degree}${nueve.especie?.endsWith('7') === true ? '7' : ''}`;
  return `la tónica en el ${desde + 1}, el cuarto en el ${desde + 5} y ${elNueve} en el ${desde + 9}`;
}

function forma(j: Juicio, final: Final | null, blues: boolean): Hecho {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  if (blues) {
    if (j.kind === 'continuar') {
      if (esBluesDeDoce(j, j.cancion, j.largoOriginal) && j.largo % 12 === 0) {
        return {
          valor: 1,
          motivo: `Otro coro de doce: ${comoVaElCoro(j, j.largoOriginal)}.`,
        };
      }
      // El acorde final de un blues cae en el 13, donde empezaría otro coro:
      // la vuelta del 12 resuelve ahí. Eso no rompe nada.
      if (final !== null && final.compas === j.largoOriginal && final.desde === j.original.length) {
        return {
          valor: 0.6,
          motivo: `La vuelta del 12 resuelve en ${j.tonica} en el 13: el final del blues.`,
        };
      }
      const motivo = 'Lo que se añade no es un coro de doce: rompe la forma del blues.';
      return j.estilo === 'blues'
        ? { valor: -1, motivo, descarte: 'rompe la forma de doce del blues' }
        : { valor: -0.8, motivo };
    }
    if (j.largo !== 12) {
      // Doblar o partir un coro entero no es otro reparto del mismo blues: es otro
      // largo de coro, y el 5 y el 9 dejan de caer donde caen. Igual que añadirle
      // compases al continuar, no se ofrece.
      return {
        valor: -0.8,
        motivo: `Deja el blues en ${j.largo} compases: rompe la forma de doce.`,
        descarte: 'rompe la forma de doce del blues',
      };
    }
    // Se retoca la vuelta, no el esquema: lo que cambia antes del 8 —menos poner o
    // quitar el cambio rápido al cuarto en el 2— ya es otro blues.
    const cuarto = j.mode === 'minor' ? 'iv' : 'IV';
    const esquema = [...j.cambiados].find((i) => {
      const acorde = j.cancion[i]!;
      const compas = acorde.inicio / j.pc;
      const rapido = compas === 1 && (acorde.degree === cuarto || acorde.degree === j.tonica);
      return compas < 7 && !rapido;
    });
    if (esquema !== undefined) {
      return {
        valor: -0.6,
        motivo: `Cambia el ${compasDe(j, j.cancion[esquema]!)}, que es del esquema del blues: se retoca la vuelta del 8 al 12.`,
      };
    }
    if (esBluesDeDoce(j, j.cancion)) {
      return {
        valor: 0.6,
        motivo: `La forma de doce sigue entera: ${comoVaElCoro(j, 0)}.`,
      };
    }
    // Lo que ha dejado de decir la forma, dicho con lo que suena: antes del 8 solo se
    // toca el cambio rápido (arriba), así que el 1 y el 5 siguen ahí, y lo que ya no
    // está es el 9 que lleva a la vuelta —la dominante, o lo que la prepara para el
    // 10—. Era un texto fijo, «el 1, el 5 o el 9 ya no dicen…», con los tres sin
    // tocar (el quinto examen).
    const nueve = acordeEnCompas(j, j.cancion, 8)!;
    const diez = acordeEnCompas(j, j.cancion, 9)!;
    return {
      valor: -0.3,
      motivo: `Siguen siendo doce, pero el 9 ya no lleva a la vuelta: suena ${nueve.degree}, y en el 10 ${diez.degree}.`,
    };
  }
  const alCuarto = alCuartoYVuelta(j);
  if (alCuarto !== null) {
    return alCuarto;
  }
  if (cuadraLaToma(j) === true) {
    return {
      valor: 0.8,
      motivo: `Tu toma desigual queda en ${j.largo} compases de ${j.pc} pulsos.`,
    };
  }
  if (j.modal === 'sin-tonica') {
    // ii V ii V en Do es un dórico sobre Re: cerrar en Do destruye el modo.
    const vamp = j.vamp!;
    // Y meterle la sensible de su centro —el Do# de un dórico sobre Re, que trae el
    // A7— lo vuelve un Re menor de manual: es lo mismo que meter la sensible en lo
    // que eligió no tenerla, dicho del centro del vamp (`sensibleDelCentro`).
    const suya = sensibleDelCentro(j.mode, vamp[0]);
    const laTenia = j.original.some((acorde) => acorde.notas.includes(suya));
    const intruso = laTenia
      ? undefined
      : [...j.cambiados].map((i) => j.cancion[i]!).find((acorde) => acorde.notas.includes(suya));
    if (intruso !== undefined) {
      return {
        valor: -1,
        motivo: `Tu vamp vive en ${vamp[0]} sin su sensible, y el ${intruso.degree} la trae: deja de ser modal.`,
        descarte: 'mete la sensible del centro de tu vamp',
      };
    }
    return ultimo.funcion === 'tonica'
      ? {
          valor: -1,
          motivo: `Cierra en ${j.tonica}, y tu vamp de ${vamp.join(' y ')} no la tenía: deja de ser modal.`,
        }
      : {
          valor: 0.6,
          motivo: `Se queda en el vamp de ${vamp.join(' y ')} sin forzar la ${j.tonica}.`,
        };
  }
  // Meter la sensible en lo que eligió no tenerla no es un color: es cambiarle el
  // modo. Y al revés, en menor: quien eligió el V con sensible no quiere la v sin
  // ella. Las dos son la misma dominante de las dos maneras, y las dos se
  // descartan igual.
  //
  // La sensible no es solo el V: es la nota que sube a la tónica, y la traen
  // también el vii°, el iii de mayor y cualquier dominante que apunte a otro
  // sitio —una secundaria lleva la sensible de su destino—. Antes solo se miraba
  // el V, y un `vii°` o un `V/vi` metían la sensible en un vaivén mixolidio sin
  // que nada lo notara.
  if (j.modal === 'sin-sensible') {
    const suyo = esVampDeFunk(j.mode, j.original, j.estilo)
      ? `vamp de ${[...new Set(j.original.map((acorde) => acorde.degree))].join(' y ')}`
      : j.mode === 'major'
        ? 'bVII'
        : 'v y VII';
    const intruso = [...j.cambiados]
      .map((i) => j.cancion[i]!)
      .find((acorde) => llevaSensible(acorde) || acorde.funcion === 'secundaria');
    return intruso !== undefined
      ? {
          valor: -1,
          motivo: `${suyo.startsWith('vamp') ? `Tu ${suyo} no lleva V` : `Lo tuyo usa ${suyo} y no V`}: el ${intruso.degree}, con su sensible, lo saca del modo.`,
          descarte: 'mete la sensible en lo que eligió no tenerla',
        }
      : { valor: 0.5, motivo: `Se queda en el color de tu ${suyo}, sin meter la sensible.` };
  }
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  // Por las notas y no por el nombre: un V en quintas no tiene tercera, y no ha
  // elegido ninguna sensible.
  if (j.mode === 'minor' && tuyos.has('V') && !tuyos.has('v') && j.original.some(llevaSensible)) {
    // Salvo la v que se toca sobre la nota de una bajada: en `i VII VI V` la v sobre
    // el Sol del VII es el lamento de manual —i, v6, iv6, V—, y la sensible sigue
    // llegando con el V del final, que no se toca.
    const bajada = esUnaBajada(
      j.mode,
      j.original.map((acorde) => acorde.degree),
    );
    const vSobreLaLinea = (i: number) =>
      bajada && j.original[i] !== undefined && j.cancion[i]!.notas.includes(j.original[i]!.root);
    const traeLaV = [...j.cambiados].some((i) => j.cancion[i]!.degree === 'v' && !vSobreLaLinea(i));
    if (traeLaV) {
      return {
        valor: -1,
        motivo: 'Lo tuyo usa V con sensible: la v sin ella suena a otro modo.',
        descarte: 'quita la sensible que tu V había elegido',
      };
    }
    // Y quitarla del todo es lo mismo dicho de otra manera: tu menor armónico se
    // queda en natural. Vale cambiar el V por su sustituto tritonal, que la lleva.
    if (!j.cancion.some(llevaSensible)) {
      return {
        valor: -1,
        motivo: 'Lo tuyo llegaba con la sensible del V, y aquí ya no suena en ningún acorde.',
        descarte: 'quita la sensible que tu V había elegido',
      };
    }
  }
  // **Una andaluza no cierra con VII i**: eso es el cierre del pop. Lo suyo es reposar
  // en el V o llegar a la i por él. Con el estilo flamenco, o con una andaluza que
  // ya reposa en su V (`centroFrigio`, la vara de quien construye los finales).
  const andaluza = centroFrigio(
    j.mode,
    j.estilo,
    j.original.map((acorde) => acorde.degree),
  );
  const conVII =
    final !== null &&
    final.antes !== undefined &&
    (final.antes.degree === 'VII' || final.antes.degree === 'bVII') &&
    j.cambiados.has(final.desde - 1);
  if (andaluza !== null && conVII) {
    return {
      valor: -0.8,
      motivo: `Cierra con ${final.antes!.degree} ${j.tonica}, el cierre del pop: ${j.estilo === 'flamenco' ? 'el flamenco' : 'tu andaluza'} reposa en el ${andaluza.centro} o llega a la ${j.tonica} por él.`,
      reparo: 'cierra una andaluza como un pop',
    };
  }
  const mitad = j.largo / 2;
  if (
    j.frase === 4 &&
    (j.largo === 8 || j.largo === 16) &&
    final !== null &&
    esUnPeriodo(j, mitad)
  ) {
    const enLaMitad = acordeEnCompas(j, j.cancion, mitad - 1)!;
    if (esTension(enLaMitad) && (final.cierre === 'perfecta' || final.cierre === 'sin-sensible')) {
      return {
        valor: 1,
        motivo: `Un periodo: ${enLaMitad.degree === 'V' ? 'semicadencia' : 'queda en tensión'} en ${enLaMitad.degree} en el compás ${mitad} y cierre en el ${j.largo}.`,
      };
    }
  }
  // Y si no es el periodo de manual, lo que completa la forma de lo tuyo; o lo que
  // deja sin cerrar un antecedente.
  return completaLaForma(j, final) ?? periodoSinCerrar(j) ?? NADA;
}

/**
 * **Lo que deja sin cerrar un antecedente**: tu frase de cuatro u ocho empieza en
 * casa y acaba en la dominante —una semicadencia, la mitad de un periodo (`formasDe`)— y lo que sigue
 * se va a otra parte sin el consecuente. Un contraste que vuelve a acabar en V
 * deja dos semicadencias seguidas y el periodo no cierra nunca: tiene reparo. Otra
 * parte que cierra resta menos, pero va detrás de lo que completa la forma (el
 * quinto examen). Solo con la dominante: una frase que acaba en el IV es un bucle,
 * y lo que la sigue puede ser cualquier cosa.
 */
function periodoSinCerrar(j: Juicio): Hecho | null {
  const ultimo = j.original[j.original.length - 1]!;
  const tuyos = compasesDe(j.original, j.pc);
  // Un antecedente empieza en casa: `vi IV I V` es un bucle que vuelve al vi por la
  // rota, y la andaluza, que baja entera hasta el V, reposa ahí (`esUnaBajada`).
  const grados = j.original.map((acorde) => acorde.degree);
  const antecedente =
    j.kind === 'continuar' &&
    grados[0] === j.tonica &&
    (ultimo.degree === 'V' || ultimo.degree === 'v') &&
    !esUnaBajada(j.mode, grados) &&
    tuyos !== null &&
    formasDe(j.mode, tuyos).some((forma) => forma.falta?.que === 'consecuente');
  if (!antecedente || j.loQueSeAnade === 'tuya' || j.loQueSeAnade === 'misma') {
    return null;
  }
  const motivo = `Tu frase empieza en casa y acaba en ${ultimo.degree}, como un antecedente, y lo que sigue se va a otra parte: el periodo se queda a medias.`;
  return j.path === 'contraste'
    ? { valor: -1, motivo, reparo: 'deja el periodo sin cerrar' }
    : { valor: -0.4, motivo };
}

/**
 * Si lo tuyo es un bucle: su papel se repite y **su último acorde lleva a su
 * primero** —`I IV bVI bVII` vuelve a la I por el bVII, `vi V IV V` a la vi por
 * la rota—. Un `iii VI ii V` acaba en un V que pide la I, no su iii: es un
 * turnaround que va hacia fuera, y su V no se juzga contra su principio.
 */
function esUnBucle(j: Juicio): boolean {
  const rol = j.contexto.papel;
  const ultimo = j.original[j.original.length - 1]!;
  const primero = j.original[0]!;
  return (
    (rol === undefined || SE_REPITEN.has(rol)) &&
    ultimo.funcion !== 'tonica' &&
    enlace({ ...j, cancion: [ultimo, primero] }, 1, true).valor >= VUELTA_QUE_LLEGA
  );
}

/**
 * Si lo tuyo es **una frase que llega y se sostiene**: acaba en la tónica, la toca
 * más de un compás y no pasa de una frase —`ii V I I`, `VI VII i i`—. Esa frase se
 * repite, y el compás que sostiene la llegada es el sitio de la vuelta: lo que se
 * ponga ahí —`ii V I vi`— se juzga por cómo vuelve a empezar, igual que un bucle. Un
 * periodo de dos frases que acaba así ha terminado, y ahí no hay vuelta.
 */
function vuelveTrasLlegar(j: Juicio, frase: number): boolean {
  const n = j.original.length;
  const sostiene = n >= 3 && j.original[n - 1]!.funcion === 'tonica';
  return (
    sostiene &&
    j.original[n - 2]!.funcion === 'tonica' &&
    j.original.some((acorde) => acorde.funcion !== 'tonica') &&
    j.largoOriginal <= frase
  );
}

/**
 * De cuántos compases son tus frases.
 *
 * Cuatro, salvo que lo tuyo diga otra cosa **a propósito**: varias frases iguales
 * de largo que no cuadran de cuatro en cuatro y acaban todas en el mismo acorde,
 * como `I IV V | vi IV V`. Eso es una forma, no una frase coja, y cuadrarla a ocho
 * es romperla aunque ocho «cuadre».
 */
function fraseDe(j: Juicio): number {
  const largo = j.largoOriginal;
  if (!Number.isInteger(largo) || largo % 4 === 0) {
    return 4;
  }
  const otra = [3, 5, 6, 7].find((frase) => {
    const veces = largo / frase;
    if (!Number.isInteger(veces) || veces < 2) {
      return false;
    }
    const finales = Array.from(
      { length: veces },
      (_, k) => acordeEnCompas(j, j.original, (k + 1) * frase - 1)!.degree,
    );
    return new Set(finales).size === 1;
  });
  return otra ?? 4;
}

// ─── El juicio ────────────────────────────────────────────────────────────────

/**
 * Juzga una salida contra tu canción y su contexto.
 *
 * Devuelve los once criterios aunque alguno no diga nada, en el mismo orden
 * siempre, para que quien los cuente no tenga que buscarlos. Los que dependen de
 * un contexto que no ha llegado —punteo, estilo, papel— salen a cero y **no
 * cuentan en los puntos**: no es que encajen a medias, es que no se sabe.
 */
/**
 * Lo tuyo **partido como la salida**, cuando la salida parte una dominante en su ii
 * y ella (`partir.ts`): el compás partido se cuenta como dos mitades del mismo
 * acorde, con su especie, su duda y su punteo en las dos.
 *
 * El juez empareja tus compases con los de la salida por su posición, y un acorde
 * de más desalineaba todo lo que venía detrás: el V de la segunda mitad pasaba a
 * «cambiar» el compás de al lado. Así, la primera mitad es lo que cambia —el ii, por
 * su sitio (`porSuSitio`)— y la segunda sigue siendo tuya.
 */
function partidoComoLaSalida(
  original: readonly PathStep[],
  contexto: ContextoDeSalidas,
  candidata: CandidataAJuzgar,
): { readonly original: readonly PathStep[]; readonly contexto: ContextoDeSalidas } {
  const grupos =
    candidata.path === 'rearmonizar' && candidata.cancion.length > original.length
      ? gruposPorPulsos(original, candidata.cancion)
      : null;
  if (grupos === null) {
    return { original, contexto };
  }
  const doble = <T>(lista: readonly T[]): T[] =>
    grupos.flatMap((grupo, i) => grupo.map(() => lista[i]!));
  const { especies, dudosos, melodia } = contexto;
  return {
    original: grupos.flatMap((grupo, i) =>
      grupo.map((j) => ({ degree: original[i]!.degree, beats: candidata.cancion[j]!.beats })),
    ),
    contexto: {
      ...contexto,
      ...(especies === undefined ? {} : { especies: doble(especies) }),
      ...(dudosos === undefined ? {} : { dudosos: doble(dudosos) }),
      ...(melodia === undefined ? {} : { melodia: doble(melodia) }),
    },
  };
}

export function encaje(
  mode: KeyMode,
  kind: PathKind,
  tuyo: readonly PathStep[],
  contextoTuyo: ContextoDeSalidas,
  candidata: CandidataAJuzgar,
): Encaje {
  const { original, contexto } = partidoComoLaSalida(tuyo, contextoTuyo, candidata);
  const existentes = new Set(degreesFor(mode));
  const pasos = [...original, ...candidata.cancion];
  if (
    original.length === 0 ||
    candidata.cancion.length === 0 ||
    pasos.some((paso) => !existentes.has(paso.degree) || !(paso.beats >= 1))
  ) {
    return { puntos: 0, criterios: [], descarte: 'la canción no se puede juzgar en este modo' };
  }

  const especies = contexto.especies ?? [];
  const tuyos = acordes(mode, original, (_, i) => especies[i] ?? null);
  // Lo que la salida no dice de su especie es lo que ya tenía ese compás, si
  // sigue siendo el mismo grado; lo demás suena como su tríada.
  const cancion = acordes(mode, candidata.cancion, (paso, i) =>
    paso.especie !== undefined
      ? paso.especie
      : original[i]?.degree === paso.degree
        ? (especies[i] ?? null)
        : null,
  );
  // El mismo compás que supone quien construye las salidas: uno que no se puede
  // contar —cero pulsos, medio, cien— es el cuatro por cuatro de siempre.
  const pedido = contexto.pulsosPorCompas;
  const pc =
    pedido !== undefined && Number.isInteger(pedido) && pedido >= 1 && pedido <= 16 ? pedido : 4;
  const base: Juicio = {
    mode,
    kind,
    path: candidata.path,
    tonica: tonicaDe(mode),
    estilo: contexto.estilo,
    contexto,
    pc,
    original: tuyos,
    cancion,
    ...compasesNuevos(kind, original, candidata.cancion),
    largo: pulsos(candidata.cancion) / pc,
    largoOriginal: pulsos(original) / pc,
    modal: modalDe(mode, kind, tuyos, contexto.papel, contexto.estilo),
    vamp: vampDe(tuyos),
    bucle: false,
    frase: 4,
    loQueSeAnade: candidata.loQueSeAnade,
    papelNuevo: candidata.papelNuevo,
  };
  // Lo tuyo es un blues si mide doce compases y tiene su forma: los doce primeros
  // de una canción más larga no hacen de ella un coro, y quien construye las
  // salidas (`esUnBlues`) tampoco la trataría como tal.
  const blues = base.largoOriginal === 12 && esBluesDeDoce(base, tuyos);
  // Los ocho primeros de un blues se cuentan de doce en doce al continuarlos: lo
  // que sigue los completa, y dieciséis compases rompen la forma (`bluesAMedias`).
  const aMedias =
    kind === 'continuar' &&
    bluesAMedias(
      mode,
      (compas) => acordeEnCompas(base, tuyos, compas)?.degree,
      base.largoOriginal,
      contexto,
    );
  // Un blues es un bucle aunque acabe en casa: el 12 lleva al coro siguiente.
  const deFrase = fraseDe(base);
  const j: Juicio = {
    ...base,
    bucle: kind === 'retocar' && (blues || esUnBucle(base) || vuelveTrasLlegar(base, deFrase)),
    frase: deFrase,
  };

  const final = finalDe(j);
  const deMelodia = melodia(j);
  const deEstilo = estilo(j);
  const dePapel = papel(j, final);
  const hechos: Readonly<Record<CriterioId, Hecho>> = {
    sintaxis: sintaxis(j),
    cadencia: cadencia(j, final),
    frase: frase(j, final, blues || aMedias),
    'ritmo-armonico': ritmoArmonico(j),
    bajo: bajo(j),
    'notas-comunes': notasComunes(j),
    melodia: deMelodia,
    estilo: deEstilo,
    novedad: novedad(j, j.vamp !== null, blues),
    papel: dePapel,
    forma: forma(j, final, blues),
  };
  const noAplican = new Set<CriterioId>([
    ...(deMelodia.aplica ? [] : (['melodia'] as const)),
    ...(deEstilo.aplica ? [] : (['estilo'] as const)),
    ...(dePapel.aplica ? [] : (['papel'] as const)),
  ]);

  // Con una toma desigual el ritmo manda el doble: es lo primero que hay que
  // arreglar, y cualquier acorde nuevo encima cae igual de a destiempo.
  const pesos: Readonly<Record<CriterioId, number>> =
    cuadraLaToma(j) === null ? PESOS : { ...PESOS, 'ritmo-armonico': PESOS['ritmo-armonico'] * 2 };
  const ids = Object.keys(PESOS) as CriterioId[];
  const criterios: Criterio[] = ids.map((id) => ({
    id,
    valor: Math.round(hechos[id].valor * 100) / 100,
    motivo: hechos[id].motivo,
  }));
  const cuentan = ids.filter((id) => !noAplican.has(id));
  const peso = cuentan.reduce((suma, id) => suma + pesos[id], 0);
  const suma = cuentan.reduce((total, id) => total + pesos[id] * hechos[id].valor, 0);
  const descarte = ids.map((id) => hechos[id].descarte).find((motivo) => motivo !== undefined);
  // Un reparo no descarta: deja la salida por debajo del mínimo, para la red.
  const reparo = ids.map((id) => hechos[id].reparo).find((motivo) => motivo !== undefined);
  const puntos = Math.round(50 + (50 * suma) / peso);

  return {
    puntos: reparo === undefined ? puntos : Math.min(puntos, ENCAJE_MINIMO - 1),
    criterios,
    descarte: descarte ?? null,
    ...(reparo === undefined ? {} : { reparo }),
  };
}
