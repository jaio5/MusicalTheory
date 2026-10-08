/**
 * El menú de las salidas: las que construye el dominio para tu canción, tal y
 * como se le enseñan al modelo y tal y como se validan.
 *
 * Aparte del prompt y del contrato porque lo usan los dos —el prompt para
 * escribirlo y el contrato para saber qué número es cuál— y tienen que ver **la
 * misma lista**: si el contrato contara una salida que el prompt no enseñó, el
 * número que contesta el modelo apuntaría a otra.
 */
import { MAX_SALIDAS } from '@core/billing';
import {
  DEFAULT_ROLE,
  esRelleno,
  salidasPosibles,
  type Color,
  type ContextoDeSalidas,
  type CriterioId,
  type SalidaPosible,
} from '@core/music';

import type { SalidasRequest, SalidaStep } from './peticion';

/**
 * Cómo se llama cada color en el prompt: palabras de músico, no identificadores.
 *
 * **Cortas, y lo que quieren decir va una vez en el prompt de sistema**
 * (`SALIDAS_SYSTEM_PROMPT`): «aclara (más alegre, luminoso)» repetido en cada
 * línea del menú eran cuarenta caracteres por salida, y ese sitio lo ocupa ahora
 * el porqué del juez, que es lo que el modelo necesita para no inventárselo.
 */
export const COLORES: Readonly<Record<Color, string>> = {
  oscurece: 'oscurece',
  aclara: 'aclara',
  tension: 'tensión',
  prestado: 'prestado',
  cierra: 'cierra',
  abierto: 'abierto',
  'mas-lento': 'más lento',
  'mas-rapido': 'más rápido',
  'mas-corto': 'más corto',
  cuadra: 'cuadra los pulsos',
};

/**
 * Cuántas salidas lleva el menú como mucho.
 *
 * **Seis y no las nueve que construye el dominio**, porque desde que el juez las
 * ordena (`core/music/salidas/juez/`) las de abajo son las que peor encajan: medido contra
 * `qwen3:8b` en el corpus, el modelo elegía la primera casi siempre y lo que
 * tomaba de la séptima a la novena era lo que más suspendía. Con tres menos cabe
 * el porqué de cada una sin subir el presupuesto de entrada.
 *
 * **Y seis solo cuando hay directrices**: sin ellas el modelo ve las tres mejores y
 * las explica (`soloExplica`), porque eligiendo entre seis restaba.
 */
export const MAX_OPCIONES_DEL_MENU = 6;

/** Cuántos motivos del juez van con cada salida: el que más pesa y, si cabe, otro. */
const MOTIVOS_POR_SALIDA = 2;

/**
 * Lo que tiene que valer un criterio para que su motivo se cuente como razón.
 *
 * Por debajo de medio punto un motivo es un hecho que no ayuda —«V IV: la
 * dominante vuelve a la subdominante sin resolver» sale con un 0,04—, y contarlo
 * como porqué sería vender un defecto.
 */
const VALOR_DE_UN_MOTIVO = 0.5;

/**
 * Los criterios que dicen algo de **esta** salida: cómo suena con lo tuyo, con tu
 * estilo, con tu punteo.
 *
 * Los demás —el bajo, lo que cambia, los compases, los pulsos— solo se cuentan si
 * faltan de estos: «cambia 2 de 4 compases: se nota y sigue siendo tuya» sale con
 * un 1 en casi todo retoque, y como porqué no le dice nada a nadie.
 */
const LO_QUE_SE_OYE: readonly CriterioId[] = [
  'melodia',
  'estilo',
  'cadencia',
  'sintaxis',
  'notas-comunes',
  'papel',
  'forma',
];

/** De qué enlace habla un motivo: lo que va antes de los dos puntos, sin el compás. */
function enlace(motivo: string): string {
  return motivo.split(':')[0]!.replace(/ en el \d+$/u, '');
}

/**
 * Los motivos del juez que mejor dicen por qué esta salida encaja, **los que la
 * distinguen de las demás del menú**.
 *
 * Son hechos en grados que escribió quien la juzgó, así que el porqué que se
 * apoye en ellos cuenta algo verdadero. Uno que tienen todas las del menú —«los
 * acordes nuevos duran 4 pulsos, como los tuyos»— no ayuda a elegir y se calla.
 *
 * Con `sostiene`, solo los que pasan el validador del porqué: un motivo puede ser
 * verdad y no pasar (`seSostiene`, en el contrato), y enseñárselo al modelo como
 * porqué es invitarle a escribir algo que luego se tapa. Filtra después de elegir
 * los dos mejores, y solo si no queda ninguno busca el siguiente que pase.
 */
