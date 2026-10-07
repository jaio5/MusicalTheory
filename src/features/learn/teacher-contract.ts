/**
 * Contrato del profesor: qué se le pregunta y qué puede contestar.
 *
 * Vale para los dos lados —el servidor valida, el cliente construye— y es
 * TypeScript puro, así que se prueba sin levantar nada.
 *
 * Lo que viaja son símbolos y la pregunta escrita: tonalidad, escala, grados y
 * la frase que se teclea. El audio no sale del equipo, y esto no
 * abre esa puerta porque el micro no aporta nada a esta petición.
 */

import {
  checkAnswerAgainstTheory,
  degreesFor,
  cuerpoConTonalidad,
  findTheory,
  findUnit,
  keyChordTable,
  normalizeForSearch,
  respuestaDelGlosario,
  resolveProgression,
  SCALE_IDS,
  type DegreeSymbol,
  type KeyMode,
  type NoteName,
  type ScaleId,
} from '@core/music';
import { aiError, type AiError, type AiErrorCode } from '@core/ai-errors';
import { entreMarcas, textoLibre } from '@core/marca';
import { copiaLasInstrucciones, esUnCebo } from '@core/prosa-del-modelo';
import { isRecord } from '@core/parse';
import { pitchClassFromName } from '@core/music';
import { MAX_QUESTION_LENGTH } from '@core/billing';

/**
 * Lo más larga que puede ser la pregunta. Se define en `core/billing/cost.ts` porque
 * es una palanca de gasto —son tokens de entrada, y de ahí salen los cupos— y se
 * reexporta aquí para que quien lea el contrato no tenga que saberlo.
 */
export { MAX_QUESTION_LENGTH };

/** Lo más larga que se acepta la respuesta. Se recorta al validarla. */
export const MAX_ANSWER_LENGTH = 900;

/**
 * La palabra de la marca que encierra la pregunta dentro del prompt.
 *
 * La pregunta es **uno de los dos** textos libres que entran al modelo en toda la
 * aplicación —el otro son las directrices de una salida, `PALABRA_DIRECTRICES`—, así
 * que va delimitada y el prompt de sistema dice que lo de dentro es un dato y no
 * una instrucción. Los dos van igual, y a propósito: dos maneras de acotar lo
 * mismo serían dos superficies que revisar. No es una defensa perfecta —ninguna lo es
 * contra una inyección decidida— pero convierte el caso habitual, el «ignora lo
 * anterior», en una frase más dentro de un bloque marcado.
 *
 * **La marca lleva una clave nueva en cada petición** —`###PREGUNTA-3f9a1c###`, con
 * `preguntaEntreMarcas`— y el prompt de sistema dice que solo la cierra la misma
 * marca con la misma clave: quien escribe no la ve, así que no la puede escribir
 * (adr/0115). Además `parseTeacherRequest` borra de la pregunta todo lo que se
 * parezca a la marca, escrito como se escriba (`core/marca.ts`): con espacios, en
 * minúsculas, con ancho cero, con selectores, acentos o letras de otro alfabeto.
 */
export const PALABRA_PREGUNTA = 'PREGUNTA';

/** La pregunta entre sus dos marcas, con una clave nueva (`core/marca.ts`). */
export function preguntaEntreMarcas(question: string, clave?: () => string): string {
  return entreMarcas(question, PALABRA_PREGUNTA, clave);
}

/**
 * Lo que contesta el profesor cuando lo que le preguntan no es de música.
 *
 * **La escribimos nosotros, no el modelo.** Cuando el modelo declara que la
 * pregunta se sale del tema, lo que haya escrito se tira entero y se pinta esto:
 * así, una inyección que consiga colarse tampoco consigue que la aplicación
 * enseñe su texto. Es la misma regla que los cifrados y los movimientos —no se
 * cree lo que dice, se sustituye por lo que sabemos—, llevada a la prosa.
 */
