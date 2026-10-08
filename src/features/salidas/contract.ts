/**
 * Contrato de la ruta de las salidas: qué entra, qué sale y cómo se valida.
 *
 * Vive aquí y no dentro de `app/` porque lo usan los dos lados —el servidor para
 * validar y el cliente para pedir y entender— y es TypeScript puro, así que se
 * prueba sin levantar nada. Es la misma forma que tiene `learn/teacher-contract.ts`.
 *
 * **Las salidas las construye el dominio y el modelo elige.** El menú sale de
 * `salidasPosibles`, válido por construcción, y lo que vuelve del modelo es un
 * número, un título y un porqué. Lo que se comprueba aquí es lo que pone él: que
 * el número exista y que **la prosa no mienta** —`loQueNoEsta`—, porque el porqué
 * es la mitad de lo que se está vendiendo y uno falso enseña algo falso.
 *
 * Nada de audio. Lo que viaja son grados, un número de pulsos y una
 * tonalidad, y con ellos **el contexto** —la especie de cada compás, si se oyó con
 * duda, las notas del punteo que suenan encima, el estilo y el compás—: símbolos
 * todos, enumerados y números, nunca texto libre (adr/0015).
 */

import { aiError, type AiError, type AiErrorCode } from '@core/ai-errors';
// Los topes de tamaño de esta petición viven en `core/billing/cost.ts`: son palancas
// de gasto antes que reglas del contrato, porque cada grado y cada salida son tokens.
import { MAX_DIRECTRICES_LENGTH, MAX_SALIDAS, MAX_SALIDAS_DEGREES } from '@core/billing';
import { entreMarcas, textoLibre } from '@core/marca';
import {
  BEATS_PER_BAR,
  blockChord,
  cuerpoConTonalidad,
  DEFAULT_ROLE,
  degreesFor,
  esEspecieDeBloque,
  formaDeBlues,
  gruposPorPulsos,
  hablaDeUnSitio,
  isSectionRole,
  loQueNoEsVerdad,
  pitchClassFromName,
  porQueNoHaySalidas,
  resolveProgression,
  roleOfDegreeSymbol,
  salidasPosibles,
  SIN_SALIDA,
  STYLE_IDS,
  writtenBlock,
  type DegreeSymbol,
  type EspecieDeBloque,
  type KeyMode,
  type MoveId,
  type NotaDelCompas,
  type PathId,
  type PitchClass,
  type SalidaPosible,
  type StyleId,
} from '@core/music';
import { isRecord } from '@core/parse';
import { copiaLasInstrucciones, esUnCebo } from '@core/prosa-del-modelo';

import { contextoDe, salidasDe } from './menu';
import { MAX_NOTAS_POR_COMPAS, type SalidasRequest, type SalidaStep } from './peticion';

/**
 * La palabra de la marca que delimita tus directrices dentro del prompt.
 *
 * Mismo mecanismo que la pregunta del profesor —`PALABRA_PREGUNTA`— y por la misma
 * razón: lo de dentro lo escribes tú, así que el prompt de sistema dice que es un
 * dato y nunca una instrucción. No es una defensa perfecta, ninguna lo es contra
 * una inyección decidida, pero convierte el «ignora lo anterior» en una frase más
 * dentro de un bloque marcado.
 *
 * **La marca lleva una clave nueva en cada petición** (`directricesEntreMarcas`), y
 * solo la cierra la misma marca con la misma clave, que no ves (adr/0115). Y
 * `parseSalidasRequest` borra de lo que escribas todo lo que se le parezca,
 * escrito como se escriba (`core/marca.ts`).
 */
export const PALABRA_DIRECTRICES = 'DIRECTRICES';

/** Tus directrices entre sus dos marcas, con una clave nueva (`core/marca.ts`). */
export function directricesEntreMarcas(directrices: string, clave?: () => string): string {
  return entreMarcas(directrices, PALABRA_DIRECTRICES, clave);
}

/**
 * Lo más largos que pueden ser el título y el porqué de una salida.
 *
 * **Son la única prosa del modelo que llega a la pantalla** —los acordes se
 * recalculan contra el dominio, el texto no— y no tenían tope ninguno: ni en el
 * esquema ni al validar, solo «que no esté vacío». Con las directrices abiertas
 * eso pasó a ser lo que una inyección podría usar para escribirte algo, así que se
 * cierra por construcción y no confiando en que el prompt se respete. El prompt ya
 * pide menos de sesenta caracteres de título y una sola frase: esto es lo mismo,
 * pero comprobado.
 */
export const MAX_SALIDA_TITLE_LENGTH = 60;

/** Lo más largo que puede ser el porqué de una salida. Una frase. */
export const MAX_SALIDA_WHY_LENGTH = 200;

/** Un compás de una salida: qué grado va ahora y de dónde sale. */
export interface SalidaStepOut {
  readonly degree: DegreeSymbol;
  /**
   * La especie con la que suena. Ausente es la tríada del grado.
   *
   * Lo tuyo que no cambia de grado vuelve con la suya: un `G7` que se queda no
   * vuelve como `G`, y quedarse con la salida no le quita la séptima.
   */
  readonly especie?: EspecieDeBloque;
  readonly beats: number;
  /** El cifrado, con su especie, **recalculado** aquí y no creído al modelo. */
  readonly symbol: string;
  /**
   * El cifrado que había en ese compás, si es tuyo.
   *
   * Hace falta además de `from` porque **un compás puede cambiar sin cambiar de
   * grado**: el `I` que pasa a `Imaj7` sigue siendo el `I`, y sin esto la pantalla
   * lo daba por igual.
   */
  readonly fromSymbol?: string;
  /**
   * Lo que duraba ese compás, si es tuyo.
   *
   * Por lo mismo que `fromSymbol`: **un compás puede cambiar sin cambiar de grado ni
   * de especie**. El V de un ii–V partido es el mismo V con la mitad de pulsos, y sin
   * esto la pantalla decía que se quedaba como estaba.
   */
  readonly fromBeats?: number;
  /**
   * El grado que había en ese compás, o **nulo si el compás es nuevo**.
   *
   * El nulo es lo que la pantalla usa para separar lo que tocaste de lo que se
   * te propone, que en una salida que alarga es la mitad de la información.
   */
  readonly from: DegreeSymbol | null;
  /** Qué movimiento se ha aplicado. Solo lo llevan las rearmonizaciones. */
  readonly move: MoveId | null;
}

