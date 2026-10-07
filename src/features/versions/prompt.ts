/**
 * El prompt de las salidas: lo que se le cuenta al modelo antes de pedirle.
 *
 * Vivía dentro de la ruta. Se saca aquí para que **el banco de pruebas mida
 * este prompt y no una copia suya**: un banco con el suyo propio mediría otro
 * programa, y en cuanto este cambiara las cifras dejarían de hablar de lo que
 * hay en producción.
 *
 * Al lado del contrato y no en `server/`, porque lo que necesita —la forma de
 * la petición— está aquí y `src/server/` no puede importar de `features/`. Solo
 * lo abre la ruta, así que no llega al navegador.
 *
 * **Ya no le enseña a construir salidas: le da el menú.** Llevaba el catálogo de
 * caminos, el de movimientos, el mapa de saltos entero, las cadencias y, al
 * retocar, un ejemplo de cada salida hecho con tus compases. `qwen3:8b` copiaba
 * el ejemplo 21 veces de 22, y al continuar la primera cadencia de la lista 18
 * de 21. Ahora las salidas las construye el dominio (`salidasPosibles`) y lo que
 * va aquí es la lista numerada, con lo que hace cada una y hacia dónde tira
 * (`menu.ts`).
 *
 * **Sin directrices no elige: explica.** El menú son entonces las tres mejores
 * (`lasTresMejores`) y se le pide que las cuente todas, en el orden que quiera;
 * eligiendo entre seis, `qwen3:8b` sacaba menos nota que el juez solo. Con
 * directrices ve las seis y elige las que van hacia lo que se pide.
 *
 * **Y lo que el juez sabe, para elegir y para explicar.** El menú llega ordenado
 * por encaje (`encaje.ts`) con el contexto de la petición —estilo, compás, papel,
 * especies, punteo—, y el modelo no sabía ni lo uno ni lo otro: elegía como si el
 * orden fuera una lista más y explicaba de memoria. Ahora el prompt dice el
 * contexto, que el menú va de más a menos encaje, y el porqué de cada salida con
 * los motivos del juez, que son hechos.
 */
import {
  accidentalForKey,
  blockChord,
  DEFAULT_ROLE,
  degreesFor,
  normalizePitchClass,
  noteName,
  pitchClassFromName,
  resolveProgression,
  roleInfo,
  STYLES,
  writtenBlock,
  type DegreeSymbol,
  type SectionRole,
} from '@core/music';

import { CARACTERES_POR_TOKEN, tokensEnElPeorCaso } from '@core/marca';

import {
  directricesEntreMarcas,
  seSostiene,
  type VersionsRequest,
  type VersionStep,
} from './contract';
import {
  lineaDeSalida,
  MAX_CARACTERES_DEL_MENU,
  menuDe,
  salidasDe,
  soloExplica,
  type OpcionDelMenu,
} from './menu';

export { salidasDe };

/** El cifrado de un compás con su especie —`G7`, `C5`—, como lo escribe el contrato. */
function cifradoDe(request: VersionsRequest, paso: VersionStep): string {
  return blockChord(
    pitchClassFromName(request.key.tonic),
    request.key.mode,
    writtenBlock('', paso.degree, 1, paso.especie),
  ).symbol;
}

/**
 * Un compás escrito para el modelo: `2:V`, `2:V=G7` si suena con especie, con
 * `x4` si los pulsos no son los de todos y `?` si lo leyó el micro.
 *
 * **La especie va con su cifrado**, no la tríada a secas: un blues en `I7 IV7 V7`
 * llegaba como `I IV V`, y el porqué hablaba de un G donde sonaba un G7.
 *
 * **La marca es la que el prompt de sistema promete**: decía que los compases
 * oídos venían marcados y no se marcaba ninguno. Una interrogación y no una
 * palabra: con treinta y dos compases dudosos, «(dudoso)» eran ochenta tokens.
 */