export const FUERA_DE_TEMA =
  'Aquí solo sé de música. Pregúntame por la tonalidad, los acordes o qué escala tocar.';

/** Quién ha escrito una respuesta que no es del modelo. */
export type FuenteDeLaRespuesta = 'glosario' | 'aviso';

/**
 * Lo que va delante de una respuesta del glosario cuando el modelo no ha dado una
 * que valga. **Dice de quién es**: quien lee tiene derecho a saber que eso no lo ha
 * escrito la IA, y que es la teoría comprobada de la aplicación.
 */
export const DEL_GLOSARIO =
  'Esto no lo ha escrito la IA: no ha dado una respuesta que se pueda comprobar, así que contesta el glosario de la aplicación.';

/**
 * Lo que se contesta cuando el modelo no ha dado una respuesta que valga y la
 * pregunta no casa con el glosario. Honrado —no ha salido— y útil: cómo
 * preguntarlo para que salga, y los acordes de la tonalidad, que son ciertos
 * siempre.
 */
export function sinRespuesta(tabla: string): string {
  return `El profesor no ha dado con una respuesta que se pueda dar por buena, y prefiero no enseñarte una dudosa. Prueba a preguntarlo con otras palabras, nombrando lo que quieres saber: una cadencia, un modo, un intervalo, las notas de un acorde. ${tabla}`;
}

/**
 * Por qué contesta el respaldo y no el modelo: no se le ha podido hablar, o habló y
 * lo que dijo no valía. Son los dos 502 que el respaldo evita.
 *
 * **No son el mismo consejo.** Con lo que no valía, preguntarlo de otra manera
 * ayuda; con el modelo caído, preguntarlo de otra manera es gastar otra pregunta
 * contra lo mismo. Por eso viaja en la respuesta: la pantalla elige su frase con él.
 */
export type MotivoDelRespaldo = Extract<AiErrorCode, 'model_unavailable' | 'unparseable_response'>;

/**
 * Lo que se dice cuando no se ha podido hablar con el modelo. Lo que toca es
 * esperar, no reescribir la pregunta.
 */
export const SIN_CONTACTO =
  'No hemos podido contactar con el modelo; vuelve a intentarlo en un minuto.';

/**
 * Lo que va delante del glosario cuando el modelo no ha contestado. Dice de quién
 * es, como `DEL_GLOSARIO`, pero **no dice que la respuesta no se pudo comprobar**:
 * no hubo respuesta que comprobar, y decirlo mandaría a buscar el fallo en la
 * pregunta.
 */
export const DEL_GLOSARIO_SIN_CONTACTO = `${SIN_CONTACTO} Mientras, contesta el glosario de la aplicación, que no lo ha escrito la IA.`;

export interface TeacherRequest {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly question: string;
  readonly scale?: ScaleId;
  /**
   * La unidad que se está leyendo, **por su identificador**.
   *
   * Antes viajaba el título, escrito por el cliente, y eso eran sesenta
   * caracteres de texto libre entrando al prompt sin que nadie los mirara: la
   * mitad de la superficie de inyección de toda la aplicación, en un campo que
   * no hacía ninguna falta. El título ya está en `core/music/curriculum.ts`, así
   * que el servidor lo resuelve él y el cliente manda el id y nada más.
   */
  readonly unitId?: string;
}

export interface TeacherAnswer {
  readonly answer: string;
  /** Un ejemplo tocable, si viene a cuento. */
  readonly example?: {
    readonly degrees: readonly DegreeSymbol[];
    readonly chords: readonly string[];
  };
  /**
   * De dónde sale cuando **no** la ha escrito el modelo: del glosario, o nuestro
   * aviso de que no ha salido. Ausente es el modelo (`respaldoDelProfesor`).
   */
  readonly fuente?: FuenteDeLaRespuesta;
  /** Por qué no ha contestado el modelo. Solo lo lleva lo que tiene `fuente`. */
  readonly motivo?: MotivoDelRespaldo;
}