/** Una parte de la canción propuesta: cómo se llama y qué suena en ella. */
export interface SalidaSection {
  readonly name: string;
  /** Si es, tal cual, lo que tocaste. */
  readonly yours: boolean;
  readonly steps: readonly SalidaStepOut[];
}

export interface SalidaPropuesta {
  readonly title: string;
  readonly why: string;
  /** Cuál de las cinco salidas ha tomado. Comprobado contra el dominio. */
  readonly path: PathId;
  /**
   * La canción por partes.
   *
   * Las dos salidas que continúan lo que llevas —`seguir` y `contraste`— traen
   * varias: la yours primero y lo que sigue después, con su nombre. Las tres que
   * retocan tus compases traen una sola, porque no hay canción que montar.
   */
  readonly sections: readonly SalidaSection[];
  /** Todas las partes seguidas, que es lo que se toca y lo que se guarda. */
  readonly steps: readonly SalidaStepOut[];
}

/**
 * Los siete códigos, compartidos con las otras dos rutas de IA.
 *
 * Alias y no una copia: estaban declarados tres veces idénticos, y el día que
 * haga falta uno nuevo se añade en `core/ai-errors.ts` y lo tienen las tres.
 */
export type SalidasErrorCode = AiErrorCode;

export type SalidasError = AiError;

export const ERROR_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
  invalid_request:
    'Nos falta la progresión. Toca unos compases o abre una canción guardada y vuelve a pedirlo.',
  rate_limited: 'Has pedido muchas salidas seguidas. Espera un momento y vuelve a intentarlo.',
  model_unavailable: 'No hemos podido contactar con el modelo. Vuelve a intentarlo en un minuto.',
  // Esta frase dice algo concreto a propósito: cuando el modelo devuelve
  // salidas que no se sostienen, lo que ha pasado es que se han caído todas al
  // comprobarlas, y «no ha venido bien formada» no lo cuenta.
  unparseable_response:
    'Las salidas que han llegado no se sostienen con lo que estás tocando. Vuelve a pedirlo.',
  account_required:
    'Entra con tu cuenta para pedir salidas. La IA se cuenta por cuenta, no por navegador.',
  plan_required: 'Las salidas de tus canciones no entran en tu plan.',
  quota_exhausted:
    'Se te han acabado las peticiones de hoy. Mañana se renuevan, o puedes subir de plan.',
};

export function salidasError(code: SalidasErrorCode, message?: string): SalidasError {
  return aiError(code, ERROR_MESSAGES, message);
}

/** Pulsos: entero, al menos uno y con un tope, porque también son tokens. */
function asBeats(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(16, Math.max(1, Math.round(value)));
}

/**
 * Valida el cuerpo de la petición.
 *
 * Nada se reenvía tal cual: la petición se reconstruye desde los campos que
 * pasan y todo lo demás se ignora, igual que en el profesor.
 */
/**
 * Tus directrices, acotadas: sin la marca, sin espacios de sobra y con su tope.
 *
 * Devuelve nulo cuando no hay nada que mandar, que es el caso normal: el campo se
 * omite en vez de viajar vacío.
 */
function leerDirectrices(crudo: unknown): string | null {
  if (typeof crudo !== 'string') {
    return null;
  }
  // Recortadas antes de limpiarlas, sin nada con forma de marca y con su tope en
  // el peor alfabeto: lo mismo que la pregunta del profesor, y por lo mismo
  // (`core/marca.ts`, adr/0115).
  const limpias = textoLibre(crudo, PALABRA_DIRECTRICES, MAX_DIRECTRICES_LENGTH);
  return limpias === '' ? null : limpias;
}

/** Lo que sale de leer el cuerpo: la petición, o nulo y, si lo hay, por qué. */
type Leido =
  | { readonly peticion: SalidasRequest }
  | { readonly peticion: null; readonly motivo: string | null };

const NO_VALE: Leido = { peticion: null, motivo: null };

export function parseSalidasRequest(body: unknown): SalidasRequest | null {
  return leerPeticion(body).peticion;
}

/**
 * Por qué no vale un cuerpo, cuando hay algo más concreto que «nos falta la
 * progresión»: que no haya ninguna salida, dicho por el dominio. Nulo si no lo
 * hay, o si vale. La ruta lo contesta con `invalid_request`, que es el código que
 * ya mira la pantalla, y la frase es esta.
 */
export function porQueNoValeLaPeticion(body: unknown): string | null {
  const leido = leerPeticion(body);
  return leido.peticion === null ? leido.motivo : null;
}

