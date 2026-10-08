/**
 * El vocabulario del juez: lo que ve de la canción y cómo lo dice.
 *
 * El `Juicio` es tu canción y la salida ya leídas —acordes con su función, compases
 * de verdad, modal o no—, y el `Hecho` es lo que devuelve cada criterio. Cada
 * criterio vive en su fichero y solo importa de aquí y de los de abajo.
 */
import {
  esEspecieSimple,
  notasDeEspecieSimple,
  seventhNotes,
  type EspecieDeBloque,
} from '../../chords';
import { roleOfDegreeSymbol, type HarmonicRole } from '../../harmonic-function';
import type { KeyMode } from '../../keys';
import { resolveDegree, type DegreeSymbol } from '../../progressions';
import type { SectionRole } from '../../song';
import type { StyleId } from '../../styles';
import type { ContextoDeSalidas } from '../contexto';
import type { MoveId } from '../movimientos';
import type { LoQueSeAnade, PasoJuzgado, PathId, PathKind, PathStep } from '../tipos';
import { tonicaDe } from '../tonica';

/**
 * Lo que hace un acorde en la frase, más fino que `roleOfDegreeSymbol`.
 *
 * Hace falta separar dos cosas que allí van juntas como `dominant`: **el V, que
 * lleva la sensible y pide resolver, y el bVII, que cierra sin ella**. Tratarlos
 * igual es lo que hacía valer un bVII lo mismo que un V en un jazz. Lo mismo el
 * `VII` y el `v` del menor natural. Y las dos dominantes que apuntan a otro sitio
 * —una secundaria, un sustituto tritonal— se juzgan por si llegan a lo suyo.
 */
export type Funcion =
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
export const PRESTADOS_EN_MAYOR: ReadonlySet<DegreeSymbol> = new Set(['bIII', 'bVI', 'bVII', 'iv']);