/**
 * Los siete códigos, compartidos con las otras dos rutas de IA.
 *
 * Alias y no una copia: estaban declarados tres veces idénticos, y el día que
 * haga falta uno nuevo se añade en `core/ai-errors.ts` y lo tienen las tres.
 */
export type TeacherErrorCode = AiErrorCode;

export type TeacherError = AiError;

export const TEACHER_ERROR_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
  invalid_request:
    'Falta la tonalidad o la pregunta. Elige una tonalidad, escribe qué quieres saber y vuelve a probar.',
  rate_limited: 'Has preguntado muchas veces seguidas. Espera un momento y vuelve a intentarlo.',
  model_unavailable: 'No hemos podido contactar con el profesor. Vuelve a intentarlo en un minuto.',
  unparseable_response: 'La respuesta no ha venido bien formada. Vuelve a preguntar.',
  // Estos dos los reescribe la ruta con el plan y el número concretos. Lo que
  // queda aquí es lo que se lee si algún día alguien los emite sin detalle.
  account_required:
    'Entra con tu cuenta para preguntarle al profesor. La IA se cuenta por cuenta, no por navegador.',
  plan_required: 'Preguntarle al profesor no entra en tu plan.',
  quota_exhausted:
    'Se te han acabado las preguntas de hoy. Mañana se renuevan, o puedes subir de plan.',
};

export function teacherError(code: TeacherErrorCode, message?: string): TeacherError {
  return aiError(code, TEACHER_ERROR_MESSAGES, message);
}

/**
 * Valida la petición. Nada se reenvía tal cual: se reconstruye campo a campo, y
 * la pregunta se recorta, porque un texto largo es dinero y no es mejor
 * pregunta.
 */
export function parseTeacherRequest(body: unknown): TeacherRequest | null {
  const leido = cuerpoConTonalidad(body);
  if (leido === null) {
    return null;
  }
  const { campos, tonic, mode } = leido;

  const question = campos['question'];
  if (typeof question !== 'string' || question.trim() === '') {
    return null;
  }
  // Recortada antes de limpiarla, sin nada con forma de marca y dentro de su tope
  // **en el peor alfabeto**: 240 letras en español o 25 caracteres chinos, que
  // cuestan lo mismo (`core/marca.ts`, adr/0115).
  const limpia = textoLibre(question, PALABRA_PREGUNTA, MAX_QUESTION_LENGTH);
  if (limpia === '') {
    return null;
  }

  const request: {
    key: { tonic: NoteName; mode: KeyMode };
    question: string;
    scale?: ScaleId;
    unitId?: string;
  } = {
    key: { tonic: tonic as NoteName, mode },
    question: limpia,
  };

  const scale = campos['scale'];
  if (typeof scale === 'string' && (SCALE_IDS as readonly string[]).includes(scale)) {
    request.scale = scale as ScaleId;
  }

  // Un id que no esté en el temario se descarta en silencio, como los grados que
  // no existen: no es un error del que pregunta, es un cliente desactualizado.
  const unitId = campos['unitId'];
  if (typeof unitId === 'string' && findUnit(unitId) !== null) {
    request.unitId = unitId;
  }

  return request;
}

/**
 * El título de la unidad que se está leyendo, si es que hay una.
 *
 * Sale del temario y no de lo que mande el cliente, que es toda la gracia. Vive
 * en el contrato porque es la traducción del campo que el contrato define, y así
 * la ruta no tiene que saber que detrás hay un temario.
 */
export function topicOf(request: TeacherRequest): string | undefined {
  return request.unitId === undefined ? undefined : findUnit(request.unitId)?.unit.title;
}