function leerPeticion(body: unknown): Leido {
  const leido = cuerpoConTonalidad(body);
  if (leido === null) {
    return NO_VALE;
  }
  const { campos, tonic, mode } = leido;

  const raw = campos['progression'];
  if (!Array.isArray(raw)) {
    return NO_VALE;
  }
  const validDegrees = degreesFor(mode) as readonly string[];

  const progression: SalidaStep[] = [];
  for (const step of raw.slice(0, MAX_SALIDAS_DEGREES)) {
    if (!isRecord(step)) {
      continue;
    }
    const degree = step['degree'];
    if (typeof degree !== 'string' || !validDegrees.includes(degree)) {
      continue;
    }
    const especie = step['especie'];
    const notas = leerNotas(step['notas']);
    progression.push({
      degree: degree as DegreeSymbol,
      beats: asBeats(step['beats']),
      // Solo se apunta lo que hay que decir: la ausencia de la marca es «esto lo
      // escribió una persona», que es el caso normal.
      ...(step['heard'] === true ? { heard: true } : {}),
      ...(esEspecieDeBloque(especie) ? { especie } : {}),
      ...(notas.length > 0 ? { notas } : {}),
    });
  }

  // **Un acorde ya es una canción**: se puede seguir —cerrarlo, llevarlo a otra
  // parte— y se puede retocar partiéndolo por sus compases o por su mitad. El
  // dominio da salidas para él, y aquí se rechazaba con «nos falta la progresión».
  // Sin ninguno sí falta.
  if (progression.length === 0) {
    return NO_VALE;
  }

  // Sin clase no hay petición: es lo que decide qué esquema se le manda.
  const kind = campos['kind'];
  if (kind !== 'continuar' && kind !== 'retocar') {
    return NO_VALE;
  }

  // Un papel que no se reconoce se lee como idea, que es lo que era antes de que
  // existiera este campo: una petición vieja o de otra versión sigue valiendo.
  const crudo = campos['role'];
  const role = isSectionRole(crudo) ? crudo : DEFAULT_ROLE;

  const request: {
    -readonly [K in keyof SalidasRequest]: SalidasRequest[K];
  } = { key: { tonic, mode }, progression, kind, role };

  // El contexto que vale para toda la canción. Lo que no se reconoce no viaja, y
  // la salida se juzga sin ello en vez de con algo inventado.
  const estilo = campos['estilo'];
  if ((STYLE_IDS as readonly unknown[]).includes(estilo)) {
    request.estilo = estilo as StyleId;
  }
  const pulsos = campos['pulsosPorCompas'];
  if (BEATS_PER_BAR.includes(pulsos as number)) {
    request.pulsosPorCompas = pulsos as number;
  }

  const directrices = leerDirectrices(campos['directrices']);
  if (directrices !== null) {
    request.directrices = directrices;
  }

  // Sin ninguna salida posible no hay nada que pedir, y el modelo solo podría elegir
  // entre nada. **Y se dice por qué, con las palabras del dominio**
  // (`porQueNoHaySalidas`): la canción llena el tope, con un acorde más no se llega
  // a casa, o todo lo que se construye lo descarta el juez, y lo dice. Antes era una
  // frase fija sobre el sitio que no explicaba el tercer caso.
  //
  // **Con el contexto**, y va después de leerlo a propósito: es el mismo menú que se
  // construirá al escribir el prompt y al validar, y si aquí se mirara otro, se
  // podría aceptar una petición sin nada que ofrecer.
  const contexto = contextoDe(request);
  if (salidasPosibles(mode, kind, progression, contexto).length === 0) {
    /* v8 ignore next -- nulo solo si hay salidas, y aquí no las hay: el `SIN_SALIDA` no se ve nunca */
    const motivo = porQueNoHaySalidas(mode, kind, progression, contexto) ?? SIN_SALIDA;
    return { peticion: null, motivo };
  }

  return { peticion: request };
}

/**
 * Las notas del punteo de un compás, validadas una a una.
 *
 * Cada una es una altura de 0 a 11 sobre la tónica y si cae en pulso fuerte; lo
 * que no sea eso se cae sin tumbar el compás. Una altura repetida se junta en una,
 * fuerte si lo era alguna de las dos, y por eso no pasan nunca de doce.
 */
function leerNotas(crudas: unknown): NotaDelCompas[] {
  if (!Array.isArray(crudas)) {
    return [];
  }
  const notas: NotaDelCompas[] = [];
  for (const cruda of crudas) {
    if (!isRecord(cruda)) {
      continue;
    }
    const nota = cruda['nota'];
    if (typeof nota !== 'number' || !Number.isInteger(nota) || nota < 0 || nota > 11) {
      continue;
    }
    // Como `heard`: solo un `true` de verdad marca el pulso fuerte.
    const fuerte = cruda['fuerte'] === true;
    const ya = notas.findIndex((otra) => otra.nota === nota);
    if (ya === -1) {
      notas.push({ nota, fuerte });
    } else if (fuerte) {
      notas[ya] = { nota, fuerte };
    }
  }
  return notas.slice(0, MAX_NOTAS_POR_COMPAS);
}

/**
 * Lo que dicen el título y el porqué que la salida no tiene, o nulo si no dicen
 * nada falso.
 *
 * **Son la única prosa del modelo que llega a la pantalla**, y los acordes de al
 * lado están comprobados: un porqué que habla de un Fm que no suena, o de una
 * sustitución tritonal donde no la hay, enseña algo falso con la autoridad de lo
 * que sí se comprobó (adr/0011). Medido con `qwen3:8b`, el caso más común era
 * otro: «una cadencia que promete la tónica pero no la alcanza» sobre un cierre
 * que acaba en ella.
 *
 * Lee lo que se puede leer sin entender la frase —acordes escritos, grados,
 * nombres de movimiento y si dice que cierra— y **prefiere aceptar de menos a
 * rechazar de más**, como el del profesor: la tonalidad escrita («C mayor») no es
 * un acorde, la «A» delante de una palabra es la preposición, y lo que había en
 * tu canción se puede nombrar aunque la salida lo haya cambiado.
 */