function motivosDe(
  salida: SalidaPosible,
  menu: readonly SalidaPosible[],
  sostiene: (motivo: string) => boolean,
): string[] {
  // Primero lo que se oye, del más fuerte al más flojo; después lo demás.
  const peso = (c: { readonly id: CriterioId }) => (LO_QUE_SE_OYE.includes(c.id) ? 0 : 1);
  const deTodas = (motivo: string) =>
    menu.length > 1 &&
    menu.every((otra) => otra.encaje?.criterios.some((c) => c.motivo === motivo) === true);
  const criterios = salida.encaje?.criterios ?? [];
  const candidatos = [...criterios]
    .filter((c) => c.motivo !== '' && c.valor >= VALOR_DE_UN_MOTIVO && !deTodas(c.motivo))
    .sort((a, b) => peso(a) - peso(b) || b.valor - a.valor)
    .map((c) => c.motivo)
    // Dos criterios pueden contar el mismo enlace —«V/vi vi en el 2: llega a lo
    // que preparaba» y «V/vi vi: V/vi llega a lo que preparaba»—, y dicho dos
    // veces es una razón, no dos.
    .filter((motivo, i, todos) => todos.findIndex((otro) => enlace(otro) === enlace(motivo)) === i);
  const elegidos = candidatos.slice(0, MOTIVOS_POR_SALIDA).filter((motivo) => sostiene(motivo));
  if (elegidos.length > 0) {
    return elegidos;
  }
  // **Una salida sin porqué se queda con el de la de al lado**: el modelo le
  // prestaba los motivos de la línea siguiente, y nombraba acordes que no tenía
  // (medido el 4 de octubre: tres de los cinco porqués falsos del corpus).
  const otro = candidatos.slice(MOTIVOS_POR_SALIDA).find((motivo) => sostiene(motivo));
  if (otro !== undefined) {
    return [otro];
  }
  // **Y si todo lo que dice el juez lo dicen también las demás**, se cuenta igual lo
  // mejor que tiene: un «Por qué:» vacío detrás de «A doble tiempo» dejaba al modelo
  // sin nada que contar (corpus final). Que lo compartan no lo hace falso.
  const compartido = [...criterios]
    .filter((c) => c.motivo !== '' && c.valor >= VALOR_DE_UN_MOTIVO && sostiene(c.motivo))
    .sort((a, b) => peso(a) - peso(b) || b.valor - a.valor)[0];
  return compartido === undefined ? [] : [compartido.motivo];
}

/**
 * Una salida del menú, en una línea: qué hace, hacia dónde tira y por qué encaja.
 *
 * El porqué va detrás de «Por qué:» y con las palabras del juez, que el prompt de
 * sistema le dice que cuente: sin él, el modelo se inventaba el suyo, y lo que se
 * inventaba era que cerraba lo que se quedaba abierto.
 */
export function lineaDeSalida(
  salida: SalidaPosible,
  numero: number,
  motivos: readonly string[] = [],
): string {
  const colores = salida.colores.map((c) => COLORES[c]).join(', ');
  const porque = motivos.length > 0 ? ` Por qué: ${motivos.join(' ')}` : '';
  return `${numero}. ${salida.path}: ${salida.que} [${colores}]${porque}`;
}

/**
 * Lo más que ocupa el menú, en caracteres, con todos sus motivos.
 *
 * Seis salidas con dos motivos cada una caben en casi cualquier canción; esto
 * corta la cola cuando las frases del dominio salen largas. **El presupuesto de
 * entrada no lo cuida este tope sino el del prompt entero**
 * (`MAX_CARACTERES_DEL_PROMPT`, en `prompt.ts`), que le enseña al modelo un
 * principio de este menú en el sitio que deja el resto: con treinta y dos compases
 * y las directrices enteras no caben seis, y se callan primero los motivos.
 */
export const MAX_CARACTERES_DEL_MENU = 2100;

/**
 * El contexto de una petición, tal como lo leen las salidas.
 *
 * **Sale de la petición entera y de nada más**, y por eso es una función y no un
 * campo aparte: el menú se construye al leer la petición, al escribir el prompt, al
 * validar y en el respaldo sin IA, y el modelo contesta por número. Si uno de esos
 * sitios leyera el contexto de otro lado, el número señalaría otra salida.
 *
 * Cada cosa viaja una sola vez: el papel en `role`, la duda en `heard`, la especie
 * y las notas con su compás. Aquí se ponen en la forma de `ContextoDeSalidas`, con
 * las listas compás a compás; una lista sin nada que decir no se pone.
 */