/**
 * Valida la respuesta contra el dominio. Los cifrados del ejemplo no se creen:
 * se recalculan desde los grados, que es la única forma de que no aparezca en
 * pantalla un acorde que no existe en esa tonalidad.
 *
 * **Y la prosa se comprueba contra el glosario.** Si la pregunta es por algo con
 * firma —una cadencia, la relativa— y la respuesta lo nombra, tiene que decir sus
 * acordes y no los de otra cosa (`checkAnswerAgainstTheory`). Lo que no pasa
 * vuelve nulo, y la ruta reintenta una vez con otra temperatura: es lo que hace
 * que «la cadencia perfecta es C a G a C» no llegue a la pantalla.
 */
export function validateTeacherAnswer(
  payload: unknown,
  request: TeacherRequest,
  instrucciones?: string,
): TeacherAnswer | null {
  if (!isRecord(payload)) {
    return null;
  }

  // Lo primero, antes de mirar nada más: ¿ha dicho el modelo que esto es de
  // música? El esquema lo declara obligatorio y enumerado, así que si falta o
  // trae otra cosa es que quien ha contestado no es el que creemos.
  const tema = payload['tema'];
  if (tema !== 'musica' && tema !== 'fuera') {
    return null;
  }
  if (tema === 'fuera') {
    // **Salvo que la pregunta sea de aquí de verdad.** El modelo de casa rechazaba
    // «¿la aplicación sube mi audio?» y «¿puedo grabar un vídeo?» con el glosario
    // delante diciéndole qué contestar; entonces su «fuera» no vale: se reintenta y,
    // si insiste, contesta el glosario (`respaldoDelProfesor`). Pero rozar el
    // glosario no basta (`esDeAqui`).
    if (esDeAqui(request.question)) {
      return null;
    }
    // Ni su texto ni su ejemplo. Lo que sale es nuestra frase.
    return { answer: FUERA_DE_TEMA };
  }

  const answer = payload['answer'];
  if (typeof answer !== 'string' || answer.trim() === '') {
    return null;
  }

  const result: { answer: string; example?: TeacherAnswer['example'] } = {
    answer: answer.trim().slice(0, MAX_ANSWER_LENGTH),
  };
  // Un enlace, un correo o una contraseña se tiran **antes de mirar el tema**: «es
  // una nota del equipo» pasaba por música (adr/0115). Y luego, ha dicho `musica` y
  // no habla de música, o copia sus instrucciones: es lo que sale cuando una
  // inyección funciona (adr/0015). Se tira como cualquier respuesta que no vale, y
  // la ruta reintenta o contesta con lo nuestro.
  if (
    esUnCebo(result.answer) ||
    !hablaDeMusica(result.answer) ||
    copiaLasInstrucciones(result.answer, instrucciones)
  ) {
    return null;
  }
  const tonic = pitchClassFromName(request.key.tonic);
  if (
    checkAnswerAgainstTheory(request.question, result.answer, { tonic, mode: request.key.mode }) !==
    null
  ) {
    return null;
  }

  const example = payload['example'];
  if (isRecord(example) && Array.isArray(example['degrees'])) {
    const valid = degreesFor(request.key.mode) as readonly string[];
    const degrees = example['degrees'];
    if (
      degrees.length > 0 &&
      degrees.every((degree) => typeof degree === 'string' && valid.includes(degree))
    ) {
      const chords = resolveProgression(
        tonic,
        request.key.mode,
        degrees as readonly DegreeSymbol[],
      ).map((chord) => chord.symbol);
      result.example = { degrees: degrees as DegreeSymbol[], chords };
    }
  }

  return result;
}

/**
 * Las raíces de las palabras con las que se habla de música, de tocar o de esta
 * aplicación. Comparadas por el principio, sin tildes: «acord» vale por «acorde» y
 * «acordes».
 *
 * **Larga a propósito**, porque se equivoca en una sola dirección que importa: una
 * respuesta de música que no dijera ninguna se tiraría. Por eso entra lo que suena a
 * música aunque también se diga fuera de ella —«suena», «ritmo», «nota»—, y un
 * acorde o un grado escritos cuentan solos. Y se queda fuera lo que en castellano
 * es sobre todo otra cosa: «bajo» es una preposición, «modo» una manera, «mayor» y
 * «menor» adjetivos de todo, y con ellas dentro un poema sobre París «bajo el alba»
 * pasaba por música. Lo que caza es lo que sale cuando una inyección funciona.
 */