export function loQueNoEsta(
  texto: string,
  propuesta: SalidaPropuesta,
  request: SalidasRequest,
): string | null {
  const { mode } = request.key;
  const tonica = pitchClassFromName(request.key.tonic);
  // Lo tuyo también se puede nombrar: «el IV pasa a iv» dice lo que había, y es
  // verdad aunque el IV ya no suene.
  const tuyos = request.progression.map((paso) => paso.degree);
  // Cada acorde con su especie y como tríada: un `G7` es también un `G`, y decir
  // «el G» de un compás que suena `G7` es verdad.
  const simbolos = new Set([
    ...propuesta.steps.map((paso) => paso.symbol),
    ...request.progression.map((paso) => cifrado(tonica, mode, paso.degree, paso.especie)),
    ...resolveProgression(tonica, mode, [
      ...propuesta.steps.map((paso) => paso.degree),
      ...tuyos,
    ]).map((c) => c.symbol),
  ]);
  const grados = new Set<string>([...propuesta.steps.map((paso) => paso.degree), ...tuyos]);
  // Los nombres de músico de las secundarias que suenan: el II7 del country es el
  // V/V, y nombrarlo así es verdad (`gradoDicho`, la misma tabla).
  for (const [secundaria, alias] of ALIAS_DE_SECUNDARIAS[mode]) {
    if (grados.has(secundaria)) {
      grados.add(alias);
    }
  }

  for (const encontrado of texto.matchAll(ACORDE_ESCRITO)) {
    const simbolo = encontrado[1]!;
    const despues = texto.slice(encontrado.index + simbolo.length);
    const esLaTonalidad = /^\s+(mayor|menor)/u.test(despues);
    // «A medio tiempo», «A la vuelta»: una «A» seguida de una palabra en minúscula
    // es la preposición. Un acorde de La así escrito se deja pasar, que es aceptar
    // de menos.
    const esLaPreposicion = simbolo === 'A' && /^\s+\p{Ll}/u.test(despues);
    // Con séptima es el mismo acorde: un G7 vale donde suena un G. Y escrito
    // entero también, que un `Cmaj7` sin su 7 no es ningún cifrado.
    if (
      !esLaTonalidad &&
      !esLaPreposicion &&
      !simbolos.has(simbolo) &&
      !simbolos.has(simbolo.replace(/7$/u, ''))
    ) {
      return `nombra ${simbolo}`;
    }
  }
  for (const encontrado of texto.matchAll(GRADO_ESCRITO)) {
    // «Sustituto tritonal del V»: el V es lo que se sustituye, y por eso no suena.
    // Que haya de verdad un sustituto lo mira la palabra, en los movimientos.
    const loSustituido = /tritonal del?\s+$/u.test(texto.slice(0, encontrado.index));
    if (!loSustituido && !grados.has(encontrado[1]!)) {
      return `nombra el grado ${encontrado[1]!}`;
    }
  }

  // **Cada frase, en el sitio que nombra** (`loQueNoEsVerdad`): el compás N en el
  // compás N, el enlace donde dice, el papel y la forma de los que habla. Con los
  // acordes vueltos a sus grados, que es lo que se lee allí.
  const enGrados = aGrados(texto, propuesta, request);
  const contexto = contextoDe(request);
  const falso = loQueNoEsVerdad(enGrados, {
    mode,
    kind: request.kind,
    pulsosPorCompas: contexto.pulsosPorCompas ?? 4,
    tuyos: request.progression,
    cancion: propuesta.steps,
    // El papel viaja siempre: el de la petición, o el de una idea (`contextoDe`).
    papel: request.role ?? DEFAULT_ROLE,
    ...(contexto.dudosos === undefined ? {} : { dudosos: contexto.dudosos }),
    ...(contexto.estilo === undefined ? {} : { estilo: contexto.estilo }),
    ...(request.kind === 'continuar'
      ? {
          partesNuevas: propuesta.sections
            .filter((seccion) => !seccion.yours)
            .map((seccion) => seccion.name),
        }
      : {}),
  });
  if (falso !== null) {
    return falso;
  }

  const llano = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const movimientos = new Set(propuesta.steps.map((paso) => paso.move));
  for (const { patron, valen, tambien } of MOVIMIENTOS_ESCRITOS) {
    if (
      patron.test(llano) &&
      !valen.some((move) => movimientos.has(move)) &&
      !tambien(propuesta.steps, mode, tonica)
    ) {
      return `habla de ${valen[0]!} y no lo hay`;
    }
  }

  // Si cierra o no, de la canción entera: lo que habla de un enlace o de un compás
  // ya se ha comprobado allí, y su «resuelve en la tónica» es de ese sitio.
  if (hablaDeUnSitio(enGrados, mode)) {
    return null;
  }
  const cierra =
    propuesta.steps[propuesta.steps.length - 1]!.degree === (mode === 'major' ? 'I' : 'i');
  if (cierra && NIEGA_EL_CIERRE.test(llano)) {
    return 'dice que no cierra, y cierra';
  }
  if (!cierra && AFIRMA_EL_CIERRE.test(llano)) {
    return 'dice que cierra, y no cierra';
  }
  return null;
}

/**
 * Las secundarias con su nombre de músico: el II7 es el V/V. En mayor también el
 * III, el VI y el VII, que como grados en mayúscula no existen; en menor esos son
 * los suyos. La misma tabla que `gradoDicho` en `core/music/salidas/lo-que-dice.ts`.
 */