export function contextoDe(request: SalidasRequest): ContextoDeSalidas {
  const pasos = request.progression;
  return {
    ...(request.estilo === undefined ? {} : { estilo: request.estilo }),
    ...(request.pulsosPorCompas === undefined ? {} : { pulsosPorCompas: request.pulsosPorCompas }),
    papel: request.role ?? DEFAULT_ROLE,
    ...(pasos.some((paso) => paso.especie !== undefined)
      ? { especies: pasos.map((paso) => paso.especie ?? null) }
      : {}),
    ...(pasos.some((paso) => paso.heard === true)
      ? { dudosos: pasos.map((paso) => paso.heard === true) }
      : {}),
    ...(pasos.some((paso) => paso.notas !== undefined)
      ? { melodia: pasos.map((paso) => paso.notas ?? []) }
      : {}),
  };
}

/** Los compases de una salida que no son los tuyos tal cual: lo que pone ella. */
function loQuePone(salida: SalidaPosible, tuyos: readonly SalidaStep[]): Set<string> {
  return new Set(
    salida.secciones
      .flatMap((seccion) => seccion.steps)
      .flatMap((paso, i) =>
        tuyos[i]?.degree === paso.degree && tuyos[i]?.beats === paso.beats
          ? []
          : [`${i}:${paso.degree}:${paso.beats}`],
      ),
  );
}

/**
 * Si dos salidas son **la misma idea**: el mismo camino, y lo que pone una está
 * todo en lo que pone la otra. «Su relativo, en el 4» y «Su relativo, donde
 * cabe», o «Resuelve en la I» y la frase que resuelve en la I y sigue.
 */
function esVariante(a: SalidaPosible, b: SalidaPosible, tuyos: readonly SalidaStep[]): boolean {
  if (a.path !== b.path) {
    return false;
  }
  const deA = loQuePone(a, tuyos);
  const deB = loQuePone(b, tuyos);
  const dentro = (x: Set<string>, y: Set<string>) => [...x].every((cambio) => y.has(cambio));
  return dentro(deA, deB) || dentro(deB, deA);
}

/**
 * Cuántas de las tres pueden ser del mismo camino mientras haya otro en el menú.
 *
 * Tres rearmonizaciones seguidas son tres maneras de tocar lo mismo, y quien pidió
 * salidas quería ver por dónde puede tirar: con una de otro camino entre las seis
 * del menú, la tercera cede su sitio.
 */
const MAX_POR_CAMINO = 2;

/**
 * Cuántos puntos del juez puede perder la variedad: si lo que entraría por otro
 * camino está **más de esto por debajo**, el tope cede y entra la tercera del mismo.
 *
 * La variedad no puede echar a la única buena. En una estrofa que cambia de acorde
 * cada dos compases, la única salida que respetaba ese ritmo era la tercera de su
 * camino, y el tope la cambiaba por un contraste que lo rompía (corpus final, el
 * 5 de octubre). Ocho puntos es más de lo que separa dos salidas buenas del mismo
 * menú, y menos de lo que pierde una con un reparo.
 */
export const PEOR_DE_VERDAD = 8;

/** Los puntos del juez, o nada si la salida no se juzgó: entonces no se comparan. */
function puntosDe(salida: SalidaPosible): number | null {
  return salida.encaje?.puntos ?? null;
}

/**
 * **Las tres mejores del menú, y tres ideas distintas**: su sitio en él, desde
 * cero y en su orden.
 *
 * El menú ya viene ordenado por el juez, así que casi siempre son las tres
 * primeras; cede su sitio a la siguiente la que es la misma idea que una ya
 * elegida —el mismo camino, y lo que pone una está en la otra— y la tercera de un
 * mismo camino si hay otro. Si no hay tres ideas distintas, las que falten por su
 * orden. Medido en el corpus a las 20:35 del 4 de octubre: cambia en cinco de
 * setenta y dos peticiones, y la nota es la misma que la de las tres primeras (506
 * de 513).
 *
 * **Es lo que se lleva quien pide sin directrices, con modelo o sin él**: el menú
 * que ve el modelo entonces son estas tres (`menuDe`), y el respaldo contesta
 * estas mismas (`app/api/salidas/salidas.ts`). Vivía en el modelo que no piensa
 * (`server/fake-model.ts`), y desde que también decide el menú está aquí, que es
 * lo que pueden abrir los dos.
 */