const RAICES_DE_MUSICA: readonly string[] = [
  'acord',
  'nota',
  'tonalidad',
  'tono',
  'semiton',
  'escala',
  'grado',
  'cadenci',
  'compas',
  'ritm',
  'pulso',
  'tempo',
  'bpm',
  'metronom',
  'melod',
  'armon',
  'interval',
  'segunda',
  'tercera',
  'cuarta',
  'quinta',
  'sexta',
  'septima',
  'octava',
  'triton',
  'tonica',
  'dominant',
  'subdominant',
  'sensible',
  'jonic',
  'doric',
  'frigi',
  'lidi',
  'mixolidi',
  'eolic',
  'locri',
  'pentaton',
  'blues',
  'guitarr',
  'cuerda',
  'traste',
  'mastil',
  'sonid',
  'suena',
  'suenan',
  'tocar',
  'tocas',
  'tocando',
  'musica',
  'cancion',
  'estribillo',
  'riff',
  'punteo',
  'rasgue',
  'afin',
  'cents',
  'micro',
  'audio',
  'grab',
  'ensay',
  'compon',
  'partitura',
  'pentagrama',
  'armadura',
  'sostenid',
  'bemol',
  'alteracion',
  'relativ',
  'circulo',
  'progresion',
  'resuelv',
  'sincop',
  'contratiempo',
  'corchea',
  'disminuid',
  'aumentad',
  'suspendid',
  'inversion',
  'prestad',
  'modul',
];

/**
 * Un acorde o un grado escritos: «G7», «Am», «V/V», «bVII». La «A» sola no, que
 * es la preposición: «A continuación, pon las patatas» pasaba por un acorde de La.
 */
