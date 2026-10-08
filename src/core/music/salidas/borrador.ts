/**
 * Lo que comparten todos los caminos al escribir una salida.
 *
 * El borrador que devuelve cada uno, los nombres de las partes y las frases que
 * dicen lo que hace, con sus topes de largo, que son los del contrato del modelo.
 */
import { enLista } from '../../cifras';
import type { EspecieDeBloque } from '../chords';
import type { DegreeSymbol } from '../progressions';
import type { SectionRole } from '../song';
import { especieNueva, paso } from './especies';
import { LARGO_DE_UNA_FRASE, type Idioma } from './idioma';
import { PARTE_QUE_SIGUE } from './juez/papel';
import { nombreDelCambio } from './movimientos';
import type { LoQueSeAnade, ParteDeSalida, PasoPosible, PathId, PathStep } from './tipos';
import { canFollow, MAX_BEATS, MAX_PATH_STEPS, pulsosDe } from './validar';

/** Lo más largo que puede ser lo que dice una salida: el tope del porqué del contrato. */
export const LARGO_MAXIMO_DE_LO_QUE_HACE = 200;

/** Lo más largo que puede ser su nombre. */
export const LARGO_MAXIMO_DEL_NOMBRE = 60;

/**
 * Lo que hace, y el porqué del movimiento detrás **si cabe entero**. Cortado a
 * media frase sería un porqué que no acaba, y ese se lee peor que ninguno.
 */
export function frase(lo: string, porque: string): string {
  const entera = `${lo} ${porque}`;
  return entera.length <= LARGO_MAXIMO_DE_LO_QUE_HACE ? entera : lo;
}

/** La primera que quepa, de la más completa a la más corta. */
export function laQueQuepa(tope: number, ...opciones: readonly string[]): string {
  // La última es la corta de verdad: se queda aunque no quepa, y la recorta quien llama.
  return [...opciones.filter((opcion) => opcion.length <= tope), opciones.at(-1)!][0]!;
}

/** «el 3 y el 19» o «el 3, el 19, el 23 y 2 más»: hasta cuatro números. */
function compasesEnTexto(numeros: readonly number[]): string {
  const dichos = numeros.slice(0, 4).map((n) => `el ${n}`);
  const resto = numeros.length - dichos.length;
  return enLista(resto > 0 ? [...dichos, `${resto} más`] : dichos);
}

/**
 * El compás en el que empieza el acorde `i`, **contado en compases** y no en
 * acordes: con dos acordes por compás, el quinto acorde está en el compás 3, y
 * decir «en el 5» era señalar otro sitio.
 */
export function compasDelAcorde(id: Idioma, pasos: readonly PathStep[], i: number): number {
  return Math.floor(pulsosDe(pasos.slice(0, i)) / id.compas) + 1;
}

/**
 * «V por vi en el 3 y el 19 (cadencia interrumpida)»: los cambios agrupados por lo
 * que cambian, hasta tres grupos, y cada uno con los compases donde cae.
 *
 * Agrupados y no compás a compás porque con treinta y dos compases el mismo cambio
 * salía ocho veces escrito, y cada vez son tokens de entrada que pagan los cupos.
 */
export function cambiosEnTexto(
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
export function comoLlega(
  id: Idioma,
  penultimo: DegreeSymbol,
  especie: EspecieDeBloque | null,
): string {
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
export function conArticulo(parte: NombreDeParte): string {
  return `${parte.un} ${parte.nombre.toLowerCase()}`.trim();
}

/** Lo mismo, con mayúscula: para empezar un nombre. */
export function conArticuloArriba(parte: NombreDeParte): string {
  const dicho = conArticulo(parte);
  return dicho.charAt(0).toUpperCase() + dicho.slice(1);
}

export const PUENTE: NombreDeParte = { nombre: 'Puente', un: 'un' };
const ESTRIBILLO: NombreDeParte = { nombre: 'Estribillo', un: 'un' };
const ESTROFA: NombreDeParte = { nombre: 'Estrofa', un: 'una' };
export const CIERRE: NombreDeParte = { nombre: 'Cierre', un: 'un' };

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

export const LO_QUE_CONTRASTA = nombresPara('contraste');

export const OTRO_ESTRIBILLO: NombreDeParte = { nombre: 'Otro estribillo', un: '' };

/**
 * Lo que sigue a un estribillo es el final, y un final es corto: **más de una
 * frase detrás de un estribillo es otro estribillo**, y se llama así —y así lo
 * juzga el juez, como la misma parte otra vez—. Antes se llamaba «Final» y el
 * juez la juzgaba como estribillo; la verificación ya había pedido que la coda
 * larga dejara paso a otro estribillo.
 */
export function otraVez(id: Idioma, steps: readonly PathStep[]): NombreDeParte | null {
  return id.papel === 'estribillo' && pulsosDe(steps) > LARGO_DE_UNA_FRASE * id.pulsos
    ? OTRO_ESTRIBILLO
    : null;
}

/** Y la frase nueva que acaba en casa, cuando lo tuyo ya cerraba o hay sitio para una frase. */
export const LO_QUE_CIERRA = nombresPara('seguir');

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
export function empiezaPor(
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

/** Lo que construye cada salida, antes de juzgarla. */
export interface Borrador {
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
export function prioridadDe(valor: number): number {
  return 5 + 2 * valor;
}

export function retoque(steps: readonly PasoPosible[]): ParteDeSalida[] {
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
export function largosQueCuadran(id: Idioma, original: readonly PathStep[]): number[] {
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
export function repartir(
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
export function nuevos(
  id: Idioma,
  grados: readonly DegreeSymbol[],
  pulsos: readonly number[],
): PasoPosible[] {
  return grados.map((degree, i) => paso(degree, pulsos[i]!, null, especieNueva(id, degree, null)));
}

/** El consecuente de un periodo: tu cabeza otra vez, y cierra en casa. */
export const CONSECUENTE: NombreDeParte = { nombre: 'Consecuente', un: 'un' };

/** Cómo se llama la última sección de una AABA cuando se añade: lo tuyo otra vez. */
export const ULTIMA_VUELTA: NombreDeParte = { nombre: 'Última vuelta', un: 'una' };