export function lasTresMejores(
  menu: readonly SalidaPosible[],
  tuyos: readonly SalidaStep[],
): number[] {
  const distintas: number[] = [];
  const nueva = (salida: SalidaPosible) =>
    distintas.every((j) => !esVariante(menu[j]!, salida, tuyos));
  const llenoDe = (path: SalidaPosible['path']) =>
    distintas.filter((j) => menu[j]!.path === path).length >= MAX_POR_CAMINO;
  for (const [i, salida] of menu.entries()) {
    if (distintas.length >= MAX_SALIDAS || !nueva(salida)) {
      continue;
    }
    if (llenoDe(salida.path)) {
      // Cede su sitio a la de otro camino que entraría, **si esa no es claramente
      // peor**: sin puntos que comparar, cede, que es lo de siempre.
      const otra = menu
        .slice(i + 1)
        .find((o) => o.path !== salida.path && nueva(o) && !llenoDe(o.path));
      const suyos = puntosDe(salida);
      const deLaOtra = otra === undefined ? null : puntosDe(otra);
      // Y nunca a un relleno que no la supere (`esRelleno`): los mismos acordes a otra
      // velocidad no son otra idea, solo otro camino. Cedía justo en el umbral, con
      // siete puntos menos (el quinto examen).
      const cede =
        otra !== undefined &&
        (suyos === null ||
          deLaOtra === null ||
          (esRelleno(tuyos, otra) ? deLaOtra >= suyos : suyos - deLaOtra <= PEOR_DE_VERDAD));
      if (cede) {
        continue;
      }
    }
    distintas.push(i);
  }
  return [...distintas, ...[...menu.keys()].filter((i) => !distintas.includes(i))]
    .slice(0, MAX_SALIDAS)
    .sort((a, b) => a - b);
}

/** Una salida del menú con los motivos del juez que se le enseñan al modelo. */
export interface OpcionDelMenu {
  readonly salida: SalidaPosible;
  readonly motivos: readonly string[];
}

/**
 * Si el modelo de esta petición **explica** y no elige: sin directrices.
 *
 * Medido el 4 de octubre contra `qwen3:8b`, eligiendo entre seis sacaba 504 de 513
 * y las tres mejores solas 506: cogía la 1 y la 2 y luego una de la 4 a la 6. Sin
 * directrices no sabe nada que el juez no sepa, así que lo que aporta es contar las
 * tres mejores, en el orden que mejor las cuente. Con directrices sí sabe algo —lo
 * que se pide— y ve el menú entero para encontrarlo.
 */
export function soloExplica(request: SalidasRequest): boolean {
  return request.directrices === undefined;
}

/**
 * El menú de esta petición, hasta que llena su sitio: **las mismas salidas** al
 * escribir el prompt, al validar y en el respaldo, porque el modelo contesta con
 * su número.
 *
 * **Sin directrices son las tres mejores** (`lasTresMejores`), numeradas del uno
 * al tres; con ellas, las seis primeras del juez. Los motivos se escogen contra las
 * seis en los dos casos, así que una salida se cuenta igual en un menú que en otro.
 *
 * El sitio se mide con los motivos **sin filtrar**, así que qué salidas entran no
 * depende de `sostiene`: el contrato, que pide el menú sin filtro, cuenta la misma
 * lista que el prompt. Lo que ocupa de verdad cada línea en el prompt lo mide
 * `menuDelPrompt`, que es el que cuida el presupuesto.
 */
export function menuDe(
  request: SalidasRequest,
  sostiene: (motivo: string, salida: SalidaPosible) => boolean = () => true,
): OpcionDelMenu[] {
  const seis = salidasPosibles(
    request.key.mode,
    request.kind,
    request.progression,
    contextoDe(request),
  ).slice(0, MAX_OPCIONES_DEL_MENU);
  const primeras = soloExplica(request)
    ? lasTresMejores(seis, request.progression).map((i) => seis[i]!)
    : seis;
  const caben: OpcionDelMenu[] = [];
  let ocupado = 0;
  for (const salida of primeras) {
    // Una línea más su salto.
    ocupado +=
      lineaDeSalida(
        salida,
        caben.length + 1,
        motivosDe(salida, seis, () => true),
      ).length + 1;
    if (ocupado > MAX_CARACTERES_DEL_MENU) {
      break;
    }
    caben.push({
      salida,
      motivos: motivosDe(salida, seis, (motivo) => sostiene(motivo, salida)),
    });
  }
  return caben;
}

/** Las salidas del menú, sin sus motivos: lo que cuenta el contrato al validar. */
export function salidasDe(request: SalidasRequest): readonly SalidaPosible[] {
  return menuDe(request).map((opcion) => opcion.salida);
}