const SIMBOLO_MUSICAL =
  /(?<![\p{L}\p{N}])(?:[B-G][#b]?(?:maj7|m7b5|m7|m|7|5|dim|aug|sus2|sus4)?|A(?:[#b]|maj7|m7b5|m7|m|7|5|dim|aug|sus2|sus4)|b?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii)°?(?:\/[ivIV]+)?)(?![\p{L}\p{N}])/u;

/**
 * Si una respuesta habla de música: alguna de sus palabras, o un acorde o un grado
 * escritos.
 *
 * El ADR 0015 descartó filtrar **la pregunta** por palabras, y con razón: «¿por qué
 * suena triste?» no lleva ninguna técnica. La respuesta es otra cosa. A una
 * pregunta de música se le contesta con música —esa misma la contestó el modelo
 * con «A menor» y «Bdim»—, y lo que no lleva ni una palabra de música cuando el
 * modelo ha dicho `musica` es que el modelo ha dicho otra cosa de la que hace.
 */
export function hablaDeMusica(answer: string): boolean {
  if (SIMBOLO_MUSICAL.test(answer)) {
    return true;
  }
  const palabras = answer
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return palabras.some((palabra) => RAICES_DE_MUSICA.some((raiz) => palabra.startsWith(raiz)));
}

/**
 * Si una pregunta que el modelo ha declarado fuera de tema es, en realidad, de aquí.
 *
 * **Que case con el glosario no basta**, porque la recuperación es ancha a
 * propósito —plurales, faltas, una palabra suelta de un nombre— y en una pregunta
 * de otra cosa eso es un roce: «¿cómo hago un modo oscuro en CSS?» casaba con los
 * modos y «¿qué es un intervalo de confianza?» con los intervalos, y los dos
 * costaban una llamada más para que acabara contestando el glosario. Hace falta
 * además una de dos:
 *
 * - **que la nombre entera**: un nombre de varias palabras escrito tal cual —«sube
 *   mi audio»—, o dos nombres de la misma —«grabar» y «vídeo»—;
 * - **o que la pregunta diga otra cosa de música**, fuera de las palabras con las
 *   que ha casado: «¿cómo afino **la guitarra**?» es de aquí aunque «afino» suelto
 *   no lo fuera.
 *
 * Se equivoca hacia aceptar el «fuera»: lo que se pierde es una pregunta de música
 * dicha con una sola palabra del glosario, y el modelo casi nunca la rechaza.
 */
function esDeAqui(question: string): boolean {
  const entradas = findTheory(question);
  if (entradas.length === 0) {
    return false;
  }
  const dichas = normalizeForSearch(question).split(' ');
  const texto = ` ${dichas.join(' ')} `;
  const nombradas = entradas
    .flatMap((entrada) => entrada.names)
    .filter((nombre) => texto.includes(` ${nombre} `));
  if (nombradas.length >= 2 || nombradas.some((nombre) => nombre.includes(' '))) {
    return true;
  }
  // Lo que la ha hecho casar no cuenta como «otra»: «intervalo» es de música, y es
  // justo la que casó. Solo los nombres de una palabra, con su plural: los de
  // varias se llevarían «guitarra» de «afinar la guitarra», que sí es otra.
  const suyas = entradas
    .flatMap((entrada) => [...entrada.names, ...(entrada.aliases ?? [])])
    .filter((nombre) => !nombre.includes(' ') && nombre.length >= 4);
  const otras = dichas.filter((palabra) => !suyas.some((suya) => palabra.startsWith(suya)));
  return (
    SIMBOLO_MUSICAL.test(question) ||
    otras.some((palabra) => RAICES_DE_MUSICA.some((raiz) => palabra.startsWith(raiz)))
  );
}

/**
 * Si la respuesta copia las instrucciones del prompt de sistema. Vive en
 * `core/prosa-del-modelo.ts`, porque las salidas la usan también con su título y su
 * porqué; se reexporta aquí, donde se buscó siempre.
 */
export { copiaLasInstrucciones };

/**
 * Lo que contesta el profesor cuando el modelo no ha dado nada que valga: no ha
 * contestado, se ha cortado o lo que dijo no pasó el validador dos veces.
 *
 * **Si la pregunta casa con el glosario, contesta el glosario**, resuelto en la
 * tonalidad y diciendo que no es de la IA. Es la misma teoría que iba en el prompt,
 * así que es lo que el modelo tenía que haber dicho. Si no casa, un aviso con los
 * acordes de la tonalidad, que son ciertos siempre. Nunca la pantalla de error:
 * quien pregunta ha gastado su pregunta igual.
 *
 * **Y lo que se dice delante depende del `motivo`.** Si el modelo contestó algo que
 * no valía, `sinRespuesta` aconseja preguntarlo con otras palabras; si no se le pudo
 * hablar, ese consejo hace gastar otra pregunta contra un modelo caído, y lo que
 * toca es esperar un minuto (`SIN_CONTACTO`).
 */
export function respaldoDelProfesor(
  request: TeacherRequest,
  motivo: MotivoDelRespaldo = 'unparseable_response',
): TeacherAnswer {
  const key = { tonic: pitchClassFromName(request.key.tonic), mode: request.key.mode };
  const glosario = respuestaDelGlosario(request.question, key);
  const sinContacto = motivo === 'model_unavailable';
  if (glosario === null) {
    const tabla = keyChordTable(key);
    return {
      answer: sinContacto ? `${SIN_CONTACTO} ${tabla}` : sinRespuesta(tabla),
      fuente: 'aviso',
      motivo,
    };
  }
  return {
    answer: `${sinContacto ? DEL_GLOSARIO_SIN_CONTACTO : DEL_GLOSARIO} ${glosario}`,
    fuente: 'glosario',
    motivo,
  };
}