export interface Acorde {
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
export function compasDe(j: Pick<Juicio, 'pc'>, acorde: Pick<Acorde, 'inicio'>): number {
  return Math.floor(acorde.inicio / j.pc) + 1;
}

/** «comparten dos notas», «una sola», «ninguna»: dicho como se dice, sin «1 notas». */
export function notasEnComun(notas: number): string {
  return notas === 0
    ? 'no comparten ninguna nota'
    : notas === 1
      ? 'comparten una sola nota'
      : `comparten ${notas} notas`;
}

/** Lo que todos los criterios necesitan saber, calculado una vez. */
export interface Juicio {
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
export interface Hecho {
  readonly valor: number;
  readonly motivo: string;
  readonly descarte?: string;
  readonly reparo?: string;
}

export const NADA: Hecho = { valor: 0, motivo: '' };

/** La tónica como acorde, para lo que viene después de una parte que va hacia fuera. */
export const TONICA: Readonly<Record<KeyMode, Pick<Acorde, 'degree' | 'root'>>> = {
  major: { degree: 'I', root: 0 },
  minor: { degree: 'i', root: 0 },
};

export function acotar(valor: number): number {
  return Math.max(-1, Math.min(1, valor));
}

/**
 * Las notas de un grado con su especie, con la tónica en cero.
 *
 * Es lo mismo que hace `blockChord`, pero sin pasar por `arrangement.ts`: ese
 * fichero arrastra la captura y la reproducción, y quien construye las salidas —que llama a
 * este juez— no debería cargar con ellas ni arriesgar un ciclo de importaciones.
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

export function acordes(
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

export function pulsos(pasos: readonly { readonly beats: number }[]): number {
  return pasos.reduce((suma, paso) => suma + paso.beats, 0);
}

/**
 * Los pulsos que puede durar un acorde nuevo sin salirse del compás: medio compás
 * —si eso son dos pulsos o más—, uno entero, dos o cuatro. En cuatro por cuatro,
 * 2, 4, 8 y 16; en tres por cuatro, 3, 6 y 12.
 */
export function rejillaDelCompas(pc: number): number[] {
  const medio = pc % 2 === 0 && pc >= 4 ? [pc / 2] : [];
  return [...medio, pc, 2 * pc, 4 * pc, 8 * pc].filter((b) => b <= 16);
}

/** El acorde que suena en un pulso, contando desde el primero de la canción. */
export function acordeEnPulso(pasos: readonly Acorde[], pulso: number): Acorde | undefined {
  return pasos.find((paso) => paso.inicio <= pulso && pulso < paso.inicio + paso.beats);
}

/** El acorde que suena al empezar un compás. */
export function acordeEnCompas(
  j: Juicio,
  pasos: readonly Acorde[],
  compas: number,
): Acorde | undefined {
  return acordeEnPulso(pasos, compas * j.pc);
}

/**
 * Los compases de la salida que no son tuyos tal cual: los que traen otro acorde
 * y, además, los que solo duran otra cosa.
 */
export function compasesNuevos(
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
export function esDudoso(j: Juicio, i: number): boolean {
  return j.contexto.dudosos?.[i] === true && j.cancion[i]!.degree === j.original[i]?.degree;
}

/** Los enlaces que la salida pone: de un acorde a otro, con uno de los dos suyo. */
export function enlacesNuevos(j: Juicio): number[] {
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
export function enlaceDeVuelta(j: Juicio): readonly [Acorde, Acorde] | null {
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
export function juntar(hechos: readonly { readonly hecho: Hecho; readonly peso: number }[]): Hecho {
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
export const DOBLE_PLAGAL: Readonly<Record<StyleId | 'ninguno', number>> = {
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
export function eligioLaSensible(j: Juicio): boolean {
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  return j.mode === 'minor' && tuyos.has('V') && !tuyos.has('v') && !tuyos.has('VII');
}

/**
 * Lo que vale cerrar sin sensible aquí: lo que diga el estilo, y nada si lo tuyo
 * eligió tenerla.
 */
export function sinSensible(j: Juicio): number {
  const delEstilo = SIN_SENSIBLE[j.mode][estiloOno(j)];
  return eligioLaSensible(j) ? -1 : delEstilo;
}

export function estiloOno(j: Juicio): StyleId | 'ninguno' {
  return j.estilo ?? 'ninguno';
}

/** En qué estilo, dicho en una frase: «en jazz», o «sin estilo elegido». */
export function enEstilo(j: Juicio): string {
  return j.estilo === undefined ? 'sin estilo elegido' : `en ${j.estilo}`;
}

/** Si un grado es la relativa de la tónica: donde cae una cadencia rota de verdad. */
export function esRelativaDeLaTonica(degree: DegreeSymbol): boolean {
  return degree === 'vi' || degree === 'VI';
}

/**
 * Cómo se llega a la tónica final.
 *
 * `plagal` es **llegar desde la subdominante**, cualquiera: el IV y el iv, que son
 * la plagal de verdad, y también el ii, el bVI o el bII sin séptima, que cierran
 * con la misma fuerza y otro nombre (`nombreDelCierre`). `sensible` es el vii°
 * tríada: lleva la sensible pero no la dominante entera, y no cierra como ella.
 */
export type Cierre = 'perfecta' | 'sin-sensible' | 'plagal' | 'sensible' | 'rebote' | 'ninguna';

export interface Final {
  readonly cierre: Cierre;
  /** Desde qué paso suena la tónica final, si acaba en ella. */
  readonly desde: number;
  /** El compás —desde cero— en el que llega. */
  readonly compas: number;
  readonly antes: Acorde | undefined;
}

/** Cómo se llama llegar a casa desde una subdominante: la plagal solo desde el IV. */
export function llegadaDesdeLaSubdominante(degree: DegreeSymbol): string {
  if (degree === 'IV') {
    return 'cadencia plagal, el amén';
  }
  if (degree === 'iv') {
    return 'cadencia plagal menor';
  }
  return `llega desde el ${degree} sin pasar por la dominante`;
}

/** Si un acorde deja la frase en tensión: la semicadencia, o la vuelta que vuelve a empezar. */
export function esTension(acorde: Acorde): boolean {
  return familia(acorde.funcion) === 'D';
}

/** Tónica y sustituto reposan igual; dominante y modal tensan igual. */
export function familia(funcion: Funcion): string {
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
 * Si un acorde lleva la sensible: la nota medio tono por debajo de la tónica. El
 * sustituto tritonal la lleva como séptima aunque se escriba sin ella: declararlo
 * tritono es decir que suena como dominante.
 */
export function llevaSensible(acorde: Acorde): boolean {
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
export function modalDe(
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
  // llegue (el quinto examen). Es la misma regla que `PIDEN_LLEGADA` en `idioma.ts`.
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
 * también quien construye las salidas (`salidas/`).
 */
export function sensibleDelCentro(mode: KeyMode, centro: DegreeSymbol): number {
  return (resolveDegree(0, mode, centro).root + 11) % 12;
}

/**
 * **Un vamp de funk** —la tónica y su cuarto, nada más— **elige no tener sensible**:
 * el I7 y el IV7 no la llevan, y el im7 y el iv7 tampoco. Meterle un V7 que resuelve
 * es la cadencia clásica que el vamp evita (el quinto examen). La misma vara que
 * `esUnVampDeFunk` en `validar.ts`, sobre los grados.
 */
export function esVampDeFunk(
  mode: KeyMode,
  original: readonly Acorde[],
  estilo: StyleId | undefined,
) {
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
export function vampDe(original: readonly Acorde[]): readonly [DegreeSymbol, DegreeSymbol] | null {
  if (original.length < 2) {
    return null;
  }
  const [a, b] = [original[0]!.degree, original[1]!.degree];
  const alterna = a !== b && original.every((acorde, i) => acorde.degree === (i % 2 === 0 ? a : b));
  return alterna ? [a, b] : null;
}