function compas(
  request: VersionsRequest,
  paso: VersionStep,
  numero: number,
  conPulsos: boolean,
): string {
  const especie = paso.especie === undefined ? '' : `=${cifradoDe(request, paso)}`;
  const pulsos = conPulsos ? ` x${paso.beats}` : '';
  return `${numero}:${paso.degree}${especie}${pulsos}${paso.heard === true ? '?' : ''}`;
}

/**
 * Tus compases numerados: el menú habla de «el compás 3», y sin los números el
 * modelo tendría que contarlos.
 *
 * Cuando todos duran lo mismo, los pulsos se dicen una vez: es lo normal, y con
 * treinta y dos compases eran cien caracteres que no decían nada.
 */
function lineaDeCompases(request: VersionsRequest): string {
  const pasos = request.progression;
  const iguales = pasos.every((paso) => paso.beats === pasos[0]!.beats);
  const cabeza = iguales
    ? `Sus compases, de ${pasos[0]!.beats} pulsos cada uno:`
    : 'Sus compases (grado y pulsos):';
  return `${cabeza} ${pasos.map((paso, i) => compas(request, paso, i + 1, !iguales)).join(' | ')}`;
}

/**
 * Los grados que se nombran en lo que lee el modelo, con su acorde en esta
 * tonalidad: `Acordes por grado: I=C V=G vi=Am`.
 *
 * El menú va en grados, y el porqué que se pinta habla de acordes. Sin la tabla,
 * el modelo los tendría que calcular de memoria, que es de donde salen «E#» y las
 * cadencias perfectas que acaban en F (adr/0076). La tríada, porque es como suena
 * ese grado en lo que añade una salida.
 *
 * **Solo los que salen**: los tuyos, los de cada salida del menú y los que dice lo
 * que hace cada una. Llevaba los dieciséis de la tonalidad, con los prestados y las
 * secundarias, y detrás de cada uno las especies que sonaban en lo tuyo: hasta 330
 * caracteres de los que el modelo no podía usar un grado que no estuviera en el
 * menú —el validador tapa el porqué que nombra un acorde de fuera—, y las especies
 * ya van en la línea de los compases, con su cifrado. Los motivos del juez no
 * cuentan: llegan dichos en acordes (`enAcordes`).
 */
function acordesPorGrado(request: VersionsRequest, menu: readonly OpcionDelMenu[]): string {
  const { mode } = request.key;
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  const acordes = resolveProgression(pitchClassFromName(request.key.tonic), mode, grados);
  const nombrados = new Set<string>([
    ...request.progression.map((paso) => paso.degree),
    ...menu.flatMap(({ salida }) => [
      ...salida.secciones.flatMap((seccion) => seccion.steps.map((paso) => paso.degree)),
      ...[...salida.que.matchAll(GRADO)].map((dicho) => dicho[1]!),
    ]),
  ]);
  const tabla = grados.flatMap((grado, i) =>
    nombrados.has(grado) ? [`${grado}=${acordes[i]!.symbol}`] : [],
  );
  return `Acordes por grado: ${tabla.join(' ')}`;
}

/**
 * El estilo de la barra y el compás, si vienen: con ellos el juez ordena el menú
 * —un bVII no vale lo mismo en un rock que en un jazz—, y el modelo los necesita
 * para explicar por qué. Sin ninguno de los dos no va la línea.
 */
function lineaDeEstilo(request: VersionsRequest): string | null {
  const partes = [
    ...(request.estilo === undefined
      ? []
      : [`Estilo: ${STYLES[request.estilo].name.toLowerCase()}.`]),
    ...(request.pulsosPorCompas === undefined
      ? []
      : [`Compás de ${request.pulsosPorCompas} pulsos.`]),
  ];
  return partes.length === 0 ? null : partes.join(' ');
}