const ALIAS_DE_SECUNDARIAS: Readonly<Record<KeyMode, readonly (readonly [string, string])[]>> = {
  major: [
    ['V/V', 'II'],
    ['V/vi', 'III'],
    ['V/ii', 'VI'],
    ['V/iii', 'VII'],
  ],
  minor: [['V/V', 'II']],
};

/**
 * El texto con cada acorde escrito cambiado por su grado: `G7 C` vuelve a ser `V7
 * I`, que es como lo lee `loQueNoEsVerdad`. Un cifrado que no suena en la canción se
 * queda como está —ya lo ha cazado `nombra X`—, y la «A» de «A medio tiempo» y la
 * tonalidad escrita no son acordes.
 */
function aGrados(texto: string, propuesta: SalidaPropuesta, request: SalidasRequest): string {
  const { mode } = request.key;
  const tonica = pitchClassFromName(request.key.tonic);
  const grado = new Map<string, DegreeSymbol>();
  const anota = (degree: DegreeSymbol, especie: EspecieDeBloque | undefined) => {
    const conEspecie = cifrado(tonica, mode, degree, especie);
    const triada = cifrado(tonica, mode, degree, undefined);
    for (const simbolo of [conEspecie, triada]) {
      if (!grado.has(simbolo)) {
        grado.set(simbolo, degree);
      }
    }
  };
  propuesta.steps.forEach((paso) => anota(paso.degree, paso.especie));
  request.progression.forEach((paso) => anota(paso.degree, paso.especie));
  return texto.replace(ACORDE_ESCRITO, (simbolo: string, _: string, donde: number) => {
    const despues = texto.slice(donde + simbolo.length);
    const noEsUnAcorde =
      /^\s+(mayor|menor)/u.test(despues) ||
      (simbolo === 'A' &&
        /^\s+\p{Ll}/u.test(despues) &&
        // «El A del 1» es el acorde: detrás de un artículo no hay preposición.
        !/\b(?:el|del|al|tu|su|de|por|y|en)\s+$/iu.test(texto.slice(0, donde)));
    const suyo = grado.get(simbolo) ?? grado.get(simbolo.replace(/7$/u, ''));
    return noEsUnAcorde || suyo === undefined
      ? simbolo
      : `${suyo}${simbolo.endsWith('7') && !simbolo.endsWith('maj7') ? '7' : ''}`;
  });
}