/**
 * Lo más que ocupa la línea del punteo, en caracteres.
 *
 * Treinta y dos compases con doce notas cada uno serían más de mil: lo que se
 * cuenta es lo que da para explicar —«la melodía cae en E sobre el C»—, y lo fino
 * ya lo ha mirado el juez, que lo dice en los motivos de cada salida.
 */
export const MAX_CARACTERES_DEL_PUNTEO = 160;

/**
 * Las notas fuertes del punteo, compás a compás y con su nombre en esta
 * tonalidad: `Punteo encima (notas fuertes): 1:E G | 3:C`. Sin punteo no va.
 *
 * Las fuertes y no todas, porque son las que tienen que caber en el acorde; un
 * compás sin ninguna fuerte dice las que tenga.
 */
function lineaDePunteo(request: VersionsRequest): string | null {
  const tonica = pitchClassFromName(request.key.tonic);
  const alteracion = accidentalForKey(tonica, request.key.mode);
  const compases = request.progression.flatMap((paso, i) => {
    const notas = paso.notas ?? [];
    const fuertes = notas.filter((nota) => nota.fuerte);
    const dichas = fuertes.length > 0 ? fuertes : notas;
    return dichas.length === 0
      ? []
      : [
          `${i + 1}:${dichas.map((nota) => noteName(normalizePitchClass(tonica + nota.nota), alteracion)).join(' ')}`,
        ];
  });
  if (compases.length === 0) {
    return null;
  }
  let linea = 'Punteo encima (notas fuertes):';
  for (const [i, trozo] of compases.entries()) {
    const siguiente = `${linea}${i === 0 ? ' ' : ' | '}${trozo}`;
    if (siguiente.length > MAX_CARACTERES_DEL_PUNTEO - 2) {
      return `${linea} …`;
    }
    linea = siguiente;
  }
  return linea;
}

/**
 * Qué es lo que le mandan, en una línea.
 *
 * El nombre sale de `ROLES` y no se escribe aquí: **lo que entiende quien compone y
 * lo que entiende el modelo tienen que salir del mismo sitio.** Una idea se dice
 * igual de claro que un estribillo: callarlo hacía que el modelo diera por hecho
 * que era una canción a medias.
 *
 * **El nombre y no la frase que lo explica**: «Lo que se canta a gritos…» es para
 * quien compone y no ha oído nunca «pre-estribillo»; el modelo sabe qué es un
 * estribillo, y lo que el papel cambia en las salidas ya lo dice el juez en sus
 * motivos. Eran hasta noventa caracteres en cada petición.
 */
function queEs(role: SectionRole = DEFAULT_ROLE): string {
  return `Parte: ${roleInfo(role).name.toLowerCase()}.`;
}