/** Un acorde escrito: `C`, `F#m`, `Bb`, `Bdim`, `G7`. Solo en mayúscula. */
const ACORDE_ESCRITO =
  /(?<![\p{L}#\d/])([A-G](?:#|b)?(?:maj7|m7|m|dim|aug|sus2|sus4|7|5)?)(?![\p{L}#\d])/gu;

/** Un grado escrito: `IV`, `bVII`, `vii°`, `V/vi`. */
const GRADO_ESCRITO =
  /(?<![\p{L}/#\d])(b?(?:VII|VI|IV|III|II|V|I|vii|vi|iv|iii|ii|v|i)°?(?:\/(?:ii|iii|iv|vi|V))?)(?![\p{L}\d°/])/gu;

/** Las notas de un compás de la salida, con su especie, en semitonos sobre la tónica. */
function notasDe(paso: SalidaStepOut, mode: KeyMode, tonica: PitchClass): Set<number> {
  const acorde = blockChord(tonica, mode, writtenBlock('', paso.degree, 1, paso.especie));
  return new Set(acorde.notes.map((nota) => (nota - tonica + 12) % 12));
}

/** La fundamental de un grado, en semitonos sobre la tónica. */
function fundamental(degree: DegreeSymbol, mode: KeyMode, tonica: PitchClass): number {
  return (blockChord(tonica, mode, writtenBlock('', degree, 1)).root - tonica + 12) % 12;
}

/** Las escalas de los dos modos, en semitonos sobre la tónica. */
const DEL_MAYOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const DEL_MENOR = new Set([0, 2, 3, 5, 7, 8, 10]);
/** Lo propio del menor lleva también la sensible: el V mayor de una cadencia no es prestado. */
const PROPIO_DEL_MENOR = new Set([...DEL_MENOR, 11]);

/**
 * Si el acorde de ese compás es prestado del modo paralelo: **todas sus notas** son
 * del otro modo y alguna no es del suyo. Un bVII o un iv en mayor lo son; un V/vi
 * no, porque su sensible no es de ninguno de los dos.
 */
function esPrestado(paso: SalidaStepOut, mode: KeyMode, tonica: PitchClass): boolean {
  const propias = mode === 'major' ? DEL_MAYOR : PROPIO_DEL_MENOR;
  const ajenas = mode === 'major' ? DEL_MENOR : DEL_MAYOR;
  const notas = [...notasDe(paso, mode, tonica)];
  return notas.some((nota) => !propias.has(nota)) && notas.every((nota) => ajenas.has(nota));
}

/**
 * Si ese compás es un sustituto tritonal del siguiente: un acorde mayor o de
 * séptima de dominante **medio tono por encima** de adonde va —el bII7 que va al I—.
 *
 * Y con algo que lo distinga de un acorde de la tonalidad que baja medio tono por
 * casualidad: la séptima de dominante, o una fundamental de fuera de la escala. El
 * IV que va al iii no es ningún sustituto.
 */
function esTritonal(
  pasos: readonly SalidaStepOut[],
  i: number,
  mode: KeyMode,
  tonica: PitchClass,
): boolean {
  const siguiente = pasos[i + 1];
  if (siguiente === undefined) {
    return false;
  }
  const paso = pasos[i]!;
  const raiz = fundamental(paso.degree, mode, tonica);
  const notas = notasDe(paso, mode, tonica);
  const escala = mode === 'major' ? DEL_MAYOR : PROPIO_DEL_MENOR;
  return (
    raiz === (fundamental(siguiente.degree, mode, tonica) + 1) % 12 &&
    notas.has((raiz + 4) % 12) &&
    !notas.has((raiz + 11) % 12) &&
    (paso.especie === 'dominant7' || !escala.has(raiz))
  );
}

/**
 * Si en el compás `i` empieza un coro de blues con el cambio rápido: la tónica, el
 * cuarto grado en su compás 2 y la tónica otra vez, los dos primeros del mismo
 * largo, y detrás la forma del blues (`formaDeBlues`, la misma vara que el juez y
 * que quien construye los coros).
 *
 * **En cualquier coro, no solo al principio de la salida.** Se miraban los tres
 * primeros compases, y al continuar un blues el cambio rápido va en el compás 2 del
 * coro **nuevo** (`coros`, en `core/music/salidas/coros.ts`): «Otro coro con cambio rápido» y su frase
 * se daban por mentira, con el cambio ahí. Y con la forma, porque el cambio rápido
 * solo existe en el 2 de un blues: `I IV I V` en cuatro compases no lo lleva.
 */
function empiezaConCambioRapido(
  pasos: readonly SalidaStepOut[],
  i: number,
  mode: KeyMode,
): boolean {
  const tonica = mode === 'major' ? 'I' : 'i';
  const cuarto = mode === 'major' ? 'IV' : 'iv';
  const [uno, dos, tres] = pasos.slice(i, i + 3);
  return (
    tres !== undefined &&
    uno!.degree === tonica &&
    dos!.degree === cuarto &&
    tres.degree === tonica &&
    uno!.beats === dos!.beats &&
    formaDeBlues(mode, (compas) => pasos[i + compas]?.degree)
  );
}

/**
 * Cómo se nombra cada movimiento, cuáles valen para que nombrarlo sea verdad, y
 * qué más lo hace verdad sin el movimiento.
 *
 * **Lo que mira es lo que suena, no solo lo que se declaró.** El generador construye
 * grados prestados, dominantes secundarias y sustitutos tritonales sin pasar por un
 * movimiento de `core/music/salidas/movimientos.ts`, y con el movimiento como única prueba
 * «prestado del menor» sobre un bVII se daba por mentira (lo midió el examen contra
 * `qwen3:8b`). Así que cada palabra vale también si el acorde **es** eso en la
 * canción: un grado prestado, un V/x, un bII7 que va al I, un grado que cambia de
 * tercera sobre la misma fundamental.
 *
 * Y la teoría suelta, como antes: **el relativo** de la tónica —el vi, o el III en
 * menor— se puede nombrar si suena, y **la cadencia rota** es un V que va al vi —al
 * VI en menor—, se haya llegado ahí por el movimiento o por un final nuevo.
 */
const MOVIMIENTOS_ESCRITOS: readonly {
  readonly patron: RegExp;
  readonly valen: readonly MoveId[];
  readonly tambien: (pasos: readonly SalidaStepOut[], mode: KeyMode, tonica: PitchClass) => boolean;
}[] = [
  {
    patron: /relativ/u,
    valen: ['relativo', 'interrumpida'],
    tambien: (pasos, mode) =>
      pasos.some((paso) => paso.degree === (mode === 'major' ? 'vi' : 'III')),
  },
  {
    patron: /triton/u,
    valen: ['tritono'],
    tambien: (pasos, mode, tonica) => pasos.some((_, i) => esTritonal(pasos, i, mode, tonica)),
  },
  {
    patron: /prestad|prestamo|modo paralelo/u,
    valen: ['prestamo'],
    tambien: (pasos, mode, tonica) => pasos.some((paso) => esPrestado(paso, mode, tonica)),
  },
  {
    patron: /secundari/u,
    valen: ['dominante'],
    tambien: (pasos) => pasos.some((paso) => paso.degree.includes('/')),
  },
  {
    patron: /interrumpid|cadencia rota|deceptiv/u,
    valen: ['interrumpida'],
    tambien: (pasos, mode) =>
      pasos.some(
        (paso, i) =>
          i > 0 && pasos[i - 1]!.degree === 'V' && paso.degree === (mode === 'major' ? 'vi' : 'VI'),
      ),
  },
  {
    // «Misma función»: otro acorde a una tercera que hace el mismo papel —el iv
    // por el ii° en menor, el vii° por el V—. Vale si algo tuyo cambió de grado
    // sin cambiar de papel, lo haya hecho el movimiento o el generador.
    patron: /misma funci/u,
    valen: ['funcion'],
    tambien: (pasos) =>
      pasos.some(
        (paso) =>
          paso.from !== null &&
          paso.from !== paso.degree &&
          roleOfDegreeSymbol(paso.from) === roleOfDegreeSymbol(paso.degree),
      ),
  },
  {
    patron: /mayor por menor|menor por mayor|intercambi/u,
    valen: ['intercambio'],
    // Lo tuyo que cambia de tercera sin mover la fundamental, lo haya hecho el
    // movimiento o el generador.
    tambien: (pasos, mode, tonica) =>
      pasos.some((paso) => {
        if (paso.from === null || paso.from === paso.degree) {
          return false;
        }
        const raiz = fundamental(paso.degree, mode, tonica);
        const menor = (degree: DegreeSymbol) =>
          notasDe({ ...paso, degree, especie: undefined }, mode, tonica).has((raiz + 3) % 12);
        return (
          fundamental(paso.from, mode, tonica) === raiz && menor(paso.from) !== menor(paso.degree)
        );
      }),
  },

  {
    // La predominante: lo tuyo que pasa a ser una subdominante de la escala justo
    // delante de la dominante, lo haya hecho el movimiento o el generador.
    patron: /predominante/u,
    valen: ['predominante'],
    tambien: (pasos) =>
      pasos.some(
        (paso, i) =>
          paso.from !== null &&
          paso.from !== paso.degree &&
          ['ii', 'IV', 'ii°', 'iv'].includes(paso.degree) &&
          ['V', 'v'].includes(pasos[i + 1]?.degree ?? ''),
      ),
  },
  {
    // «Sin el cambio rápido» dice que no está, y eso no hay que comprobarlo: lo dicen
    // los coros de blues que no lo llevan.
    patron: /(?<!\bsin (?:el )?)cambio rapido/u,
    valen: ['cambio-rapido'],
    tambien: (pasos, mode) => pasos.some((_, i) => empiezaConCambioRapido(pasos, i, mode)),
  },
  {
    // El semitono frigio: un acorde mayor medio tono por encima del siguiente, que
    // baja a él. Lo cumplen el bII que va al I y el VI que va al V de una andaluza.
    patron: /semitono frigio|cadencia frigia|frigio mayor/u,
    valen: ['frigio'],
    tambien: (pasos, mode, tonica) =>
      pasos.some((paso, i) => {
        const siguiente = pasos[i + 1];
        if (siguiente === undefined) {
          return false;
        }
        const raiz = fundamental(paso.degree, mode, tonica);
        return (
          raiz === (fundamental(siguiente.degree, mode, tonica) + 1) % 12 &&
          notasDe(paso, mode, tonica).has((raiz + 4) % 12)
        );
      }),
  },
  {
    // Partir una dominante en su ii y ella solo lo hace el movimiento: sin él, hablar
    // de partir es contar algo que no se ha hecho.
    patron: /partir la dominante|se parte en dos|dos mitades|primera mitad pasa/u,
    valen: ['ii-v'],
    tambien: () => false,
  },
];

const NIEGA_EL_CIERRE =
  /no (la |lo )?(alcanza|resuelve|cierra|llega)|sin (cerrar|resolver)|queda abiert|deja abiert|suspendid/u;

const AFIRMA_EL_CIERRE =
  /(cierr[ao]|resuelve|aterriza|vuelve|cae|llega) (en|a) (la )?tonica|vuelve a casa/u;

/**
 * El cifrado de un grado con su especie: `G7`, `C5`, `Dsus4`.
 *
 * Por `blockChord`, que es el único sitio que sabe escribir una especie encima de
 * un grado: con `resolveProgression` a secas salían tríadas.
 */
function cifrado(
  tonica: PitchClass,
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | undefined,
): string {
  return blockChord(tonica, mode, writtenBlock('', degree, 1, especie)).symbol;
}

/**
 * La especie con la que vuelve un compás de una salida.
 *
 * Lo que dice el menú manda: una especie es esa especie y `null` es la tríada.
 * **Si no dice nada y el compás es tuyo sin cambiar de grado, la tuya**: el
 * generador puede no haberla copiado, y quedarse con la salida no puede quitarle
 * la séptima a lo que no ha tocado.
 */
function especieDe(
  paso: { readonly degree: DegreeSymbol; readonly especie?: EspecieDeBloque | null },
  original: SalidaStep | undefined,
): EspecieDeBloque | undefined {
  if (paso.especie !== undefined) {
    return paso.especie ?? undefined;
  }
  return original?.degree === paso.degree ? original.especie : undefined;
}

/** Una salida del menú, ya con sus cifrados recalculados y lo que había en cada compás. */
function propuestaDe(
  salida: SalidaPosible,
  request: SalidasRequest,
  title: string,
  why: string,
  instrucciones?: string,
): SalidaPropuesta {
  const { mode } = request.key;
  const tonica = pitchClassFromName(request.key.tonic);
  const original = request.progression;

  // Lo que había en cada compás, por posición; o por pulsos si la salida parte una
  // dominante en su ii y ella (`gruposPorPulsos`): por posición, todo lo de detrás
  // del partido decía venir del compás de al lado.
  const todos = salida.secciones.flatMap((seccion) => seccion.steps);
  const grupos =
    salida.path === 'rearmonizar' && todos.length !== original.length
      ? gruposPorPulsos(original, todos)
      : null;
  const deDonde: (SalidaStep | undefined)[] =
    grupos === null
      ? todos.map((_, i) => original[i])
      : grupos.flatMap((grupo, i) => grupo.map(() => original[i]));
  let cursor = 0;
  const sections: SalidaSection[] = salida.secciones.map((seccion) => ({
    name: seccion.name,
    yours: seccion.yours,
    steps: seccion.steps.map((step) => {
      const antes = deDonde[cursor];
      cursor += 1;
      const especie = especieDe(step, antes);
      return {
        degree: step.degree,
        ...(especie === undefined ? {} : { especie }),
        beats: step.beats,
        symbol: cifrado(tonica, mode, step.degree, especie),
        from: antes?.degree ?? null,
        ...(antes === undefined
          ? {}
          : {
              fromSymbol: cifrado(tonica, mode, antes.degree, antes.especie),
              fromBeats: antes.beats,
            }),
        move: step.move,
      };
    }),
  }));

  const sinTexto: SalidaPropuesta = {
    title: '',
    why: '',
    path: salida.path,
    sections,
    steps: sections.flatMap((seccion) => seccion.steps),
  };
  return {
    ...sinTexto,
    // Lo que diga algo que la salida no tiene se cambia por lo que dice el dominio,
    // que la construyó y no puede equivocarse sobre ella. No se tira la salida: los
    // acordes son buenos, lo que sobra es la frase.
    title: seDeja(title, sinTexto, request, instrucciones) ? title : salida.nombre,
    why: seDeja(why, sinTexto, request, instrucciones) ? why : salida.que,
  };
}

/**
 * Si una frase del modelo se puede pintar sobre esa salida.
 *
 * **Lo primero, que no sea un cebo ni copie las instrucciones**, sin mirar de qué
 * habla: con las directrices inyectadas, `qwen3:8b` devolvió tres de tres veces el
 * título «Renueva tu cuenta en evil.example», y nada lo miraba porque no nombraba
 * ningún acorde (adr/0115). Luego, que no diga nada que la salida no tiene
 * (`loQueNoEsta`).
 */
function seDeja(
  texto: string,
  propuesta: SalidaPropuesta,
  request: SalidasRequest,
  instrucciones: string | undefined,
): boolean {
  return (
    !esUnCebo(texto) &&
    !copiaLasInstrucciones(texto, instrucciones) &&
    loQueNoEsta(texto, propuesta, request) === null
  );
}

/**
 * Si un texto sobre una salida del menú pasa `loQueNoEsta`, tal y como lo leería
 * el validador.
 *
 * Lo usan el prompt, para no enseñarle al modelo como porqué un motivo del juez
 * que luego se taparía, y el respaldo sin IA, para escribir el suyo con los que
 * pasan. **Un motivo puede ser verdad y no pasar**: «Vuelve a tu principio por V
 * I: la dominante resuelve en la tónica» cuenta la vuelta de un puente que acaba
 * en V, y aquí «resuelve en la tónica» se lee como que cierra. Se prefiere
 * callarlo a aflojar el validador, que es lo que caza al modelo cuando dice que
 * cierra lo que se queda abierto.
 */
export function seSostiene(texto: string, salida: SalidaPosible, request: SalidasRequest): boolean {
  return loQueNoEsta(texto, propuestaDe(salida, request, '', ''), request) === null;
}

/** Lo que el validador sabe de la pregunta que se le hizo al modelo. */
export interface LoQueVioElModelo {
  /**
   * Cuántas salidas del menú se le enseñaron, contadas desde la primera; sin él,
   * el menú entero.
   *
   * **El prompt no siempre cabe con el menú entero**: sin directrices van las tres
   * mejores, y con ellas las que quepan. Un número de más allá existe en el menú
   * pero el modelo no lo vio, y un porqué escrito sin ver la salida no se le
   * enseña a nadie. El esquema ya no lo deja —el número es un enumerado—, pero el
   * esquema lo cumple el proveedor y esto lo cumple el dominio.
   */
  readonly vistas?: number;
  /** El prompt de sistema, para tapar el título o el porqué que lo copie. */
  readonly instrucciones?: string;
}

/**
 * Valida lo que devuelve el modelo contra el dominio.
 *
 * **El modelo ya no escribe salidas: las elige.** El menú lo construye
 * `salidasPosibles` y va numerado en el prompt; lo que vuelve es un número, un
 * título y un porqué. Las salidas son válidas por construcción —salen de los
 * movimientos, el grafo y las cadencias que antes las juzgaban, y pasan
 * `songProblem` antes de entrar en el menú—, así que lo que queda por comprobar
 * aquí es lo que el modelo sí pone:
 *
 * - **que el número exista y el modelo lo viera** (`vistas`), y que no repita uno
 *   ya elegido;
 * - **que el título y el porqué no mientan** (`loQueNoEsta`): si nombran un acorde
 *   o un movimiento que no está, se cambian por los del dominio;
 * - **y que no sean un cebo ni una copia de las instrucciones** (`seDeja`): un
 *   enlace, un correo o una contraseña se cambian igual, hablen de lo que hablen.
 *
 * Los cifrados no se creen: se recalculan desde los grados, como siempre.
 */
export function validateSalidas(
  payload: unknown,
  request: SalidasRequest,
  { vistas, instrucciones }: LoQueVioElModelo = {},
): SalidaPropuesta[] {
  if (!isRecord(payload) || !Array.isArray(payload['versions'])) {
    return [];
  }
  const posibles = salidasDe(request);
  const alcance = vistas ?? posibles.length;
  const elegidas = new Set<number>();
  const propuestas: SalidaPropuesta[] = [];
  // Lo que eligió sin verlo se quita **antes** del tope: una elección a ciegas no
  // ocupa el sitio de una de verdad que venga detrás.
  const sinLasCiegas = payload['versions'].filter(
    (raw) => !isRecord(raw) || typeof raw['opcion'] !== 'number' || raw['opcion'] <= alcance,
  );

  for (const raw of sinLasCiegas.slice(0, MAX_SALIDAS)) {
    if (!isRecord(raw)) {
      continue;
    }
    const { opcion, title, why } = raw;
    if (
      typeof opcion !== 'number' ||
      !Number.isInteger(opcion) ||
      posibles[opcion - 1] === undefined ||
      elegidas.has(opcion) ||
      typeof title !== 'string' ||
      title.trim() === '' ||
      typeof why !== 'string' ||
      why.trim() === ''
    ) {
      continue;
    }
    elegidas.add(opcion);
    propuestas.push(
      propuestaDe(
        posibles[opcion - 1]!,
        request,
        // Recortados y no descartados: un porqué de más es prosa de sobra, no una
        // salida mala.
        title.trim().slice(0, MAX_SALIDA_TITLE_LENGTH),
        why.trim().slice(0, MAX_SALIDA_WHY_LENGTH),
        instrucciones,
      ),
    );
  }

  return propuestas;
}