/** Un grado escrito: `IV`, `bVII`, `vii°`, `V/vi`. El mismo patrón que lee el validador. */
const GRADO =
  /(?<![\p{L}/#\d])(b?(?:VII|VI|IV|III|II|V|I|vii|vi|iv|iii|ii|v|i)°?(?:\/(?:ii|iii|iv|vi|V))?)(?![\p{L}\d°/])/gu;

/**
 * Un motivo del juez con los grados cambiados por sus acordes en esta tonalidad:
 * «V I: la dominante resuelve en la tónica» pasa a «G C: …».
 *
 * **Porque el modelo los copia tal cual**: medido en el corpus, 223 de 240
 * porqués eran un motivo del menú palabra por palabra, y pedirle en el prompt de
 * sistema que lo contara con acordes no cambió ni uno. Así lo que copia se lee
 * como se lee el panel, con los acordes que suenan. Los grados que no son de este
 * modo se quedan como están.
 */
export function enAcordes(texto: string, request: VersionsRequest): string {
  const { mode } = request.key;
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  const acordes = resolveProgression(pitchClassFromName(request.key.tonic), mode, grados);
  const acorde = new Map<string, string>(grados.map((grado, i) => [grado, acordes[i]!.symbol]));
  return texto.replace(GRADO, (grado: string) => acorde.get(grado) ?? grado);
}

/**
 * Lo más que ocupa el prompt de una petición, en caracteres, sin el de sistema ni
 * el esquema.
 *
 * **Es lo que hace del presupuesto de entrada un tope y no una muestra.** El
 * menú ocupa lo que deja el resto: con cuatro compases caben las salidas que se
 * enseñan —tres sin directrices, seis con ellas— con sus motivos; con treinta y
 * dos compases con especie, un punteo y las directrices enteras, se callan primero
 * los motivos y después las últimas salidas. `app/api/versiones/presupuesto.test.ts`
 * suma este número al prompt de sistema y al esquema y comprueba que sobran 120 de
 * los 1.400 tokens de `core/billing`, y que en el peor caso siguen cabiendo tres
 * salidas.
 *
 * **Era 3.190, y dejaba 3 tokens libres.** Bajó cuando la tabla de acordes pasó a
 * llevar solo los grados que salen y el papel solo su nombre: el peor resto pasó
 * de 1.848 caracteres a 1.510, y con 2.950 el peor menú tiene más sitio que antes
 * (1.440 contra 1.342). Lo que bajó del resto es lo que sobra ahora del
 * presupuesto, junto con lo que se quitó del prompt de sistema.
 */
export const MAX_CARACTERES_DEL_PROMPT = 2950;

/** El prompt en sus tres trozos: lo que va antes del menú, el menú y lo que va después. */
interface Partes {
  readonly antes: readonly string[];
  readonly menu: readonly OpcionDelMenu[];
  readonly despues: readonly string[];
}

/**
 * El prompt entero, con el menú en el sitio que deja el resto.
 *
 * **El menú se construye una vez**: la tabla de acordes necesita saber qué grados
 * salen en él, y el sitio que le queda depende de la tabla. No es un círculo,
 * porque la tabla mira el menú entero (`menuDe`) y el sitio solo decide cuánto se
 * enseña de él.
 */
function partes(
  request: VersionsRequest,
  cabecera: readonly string[],
  clave?: () => string,
): Partes {
  const entero = menuDe(request, (motivo, s) => seSostiene(enAcordes(motivo, request), s, request));
  const estilo = lineaDeEstilo(request);
  const punteo = lineaDePunteo(request);
  const antes = [
    ...cabecera,
    ...(estilo === null ? [] : [estilo]),
    acordesPorGrado(request, entero),
    lineaDeCompases(request),
    ...(punteo === null ? [] : [punteo]),
    queEs(request.role),
    // **Que sepa que van ordenadas**: sin decirlo, el orden del menú es una lista
    // más, y con directrices delante el modelo tiraba de las de abajo sin motivo.
    // Sin directrices son las tres mejores y no hay nada que elegir (`soloExplica`).
    `${request.kind === 'continuar' ? 'Quiere seguir su canción.' : 'Quiere retocar estos compases sin salir de ellos.'} ${soloExplica(request) ? 'Las salidas que mejor encajan:' : 'Salidas, de más a menos encaje:'}`,
  ];
  const despues = [
    soloExplica(request)
      ? 'Cuéntalas todas, cada una una vez y en el orden que mejor las explique, con su porqué.'
      : 'Elige hasta tres distintas, las que vayan hacia lo que pide, y cuenta su porqué.',
    // **Tus directrices, marcadas y al final.** Es el segundo texto libre que
    // entra al modelo —el otro es la pregunta del profesor— y va igual:
    // delimitado, con el prompt de sistema diciendo que lo de dentro es un dato, y
    // con una marca de clave nueva que nadie puede escribir para cerrar el bloque
    // antes de tiempo (adr/0115). Al final a propósito: es lo último que lee, y
    // tiene que pesar al elegir.
    ...(request.directrices === undefined
      ? []
      : [directricesEntreMarcas(request.directrices, clave)]),
  ];
  return {
    antes,
    menu: enSuSitio(request, entero, [...antes, ...despues], loQuePesanDeMas(request)),
    despues,
  };
}

/**
 * Lo que se enseña del menú: **un principio del de `salidasDe`**, con los números
 * de siempre, en el sitio que deja el resto del prompt.
 *
 * Lo que no cabe se quita por el final: primero el segundo motivo de cada salida,
 * luego el primero y luego la salida entera. Así el número que contesta el modelo
 * es el mismo en el menú entero, y el esquema, que se hace con estas, no le deja
 * elegir una que no ha visto (`app/api/versiones/salidas.ts`).
 *
 * Con los motivos del juez que pasan el validador: los que no, el modelo los
 * copiaría y se taparían.
 */
function enSuSitio(
  request: VersionsRequest,
  entero: readonly OpcionDelMenu[],
  fijas: readonly string[],
  deMas: number,
): OpcionDelMenu[] {
  // Cada línea con su salto, y lo que pesan tus directrices por encima de lo que miden.
  const fijo = fijas.join('\n').length + 1 + deMas;
  let queda = Math.min(MAX_CARACTERES_DEL_MENU, MAX_CARACTERES_DEL_PROMPT - fijo);
  const caben: OpcionDelMenu[] = [];
  for (const { salida, motivos: enGrados } of entero) {
    const motivos = enGrados.map((motivo) => enAcordes(motivo, request));
    const numero = caben.length + 1;
    const cuantos = [2, 1, 0].find(
      (n) => lineaDeSalida(salida, numero, motivos.slice(0, n)).length + 1 <= queda,
    );
    if (cuantos === undefined) {
      break;
    }
    const linea = { salida, motivos: motivos.slice(0, cuantos) };
    queda -= lineaDeSalida(salida, numero, linea.motivos).length + 1;
    caben.push(linea);
  }
  return caben;
}

/**
 * Los caracteres que tus directrices pesan **de más** sobre los que miden.
 *
 * El tope del prompt está en caracteres y se cuenta a 3,2 por token, que es lo que
 * pesa el español. Unas directrices en chino miden 25 caracteres y cuestan como 240
 * letras (`tokensEnElPeorCaso`): contadas por lo que miden, el menú se comía los
 * 215 que parecían sobrar y el prompt se pasaba del presupuesto en 67 tokens
 * (adr/0115). Así ocupan en el tope lo que cuestan.
 */
function loQuePesanDeMas(request: VersionsRequest): number {
  const directrices = request.directrices;
  if (directrices === undefined) {
    return 0;
  }
  return Math.max(
    0,
    // Con una milésima menos: sumar tercios en coma flotante no da exacto.
    Math.ceil(tokensEnElPeorCaso(directrices) * CARACTERES_POR_TOKEN - 1e-9) - directrices.length,
  );
}

/**
 * El menú tal y como se le enseña al modelo: lo que cabe del de `salidasDe`, con
 * sus motivos en acordes (`enSuSitio`).
 */
export function menuDelPrompt(
  request: VersionsRequest,
  cabecera: readonly string[],
): OpcionDelMenu[] {
  return [...partes(request, cabecera).menu];
}

/**
 * **Se exporta para el banco de pruebas**, que mide si lo que devuelve el modelo
 * sirve para componer. Un banco con su propio prompt mediría otro programa.
 */
export function promptDeSalidas(
  request: VersionsRequest,
  /**
   * La línea de la tonalidad, que arma `server/prompts.ts`.
   *
   * Entra por la puerta en vez de importarse: `features/` no puede abrir
   * `server/`, y la alternativa era copiarla aquí.
   */
  cabecera: readonly string[],
  /** De dónde sale la clave de la marca de tus directrices: al azar, salvo en las pruebas. */
  clave?: () => string,
): string {
  const { antes, menu, despues } = partes(request, cabecera, clave);
  return [
    ...antes,
    ...menu.map(({ salida, motivos }, i) => lineaDeSalida(salida, i + 1, motivos)),
    ...despues,
  ].join('\n');
}
