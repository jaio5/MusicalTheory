/**
 * El corpus ciego: **61 canciones a medias escritas antes de ejecutar nada y sin
 * abrir los otros dos corpus**, en los estilos que esos no tocaban —funk, R&B,
 * country, reggae, cantautor, latin, cine, 6/8— y en las formas raras: tomas de
 * treinta y un compases, todo dudoso, un compás solo, un acorde fuera de la
 * tonalidad.
 *
 * Los dos exámenes de antes (`corpus-de-salidas.ts` y `corpus-de-verificacion.ts`)
 * los escribió gente que ya sabía cómo piensa el generador. Este no: un arreglista
 * escribió para cada caso **tres respuestas buenas y los errores que no quería
 * ver**, y después juzgó los 85 menús uno a uno. Salieron 56 bien, 26 aceptables y
 * 3 mal, y los fallos no eran de los que los otros corpus miraban: dominantes
 * secundarias que no van a su destino, un vii° pelado como cadencia de un country,
 * un funk sin su IV7, el I7 de un gospel cambiado por un vi, el punteo olvidado al
 * estirar, puentes que se quedan en casa y **cinco frases falsas** —«resuelve en la
 * I» detrás de un V/V, «ii I: cadencia plagal», «cuadra lo desigual» sobre una
 * tónica sostenida, «en el 5» contando acordes, «engaña al oído» sin dominante—.
 *
 * Aquí está traducido a los predicados de los otros dos, con los que faltaban
 * añadidos en `corpus-de-salidas.ts`, y se examina con el criterio de verificación
 * (`exigir`): el `debe` en las tres primeras, el `noDebe` en todo el menú, la
 * calidad de cada una de las tres primeras y, en los casos límite, cuántas
 * salidas razonables hay. **Las respuestas son las del arreglista**: donde dio
 * tres, el `debe` admite las tres.
 *
 * **Un caso es una petición**, no dos: el arreglista escribió cada uno para
 * continuar o para retocar. Y los que son de un estilo que `styles.ts` no tiene
 * —funk, R&B, country, reggae, cantautor, latin, bolero, cine, gospel— se
 * examinan dos veces: sin estilo y con el más cercano, que es lo que haría quien
 * los tocara hoy. **Y los que ya lo tienen —funk, country, reggae, bolero y cine,
 * que llegaron a `styles.ts` después— una tercera, con el suyo** (`suEstilo`). Por
 * eso son 61 casos y 98 menús.
 *
 * **Lo que no se traduce, se dice.** El arreglista dudó en tres buenas («I V/IV?
 * no», «vi V/vi?», «i iv VII III? (no cierra)») y puso un «bien» en la lista de
 * errores de `punteo-sensible-menor`: las dudosas entran como alternativas y la
 * que él mismo daba por buena no entra como error. Y su «un contraste llamado
 * puente sin decir que es la vuelta» habla del nombre, que ya dice que vuelve.
 */

import type { EspecieDeBloque } from './chords';
import type { ContextoDeSalidas } from './contexto-de-salidas';
import {
  alarga,
  cadenciaDeViiTriada,
  cambiaAlgunoEntre,
  cambiaLoDudoso,
  chocaConElPunteoDondeSuena,
  cierraCon,
  cierraEnLaTonica,
  compasEs,
  contrasteQueReposaEnLaTonica,
  dicho,
  diceAlgoFalso,
  duraMasDe,
  encadenaSecundarias,
  esCamino,
  loNuevoComoDominantes,
  loNuevoConSeptima,
  loNuevoEnMultiplosDe,
  loNuevoVaA,
  meteElGiro,
  meteElGrado,
  meteLaSensible,
  meteUnaSecundaria,
  mismosAcordesA,
  no,
  NUNCA,
  o,
  pasaPor,
  pierdeElPrestado,
  pierdeLaSecundaria,
  poneComo,
  repiteLoTuyo,
  respetaFrasesDe,
  secundariaQueNoResuelve,
  sigueCon,
  y,
  type Expectativa,
} from './corpus-de-salidas';
import {
  leerPunteo,
  leerToma,
  type CasoExigible,
  type LoQueSeExige,
  type Razonables,
} from './corpus-de-verificacion';
import type { KeyMode } from './keys';
import type { PathKind, PathStep } from './paths';
import type { DegreeSymbol } from './progressions';
import type { SectionRole } from './song';
import type { StyleId } from './styles';

// --- Los casos ---------------------------------------------------------------------

/** Las familias del arreglista, para leer la nota por partes. */
export type FamiliaCiega =
  | 'funk'
  | 'rnb'
  | 'country'
  | 'reggae'
  | 'cantautor'
  | 'latin'
  | 'cine'
  | 'pop-menor'
  | 'ternario'
  | 'secundarias'
  | 'relativa'
  | 'estribillo-IV'
  | 'pre'
  | 'puente'
  | 'final'
  | 'dudoso'
  | 'punteo'
  | 'larga'
  | 'limite';

export const FAMILIAS_CIEGAS: readonly FamiliaCiega[] = [
  'funk',
  'rnb',
  'country',
  'reggae',
  'cantautor',
  'latin',
  'cine',
  'pop-menor',
  'ternario',
  'secundarias',
  'relativa',
  'estribillo-IV',
  'pre',
  'puente',
  'final',
  'dudoso',
  'punteo',
  'larga',
  'limite',
];

export interface CasoCiego {
  readonly id: string;
  readonly familia: FamiliaCiega;
  /** Lo que es, en las palabras del arreglista. */
  readonly que: string;
  readonly mode: KeyMode;
  /** La petición para la que se escribió: cada caso, una. */
  readonly kind: PathKind;
  readonly compases: readonly PathStep[];
  /** Todo lo que sabe la petición **menos el estilo**, que va aparte. */
  readonly contexto: ContextoDeSalidas;
  readonly estilo?: StyleId;
  /**
   * El estilo de verdad, cuando `styles.ts` no lo tiene: entonces `estilo` es el
   * más cercano y el caso se examina dos veces, sin estilo y con él.
   */
  readonly estiloReal?: string;
  /**
   * El estilo de verdad **ahora que `styles.ts` lo tiene**: funk, country, reggae,
   * bolero y cine llegaron después de escribir el corpus. El caso se examina una
   * tercera vez, con él, sin quitar las otras dos.
   */
  readonly suEstilo?: StyleId;
  /**
   * Los errores que el arreglista apuntó y **solo se pueden pedir con el estilo de
   * verdad**: con el más cercano no, porque allí son de la casa —el bVII de un
   * country examinado como folk—. Se añaden al `noDebe` de la tercera vez.
   */
  readonly delSuyo?: readonly Expectativa[];
  readonly espera: LoQueSeExige;
  /**
   * Los errores que **solo lo son sabiendo el estilo** (`CasoEscrito.delEstilo`): se
   * añaden al `noDebe` cuando se examina con él, y no sin él.
   */
  readonly delEstilo?: readonly Expectativa[];
}

/** Un caso como lo escribió el arreglista: la toma en la notación compacta y lo esperado. */
interface CasoEscrito extends Omit<LoQueSeExige, 'noDebe' | 'aceptable'> {
  readonly id: string;
  readonly familia: FamiliaCiega;
  readonly que: string;
  readonly mode: KeyMode;
  readonly kind: PathKind;
  /** En la notación de `leerToma`: `grado:pulsos@especie?`. */
  readonly toma: string;
  /** Los pulsos de los compases que no los dicen. */
  readonly pulsos?: number;
  readonly pulsosPorCompas?: number;
  readonly papel?: SectionRole;
  /** En la notación de `leerPunteo`: semitonos sobre la tónica, `F` los fuertes. */
  readonly punteo?: readonly string[];
  readonly estilo?: StyleId;
  readonly estiloReal?: string;
  /** Los errores propios del caso; los de todos los añade `caso`. */
  readonly noDebe?: readonly Expectativa[];
  /**
   * Los errores que **dependen del estilo de verdad** y no se pueden pedir sin él: el
   * iv en un country es un error, y en la misma toma sin estilo es la coda de manual
   * que pide el corpus de verificación (`final-coda`, `I IV I V`: «IV iv I»). Sin
   * estilo nada distingue un country de un pop, así que solo cuentan con él.
   */
  readonly delEstilo?: readonly Expectativa[];
  readonly suEstilo?: StyleId;
  readonly delSuyo?: readonly Expectativa[];
  readonly aceptable?: readonly Expectativa[];
  /** Lo que el arreglista admite detrás de una secundaria además de su destino. */
  readonly tolera?: readonly DegreeSymbol[];
}

/**
 * Lo que no puede hacer ninguna salida de este corpus: lo de siempre, mentir de
 * sí misma, dejar una secundaria sin destino y cerrar con el vii° pelado —todo el
 * corpus es música popular—. Al retocar, además, no quitarle a una secundaria
 * tuya el sitio adonde iba.
 */
function nuncaCiego(kind: PathKind, tolera: readonly DegreeSymbol[]): Expectativa[] {
  return [
    ...NUNCA,
    diceAlgoFalso(),
    secundariaQueNoResuelve(...tolera),
    cadenciaDeViiTriada(),
    ...(kind === 'retocar' ? [pierdeLaSecundaria()] : []),
  ];
}

/**
 * Al continuar, lo mínimo de cada una de las tres primeras: si es un puente, que
 * se vaya. El arreglista lo vio arriba del menú más de una vez.
 */
const SIN_REPOSO = no(contrasteQueReposaEnLaTonica(), 'si contrasta, no reposa en la tónica');

function caso({
  toma,
  pulsos,
  pulsosPorCompas,
  papel,
  punteo,
  noDebe = [],
  aceptable = [],
  tolera = [],
  delEstilo,
  suEstilo,
  delSuyo,
  ...resto
}: CasoEscrito): CasoCiego {
  const { compases, ...leido } = leerToma(toma, pulsos);
  const { id, familia, que, mode, kind, estilo, estiloReal, debe, primera, razonables } = resto;
  return {
    id,
    familia,
    que,
    mode,
    kind,
    compases,
    contexto: {
      ...(pulsosPorCompas === undefined ? {} : { pulsosPorCompas }),
      ...(papel === undefined ? {} : { papel }),
      ...leido,
      ...(punteo === undefined ? {} : { melodia: leerPunteo(punteo) }),
    },
    ...(estilo === undefined ? {} : { estilo }),
    ...(estiloReal === undefined ? {} : { estiloReal }),
    ...(delEstilo === undefined ? {} : { delEstilo }),
    ...(suEstilo === undefined ? {} : { suEstilo }),
    ...(delSuyo === undefined ? {} : { delSuyo }),
    espera: {
      debe,
      noDebe: [...noDebe, ...nuncaCiego(kind, tolera)],
      aceptable: kind === 'continuar' ? [SIN_REPOSO, ...aceptable] : aceptable,
      ...(primera === undefined ? {} : { primera }),
      ...(razonables === undefined ? {} : { razonables }),
    },
  };
}

// --- Lo que se repite entre casos ---------------------------------------------------

const TRIADAS = dicho('pone tríadas donde todo lleva séptima', no(loNuevoConSeptima()));

const BII = dicho('mete el bII, el tritonal, sin que nada lo pida', meteElGrado('bII'));

/** Los límite piden un menú con donde elegir: el arreglista apuntó «menú vacío» como error. */
const TRES: Razonables = { cuantas: 3 };

/** Una sola canción repetida tantas veces: las tomas largas. */
function vueltas(veces: number, texto: string): string {
  return Array<string>(veces).fill(texto).join(' ');
}

/** Todos los compases de una toma con la misma especie: un blues entero en séptimas. */
function todosEn(especie: EspecieDeBloque, texto: string): string {
  return texto
    .split(' ')
    .map((grado) => `${grado}@${especie}`)
    .join(' ');
}

/**
 * El cambio de casa del menor, iv por ii° o al revés: los dos son la subdominante
 * delante del V. **El arreglista lo echó en falta en todos los menús en menor**,
 * así que va como un `debe` propio y no como una alternativa más.
 */
const CAMBIO_DE_CASA = (compas: number, a: 'iv' | 'ii°') =>
  dicho(
    `cambia ${a === 'iv' ? 'la ii° por iv' : 'el iv por ii°'} en el ${compas}`,
    compasEs(compas, a),
  );

// --- El corpus -------------------------------------------------------------------------

export const CORPUS_CIEGO: readonly CasoCiego[] = [
  // --- Funk: un acorde con séptima -------------------------------------------------
  caso({
    id: 'funk-vamp-I7',
    familia: 'funk',
    que: 'vamp de funk en I7',
    mode: 'major',
    kind: 'continuar',
    toma: todosEn('dominant7', 'I I I I'),
    estilo: 'blues',
    estiloReal: 'funk',
    suEstilo: 'funk',
    // «IV7 IV7 I7 I7», «bVII7 IV7 I7», «ii7 V7 I7». Y el IV7 echado en falta: un
    // ii–V que llega con un IVmaj7 delante no es funk.
    debe: [
      o(
        poneComo('IV', 'dominant7'),
        meteElGiro('bVII', 'IV', 'I'),
        y(meteElGiro('ii', 'V', 'I'), loNuevoComoDominantes()),
      ),
    ],
    noDebe: [
      dicho('pone tríadas pegadas a un vamp de I7', no(loNuevoConSeptima())),
      dicho(
        'mete un vii°, un V/iii o el bVI sin estilo que lo pida',
        o(meteElGrado('vii°'), meteElGrado('V/iii'), meteElGrado('bVI')),
      ),
    ],
    aceptable: [loNuevoComoDominantes()],
  }),
  caso({
    id: 'funk-vamp-i7-menor',
    familia: 'funk',
    que: 'vamp de funk en im7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 i@minor7',
    estilo: 'jazz',
    estiloReal: 'funk',
    suEstilo: 'funk',
    // «iv7 iv7 i7», «VII7 i7 / VI7 VII7 i7», «v7 iv7 i7».
    debe: [o(cierraCon('iv', 'i'), cierraCon('VII', 'i'))],
    noDebe: [
      dicho('pone la ii° en tríada', poneComo('ii°', null)),
      TRIADAS,
      dicho('mete el bII sin estilo metal', meteElGrado('bII')),
    ],
  }),
  caso({
    id: 'funk-retocar-I7-IV7',
    familia: 'funk',
    que: 'funk de I7 y IV7',
    mode: 'major',
    kind: 'retocar',
    toma: todosEn('dominant7', 'I IV I IV'),
    estilo: 'blues',
    estiloReal: 'funk',
    suEstilo: 'funk',
    // «I7 IV7 I7 V7», «I7 bVII7 I7 IV7», «otro reparto: I7:8 IV7:8».
    debe: [o(compasEs(4, 'V'), compasEs(2, 'bVII'), esCamino('estirar'))],
    noDebe: [
      dicho('cambia un IV7 por un ii', o(compasEs(2, 'ii'), compasEs(4, 'ii'))),
      dicho('pierde la séptima', no(loNuevoConSeptima())),
      dicho('mete el vi o el iii: cambian la gama de dominantes', o(pasaPor('vi'), pasaPor('iii'))),
    ],
    aceptable: [loNuevoComoDominantes()],
  }),

  // --- R&B: m7, maj7 y ii–V --------------------------------------------------------
  caso({
    id: 'rnb-Imaj7-vi7-ii7-V7',
    familia: 'rnb',
    que: 'R&B, Imaj7 vi7 ii7 V7',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@major7 vi@minor7 ii@minor7 V@dominant7',
    estilo: 'jazz',
    estiloReal: 'r&b',
    // «Imaj7», «iii7 vi7 ii7 V7 Imaj7», «IVmaj7 iv7 Imaj7»: las tres llegan a la I.
    debe: [dicho('llega a Imaj7', sigueCon('I'))],
    noDebe: [
      TRIADAS,
      dicho('mete el bVII→I del rock', meteElGiro('bVII', 'I')),
      dicho('tu V7 va a algo que no es I ni vi', no(o(sigueCon('I'), sigueCon('vi')))),
    ],
  }),
  caso({
    id: 'rnb-ii-V-I-IV',
    familia: 'rnb',
    que: 'R&B, ii7 V7 Imaj7 IVmaj7',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii@minor7 V@dominant7 I@major7 IV@major7',
    estilo: 'pop',
    estiloReal: 'r&b',
    // «iii7 vi7 ii7 V7 Imaj7», «iv7 Imaj7», «viiø V/vi7 vi7».
    debe: [o(meteElGiro('ii', 'V', 'I'), cierraCon('iv', 'I'), meteElGiro('V/vi', 'vi'))],
    noDebe: [
      dicho('pone tríadas sueltas en una canción de cuatríadas', no(loNuevoConSeptima())),
      dicho(
        'cierra IV→I sin más, cuando el idioma es ii–V',
        y(cierraCon('IV', 'I'), no(pasaPor('V'))),
      ),
    ],
  }),
  caso({
    id: 'rnb-retocar-Imaj7-IVmaj7',
    familia: 'rnb',
    que: 'R&B, Imaj7 IVmaj7 dos veces',
    mode: 'major',
    kind: 'retocar',
    toma: todosEn('major7', 'I IV I IV'),
    estilo: 'jazz',
    estiloReal: 'r&b',
    // «Imaj7 IVmaj7 iii7 vi7» o «ii7 V7», «Imaj7 IVmaj7 V/ii7 ii7», «iii7 por I».
    debe: [
      o(
        compasEs(3, 'iii'),
        compasEs(1, 'iii'),
        y(compasEs(3, 'ii'), compasEs(4, 'V')),
        y(compasEs(3, 'V/ii'), compasEs(4, 'ii')),
      ),
    ],
    noDebe: [dicho('mete un bII7 sin un V que sustituir', meteElGrado('bII')), TRIADAS],
  }),
  caso({
    id: 'rnb-menor-i7-iv7-VII7-III',
    familia: 'rnb',
    que: 'R&B en menor, im7 ivm7 VII7 IIImaj7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 iv@minor7 VII@dominant7 III@major7',
    estilo: 'jazz',
    estiloReal: 'r&b',
    // «VImaj7 iiø V7 i7», «VImaj7 V7 i7», «iv7 V7 i7».
    debe: [
      o(cierraCon('VI', 'ii°', 'V', 'i'), cierraCon('VI', 'V', 'i'), cierraCon('iv', 'V', 'i')),
    ],
    // La ii° y la v en tríada son tríadas.
    noDebe: [dicho('pone tríadas: una ii° o una v sin séptima', no(loNuevoConSeptima()))],
  }),

  // --- Country: I–IV–V y el V/V ----------------------------------------------------
  caso({
    id: 'country-I-IV-I-V',
    familia: 'country',
    que: 'country, I IV I V',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV I V',
    estilo: 'folk',
    estiloReal: 'country',
    suEstilo: 'country',
    // «I IV V I», «V/V V I», «IV I V I»: las tres cierran con V→I.
    debe: [cierraCon('V', 'I')],
    noDebe: [encadenaSecundarias()],
    delEstilo: [
      dicho(
        'mete un préstamo oscuro o el tritonal: bVI, bII, iv o bIII',
        o(meteElGrado('bVI'), meteElGrado('bII'), meteElGrado('iv'), meteElGrado('bIII')),
      ),
    ],
  }),
  caso({
    id: 'country-V-de-V',
    familia: 'country',
    que: 'country con la II7: I I II7 V7',
    mode: 'major',
    kind: 'continuar',
    toma: 'I I V/V@dominant7 V@dominant7',
    estilo: 'folk',
    estiloReal: 'country',
    suEstilo: 'country',
    // «I», «I IV V I», «IV I V I».
    debe: [o(sigueCon('I'), y(sigueCon('IV'), cierraCon('V', 'I')))],
    noDebe: [
      // El IV lo da él como buena, y el vi es la cadencia rota: las dos resuelven.
      dicho('tu V7 no resuelve', no(o(sigueCon('I'), sigueCon('IV'), sigueCon('vi')))),
      dicho('se queda colgado en V', y(esCamino('seguir'), no(cierraEnLaTonica()))),
    ],
    // Sin estilo, una canción con secundarias admite el `IV iv I` del gospel (lo pide
    // `gospel-secundarias`, de verificación).
    delEstilo: [dicho('mete el iv o el bVI', o(meteElGrado('iv'), meteElGrado('bVI')))],
  }),
  caso({
    id: 'country-retocar',
    familia: 'country',
    que: 'country, I IV V I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV V I',
    estilo: 'folk',
    estiloReal: 'country',
    suEstilo: 'country',
    // «meter la II7 antes del V», «I vi IV V I», «I IV ii V».
    debe: [o(meteElGiro('V/V', 'V'), meteElGrado('vi'), y(compasEs(3, 'ii'), compasEs(4, 'V')))],
    // El arreglista tachó también el bVII, y en el estilo con que se examina es de la
    // casa: el folk cierra sin sensible —el juez lo pesa como lo de casa
    // (`bVIIDeLaCasa`) y verificación lo pide en `folk-doble-tonica`, `I bVII I
    // bVII`—. Un country que se toca como folk no puede tacharlo; el bVI sí. **Con su
    // estilo sí**: en un country el bVII es de vez en cuando, y el arreglista lo tachó.
    delSuyo: [dicho('mete el bVII en un country', meteElGrado('bVII'))],
    noDebe: [
      dicho('mete el bVI en un country', meteElGrado('bVI')),
      BII,
      dicho('cambia el V por iii', compasEs(3, 'iii')),
    ],
  }),

  // --- Reggae: I–IV a contratiempo, a dos pulsos ------------------------------------
  caso({
    id: 'reggae-I-IV-2pulsos',
    familia: 'reggae',
    que: 'reggae, I IV a dos pulsos',
    mode: 'major',
    kind: 'continuar',
    toma: vueltas(4, 'I:2 IV:2'),
    estilo: 'pop',
    estiloReal: 'reggae',
    suEstilo: 'reggae',
    // «V:2 IV:2 I:4», «ii:2 V:2 I:4», «vi:2 IV:2 V:2 I:2».
    debe: [y(loNuevoVaA(2), cierraEnLaTonica())],
    noDebe: [dicho('pasa a acordes de compás entero sin decirlo', no(loNuevoVaA(2))), BII],
  }),
  caso({
    id: 'reggae-menor-i-VII',
    familia: 'reggae',
    que: 'reggae en menor, i VII a dos pulsos',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i:2 VII:2 i:2 VII:2',
    estilo: 'rock',
    estiloReal: 'reggae',
    suEstilo: 'reggae',
    // «VI:2 VII:2 i:4», «iv:2 VII:2 i:4», «iv:2 v:2 i:4».
    debe: [y(loNuevoVaA(2), o(cierraCon('VII', 'i'), cierraCon('v', 'i')))],
    noDebe: [dicho('mete la ii°', meteElGrado('ii°')), BII],
    aceptable: [dicho('lo nuevo sigue a dos pulsos', loNuevoVaA(2))],
    // «V con sensible a todo trapo (no es imposible pero suena a otra música)»: no
    // está prohibida, pero no puede ser lo primero que se ofrece.
    primera: [no(meteLaSensible(), 'la primera no trae la V con sensible')],
  }),
  caso({
    id: 'reggae-retocar-I-V-vi-IV',
    familia: 'reggae',
    que: 'reggae, I V vi IV a dos pulsos, dos vueltas',
    mode: 'major',
    kind: 'retocar',
    toma: vueltas(2, 'I:2 V:2 vi:2 IV:2'),
    estilo: 'pop',
    estiloReal: 'reggae',
    suEstilo: 'reggae',
    // «IV:2 V:2 al final», «iii por V», «otro reparto a compás entero».
    debe: [o(cierraCon('IV', 'V'), cierraCon('V', 'I'), meteElGrado('iii'), mismosAcordesA(4))],
    // Romper la paridad de dos pulsos —un 1 o un 3 suelto— es `NUNCA`.
    noDebe: [BII],
  }),

  // --- Cantautor: bajadas cromáticas -------------------------------------------------
  caso({
    id: 'cantautor-I-iii-bIII-ii',
    familia: 'cantautor',
    que: 'cantautor que baja por I iii bIII ii',
    mode: 'major',
    kind: 'continuar',
    toma: 'I iii bIII ii',
    estilo: 'folk',
    estiloReal: 'cantautor',
    // «V I» (el ii pide el V), «V/V V I», «IV V I».
    debe: [y(o(sigueCon('V'), sigueCon('V/V'), sigueCon('IV')), cierraCon('V', 'I'))],
    noDebe: [
      dicho('tu ii va a iii o a vi sin pasar por V', o(sigueCon('iii'), sigueCon('vi'))),
      dicho('mete una retrogresión', o(meteElGiro('V', 'IV'), meteElGiro('V', 'ii'))),
      BII,
    ],
  }),
  caso({
    id: 'cantautor-I-Vvi-vi-VV',
    familia: 'cantautor',
    que: 'cantautor, I III7 vi II7',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V/vi vi V/V',
    estilo: 'folk',
    estiloReal: 'cantautor',
    // «V I», «V vi IV V I», «IV V I».
    debe: [y(o(sigueCon('V'), sigueCon('IV')), cierraCon('V', 'I'))],
    noDebe: [dicho('mete bVI→bVII', meteElGiro('bVI', 'bVII'))],
    // «V/V que no va a V (ni a IV como mínimo)».
    tolera: ['IV'],
  }),
  caso({
    id: 'cantautor-IV-iv-I',
    familia: 'cantautor',
    que: 'cantautor con el plagal menor, I IV iv I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV iv I',
    estilo: 'folk',
    estiloReal: 'cantautor',
    // «I vi IV iv I», «IV:8 iv I», «I IV bVII I».
    debe: [o(meteElGrado('vi'), esCamino('estirar'), compasEs(3, 'bVII'))],
    noDebe: [
      dicho('quita el iv y deja IV IV', y(compasEs(2, 'IV'), compasEs(3, 'IV'))),
      dicho('mete el sustituto tritonal', meteElGrado('bII')),
    ],
    aceptable: [no(pierdeElPrestado(), 'conserva algo del color prestado')],
  }),
  caso({
    id: 'cantautor-menor-bajada',
    familia: 'cantautor',
    que: 'cantautor en menor, i v VI III',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i v VI III',
    estilo: 'folk',
    estiloReal: 'cantautor',
    // «iv V i», «iv i», «VII i / iv VII III».
    debe: [
      o(
        cierraCon('iv', 'V', 'i'),
        cierraCon('iv', 'i'),
        cierraCon('VII', 'i'),
        meteElGiro('iv', 'VII', 'III'),
      ),
    ],
    noDebe: [dicho('mete la ii° en tríada en un folk', poneComo('ii°', null)), BII],
  }),

  // --- Latin y bolero: ii°–V–i ---------------------------------------------------------
  caso({
    id: 'latin-i-iv-ii-V',
    familia: 'latin',
    que: 'latin en menor, im7 ivm7 iiø7 V7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 iv@minor7 ii°@halfDiminished7 V@dominant7',
    estilo: 'jazz',
    estiloReal: 'bossa/latin',
    // «i7», «VImaj7 iiø V7 i», «V/iv7 iv7 V7 i».
    debe: [o(sigueCon('i'), cierraCon('VI', 'ii°', 'V', 'i'), cierraCon('V/iv', 'iv', 'V', 'i'))],
    noDebe: [
      dicho('cierra con la v menor', cierraCon('v', 'i')),
      dicho('mete el VII→i del rock detrás de tu V7', meteElGiro('VII', 'i')),
      TRIADAS,
    ],
  }),
  caso({
    id: 'bolero-i-i-Viv-iv',
    familia: 'latin',
    que: 'bolero, im im I7 ivm',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i i V/iv@dominant7 iv',
    estilo: 'jazz',
    estiloReal: 'bolero',
    suEstilo: 'bolero',
    // «ii° V i», «VI V i», «iv V i / V i».
    debe: [cierraCon('V', 'i')],
    noDebe: [
      dicho('mete el VII→i del rock en un bolero', meteElGiro('VII', 'i')),
      dicho('cierra en III', cierraCon('III')),
    ],
  }),
  caso({
    id: 'latin-retocar-i-ii-V-i',
    familia: 'latin',
    que: 'latin, i ii° V i',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i ii° V i',
    estilo: 'jazz',
    estiloReal: 'latin',
    // «i ii° bII i», «i VI ii° V». Y «i iv V i», el cambio de casa.
    debe: [
      o(compasEs(3, 'bII'), y(compasEs(2, 'VI'), compasEs(3, 'ii°'), compasEs(4, 'V'))),
      CAMBIO_DE_CASA(2, 'iv'),
    ],
    noDebe: [
      dicho('cambia el V por la v antes de la i', compasEs(3, 'v')),
      dicho('cambia el V por el VII', compasEs(3, 'VII')),
    ],
  }),

  // --- Cine: bVI–bVII–I y el iv ----------------------------------------------------------
  caso({
    id: 'cine-I-bVI-bVII-I',
    familia: 'cine',
    que: 'cine, I bVI bVII I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I bVI bVII I',
    estilo: 'rock',
    estiloReal: 'cine',
    suEstilo: 'cine',
    // «iv I / IV iv I», «bIII bVI bVII I», «bVI bVII I otra vez».
    debe: [
      o(
        cierraCon('iv', 'I'),
        meteElGiro('bIII', 'bVI', 'bVII', 'I'),
        cierraCon('bVI', 'bVII', 'I'),
      ),
    ],
    noDebe: [
      dicho('mete el V/iii o el V/ii', o(meteElGrado('V/iii'), meteElGrado('V/ii'))),
      dicho('mete el sustituto tritonal', meteElGrado('bII')),
    ],
  }),
  caso({
    id: 'cine-I-iv-heroico',
    familia: 'cine',
    que: 'cine heroico, I iv I iv',
    mode: 'major',
    kind: 'continuar',
    toma: 'I iv I iv',
    estilo: 'rock',
    estiloReal: 'cine',
    suEstilo: 'cine',
    // «bVI bVII I», «bIII iv I», «IV iv I».
    debe: [
      o(cierraCon('bVI', 'bVII', 'I'), cierraCon('bIII', 'iv', 'I'), cierraCon('IV', 'iv', 'I')),
    ],
    noDebe: [
      dicho('tu iv va al V/V', meteElGiro('iv', 'V/V')),
      dicho('mete secundarias de jazz', meteUnaSecundaria()),
    ],
  }),
  caso({
    id: 'cine-menor-i-VI-III-VII',
    familia: 'cine',
    que: 'cine en menor, i VI III VII',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VI III VII',
    estilo: 'metal',
    estiloReal: 'cine',
    suEstilo: 'cine',
    // «i VI III V», «i VI iv VII», «i bII…».
    debe: [o(compasEs(4, 'V'), compasEs(3, 'iv'), meteElGrado('bII'))],
    noDebe: [
      dicho('pone la ii° en tríada', poneComo('ii°', null)),
      dicho('rompe la línea del bajo con un V/V', meteElGrado('V/V')),
    ],
  }),

  // --- Pop de cuatro acordes en menor ---------------------------------------------------
  caso({
    id: 'popm-i-VI-III-VII',
    familia: 'pop-menor',
    que: 'pop en menor, i VI III VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI III VII',
    estilo: 'pop',
    // «i», «VI VII i», «iv VII i / iv V i».
    debe: [
      o(
        sigueCon('i'),
        cierraCon('VI', 'VII', 'i'),
        cierraCon('iv', 'VII', 'i'),
        cierraCon('iv', 'V', 'i'),
      ),
    ],
    // El «V/iv suelto» es la secundaria que no resuelve, que se mira en todos.
    noDebe: [dicho('mete la ii°', meteElGrado('ii°')), BII],
  }),
  caso({
    id: 'popm-estribillo-i-VII-VI-VII',
    familia: 'pop-menor',
    que: 'estribillo en menor, i VII VI VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII VI VII',
    papel: 'estribillo',
    estilo: 'pop',
    // «i VII VI VII i», «VI VII i», «iv VI VII i».
    debe: [
      o(
        y(repiteLoTuyo(), cierraEnLaTonica()),
        cierraCon('VI', 'VII', 'i'),
        cierraCon('iv', 'VI', 'VII', 'i'),
      ),
    ],
    noDebe: [dicho('mete la ii°', meteElGrado('ii°'))],
  }),
  caso({
    id: 'popm-retocar-VI-VII-i-i',
    familia: 'pop-menor',
    que: 'pop en menor que llega, VI VII i i',
    mode: 'minor',
    kind: 'retocar',
    toma: 'VI VII i i',
    estilo: 'pop',
    // «VI VII i III», «iv VII i i», «VI V i i».
    debe: [o(compasEs(4, 'III'), compasEs(1, 'iv'), compasEs(2, 'V'))],
    noDebe: [dicho('toca la llegada a la i', no(compasEs(3, 'i'))), BII],
  }),

  // --- Seis por ocho y vals --------------------------------------------------------------
  caso({
    id: 'balada68-I-vi-IV-V',
    familia: 'ternario',
    que: 'balada en 6/8, I vi IV V',
    mode: 'major',
    kind: 'continuar',
    toma: 'I vi IV V',
    pulsos: 6,
    pulsosPorCompas: 6,
    papel: 'estrofa',
    estilo: 'pop',
    // «I:6», «I vi IV V I a 6», «IV:6 V:6 I:12». Los compases de cuatro pulsos y
    // las frases de tres o cinco son `NUNCA`.
    debe: [y(cierraEnLaTonica(), loNuevoVaA(6))],
    aceptable: [dicho('lo nuevo va a compás de 6/8', loNuevoVaA(6))],
  }),
  caso({
    id: 'vals-I-I-IV-I-V-V-I-I',
    familia: 'ternario',
    que: 'vals de ocho compases',
    mode: 'major',
    kind: 'continuar',
    toma: 'I I IV I V V I I',
    pulsos: 3,
    pulsosPorCompas: 3,
    estilo: 'folk',
    // «IV IV I I V V I I», «vi vi ii ii V V I I», «V/V V I».
    debe: [o(y(alarga(8), cierraCon('V', 'I')), meteElGiro('V/V', 'V', 'I'))],
    noDebe: [
      dicho('añade algo que no es una frase de 4 u 8', no(respetaFrasesDe(4))),
      dicho('sigue en la tónica en la que ya está: de tónica a tónica', sigueCon('I')),
    ],
    aceptable: [dicho('lo nuevo va a compás de vals', loNuevoVaA(3))],
  }),
  caso({
    id: 'balada68-menor-retocar',
    familia: 'ternario',
    que: 'balada en menor en 6/8, i iv V i',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv V i',
    pulsos: 6,
    pulsosPorCompas: 6,
    estilo: 'folk',
    // «i VI V i», «i iv VII III» (no cierra, dice él), y «i ii° V i».
    debe: [
      o(compasEs(2, 'VI'), y(compasEs(3, 'VII'), compasEs(4, 'III'))),
      CAMBIO_DE_CASA(2, 'ii°'),
    ],
    noDebe: [
      dicho('reparte en pulsos que no son múltiplo de 3', no(loNuevoEnMultiplosDe(3))),
      dicho('cambia el V por la v en la cadencia', compasEs(3, 'v')),
    ],
  }),

  // --- Secundarias encadenadas --------------------------------------------------------------
  caso({
    id: 'secundarias-cadena-jazz',
    familia: 'secundarias',
    que: 'la cadena Imaj7 III7 VI7 II7',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@major7 V/vi@dominant7 V/ii@dominant7 V/V@dominant7',
    estilo: 'jazz',
    // «V7 Imaj7», «V7 I con sus cuatríadas», «bII7 Imaj7». Que el II7 vaya al V o
    // al bII es la secundaria que resuelve, que se mira en todos.
    debe: [o(y(sigueCon('V'), meteElGiro('V', 'I')), y(sigueCon('bII'), meteElGiro('bII', 'I')))],
    // El arreglista tachó también el iv, y el `IV iv I` es idioma de jazz: lo pide el
    // de verificación en su puerta de atrás («IVmaj7 iv7 I») y en un gospel de
    // secundarias, y el juez lo tiene entre los giros del jazz. El bVI sí es de otra
    // casa: la escalera del rock en medio de una cadena de dominantes.
    noDebe: [TRIADAS, dicho('mete el bVI', meteElGrado('bVI'))],
  }),
  caso({
    id: 'secundarias-retocar-I-vi-ii-V',
    familia: 'secundarias',
    que: 'jazz, Imaj7 vi7 ii7 V7',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@major7 vi@minor7 ii@minor7 V@dominant7',
    estilo: 'jazz',
    // «I VI7 ii V», «I vi II7 V», «I vi ii bII».
    debe: [o(compasEs(2, 'V/ii'), compasEs(3, 'V/V'), compasEs(4, 'bII'))],
    noDebe: [TRIADAS, dicho('mete el bVII del rock', meteElGrado('bVII'))],
  }),
  caso({
    id: 'secundarias-menor-cadena',
    familia: 'secundarias',
    que: 'menor con secundarias, i I7 iv II7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i V/iv@dominant7 iv V/V@dominant7',
    // «V i», «V i iv V i», «V VI iv V i» (rota).
    debe: [y(sigueCon('V'), cierraCon('V', 'i'))],
    noDebe: [dicho('mete el VII→i', meteElGiro('VII', 'i'))],
  }),

  // --- La relativa -------------------------------------------------------------------------
  caso({
    id: 'relativa-mayor-a-vi',
    familia: 'relativa',
    que: 'mayor que se va a la relativa, I IV III7 vi',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV V/vi vi',
    estilo: 'pop',
    // «IV V I», «ii V I», «IV I V I»: volver a casa.
    debe: [cierraCon('V', 'I')],
    noDebe: [
      dicho('se queda en vi y lo llama cierre', y(esCamino('seguir'), cierraCon('vi'))),
      dicho('mete el V/iii', meteElGrado('V/iii')),
    ],
  }),
  caso({
    id: 'relativa-menor-a-III',
    familia: 'relativa',
    que: 'menor que se va a la relativa, i iv VII III',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i iv VII III',
    estilo: 'pop',
    // «VI ii° V i», «VI V i», «iv V i».
    debe: [
      o(cierraCon('VI', 'ii°', 'V', 'i'), cierraCon('VI', 'V', 'i'), cierraCon('iv', 'V', 'i')),
    ],
    noDebe: [dicho('cierra en III', y(esCamino('seguir'), cierraCon('III'))), BII],
  }),
  caso({
    id: 'relativa-retocar-vi-tonicizado',
    familia: 'relativa',
    que: 'ocho compases con el vi tonicalizado',
    mode: 'major',
    kind: 'retocar',
    toma: 'I vi V/vi vi IV V I I',
    estilo: 'pop',
    // «dejar el V/vi y cambiar el IV por ii», «iii por V/vi», «V/V antes del V».
    debe: [o(y(compasEs(3, 'V/vi'), compasEs(5, 'ii')), compasEs(3, 'iii'), compasEs(5, 'V/V'))],
    noDebe: [dicho('quita la llegada final a la I', no(cierraEnLaTonica())), BII],
  }),

  // --- Estribillos que empiezan en IV ------------------------------------------------------
  caso({
    id: 'estribillo-IV-V-iii-vi',
    familia: 'estribillo-IV',
    que: 'estribillo IV V iii vi',
    mode: 'major',
    kind: 'continuar',
    toma: 'IV V iii vi',
    papel: 'estribillo',
    estilo: 'pop',
    // «IV V I», «ii V I», «IV V iii vi IV V I».
    debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'))],
    noDebe: [BII, dicho('cierra en vi', y(esCamino('seguir'), cierraCon('vi')))],
  }),
  caso({
    id: 'estribillo-IV-I-V-vi',
    familia: 'estribillo-IV',
    que: 'estribillo de rock IV I V vi',
    mode: 'major',
    kind: 'continuar',
    toma: 'IV I V vi',
    papel: 'estribillo',
    estilo: 'rock',
    // «IV I V I», «IV V I», «IV bVII I».
    debe: [y(sigueCon('IV'), o(cierraCon('V', 'I'), cierraCon('bVII', 'I')))],
    noDebe: [dicho('mete el vii°', meteElGrado('vii°')), encadenaSecundarias()],
  }),

  // --- Pre que acaba en V ------------------------------------------------------------------
  caso({
    id: 'pre-ii-iii-IV-V',
    familia: 'pre',
    que: 'pre que sube a la dominante, ii iii IV V',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii iii IV V',
    papel: 'pre',
    estilo: 'pop',
    // «I» (la llegada del estribillo), «I V vi IV», «IV V I».
    debe: [o(sigueCon('I'), cierraCon('IV', 'V', 'I'))],
    // El arreglista tachó también el iv, y en este mismo pre de pop —`ii iii IV V`,
    // con el mismo papel y el mismo estilo— el de verificación lo pide: «iv en lugar
    // de IV» (`pre-estribillo`). En pop el `IV iv I` es de manual; el bVI, no.
    noDebe: [
      dicho('otro contraste antes del estribillo', esCamino('contraste')),
      dicho('mete el bVI', meteElGrado('bVI')),
    ],
  }),
  caso({
    id: 'pre-menor-iv-VI-V-V',
    familia: 'pre',
    que: 'pre en menor, iv VI V V',
    mode: 'minor',
    kind: 'continuar',
    toma: 'iv VI V V',
    papel: 'pre',
    estilo: 'rock',
    // «i», «i VI III VII», «i iv V i».
    debe: [sigueCon('i')],
    noDebe: [
      dicho('tu V va a III o a VII', o(sigueCon('III'), sigueCon('VII'))),
      dicho('mete la ii°', meteElGrado('ii°')),
    ],
  }),

  // --- Puentes en vi -----------------------------------------------------------------------
  caso({
    id: 'puente-vi-IV-vi-V',
    familia: 'puente',
    que: 'puente vi IV vi V',
    mode: 'major',
    kind: 'continuar',
    toma: 'vi IV vi V',
    papel: 'puente',
    estilo: 'pop',
    // «I» (vuelta al estribillo), «V/V V I», «IV V I».
    debe: [o(sigueCon('I'), cierraCon('V/V', 'V', 'I'), cierraCon('IV', 'V', 'I'))],
    noDebe: [dicho('contrasta después de un puente', esCamino('contraste')), BII],
  }),
  caso({
    id: 'puente-retocar-vi-iii-IV-V',
    familia: 'puente',
    que: 'puente de rock vi iii IV V',
    mode: 'major',
    kind: 'retocar',
    toma: 'vi iii IV V',
    papel: 'puente',
    estilo: 'rock',
    // «vi iii IV bVII», «vi V/vi vi iii IV V» (con duda), «vi IV:8 V».
    debe: [o(compasEs(4, 'bVII'), compasEs(2, 'V/vi'), compasEs(2, 'IV'))],
    noDebe: [
      dicho('acaba en I: un puente no cierra', cierraEnLaTonica()),
      dicho('mete el sustituto tritonal', meteElGrado('bII')),
    ],
  }),

  // --- Finales y codas -----------------------------------------------------------------------
  caso({
    id: 'final-plagal-pop',
    familia: 'final',
    que: 'final de pop que acaba en IV',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi IV',
    papel: 'final',
    estilo: 'pop',
    // «I» (el amén), «iv I», «V I / bVI bVII I».
    debe: [
      o(sigueCon('I'), cierraCon('iv', 'I'), cierraCon('V', 'I'), cierraCon('bVI', 'bVII', 'I')),
    ],
    noDebe: [
      dicho('contrasta después del final', esCamino('contraste')),
      dicho('deja el final abierto', no(cierraEnLaTonica())),
    ],
  }),
  caso({
    id: 'final-gospel-I7-IV-iv',
    familia: 'final',
    que: 'final de gospel, I I7 IV iv I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I I@dominant7 IV iv I:8',
    papel: 'final',
    estilo: 'blues',
    estiloReal: 'gospel',
    // «dejar IV iv I», «I I7 IV iv I con otro reparto», «ii por IV». Cambiar el I7
    // por un vi es `pierdeLaSecundaria`, y «cuadra lo desigual» sobre la tónica
    // sostenida, `diceAlgoFalso`: los dos se miran en todos.
    debe: [
      o(
        y(compasEs(3, 'IV'), compasEs(4, 'iv'), cierraEnLaTonica()),
        esCamino('estirar'),
        compasEs(3, 'ii'),
      ),
    ],
    noDebe: [
      dicho('quita la I del final', no(cierraEnLaTonica())),
      dicho('cierra V→I y quita el plagal', cierraCon('V', 'I')),
    ],
  }),
  caso({
    id: 'coda-pop',
    familia: 'final',
    que: 'coda de pop que acaba en V',
    mode: 'major',
    kind: 'continuar',
    toma: 'I vi IV V',
    papel: 'final',
    estilo: 'pop',
    // «I», «vi IV V I», «bVI bVII I».
    debe: [o(sigueCon('I'), cierraCon('vi', 'IV', 'V', 'I'), cierraCon('bVI', 'bVII', 'I'))],
    noDebe: [dicho('pone un contraste o un puente después del final', esCamino('contraste'))],
  }),
  caso({
    id: 'coda-menor',
    familia: 'final',
    que: 'coda en menor, i VI VII i',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI VII i',
    papel: 'final',
    estilo: 'rock',
    // «iv i», «VI VII i», «iv V i».
    debe: [o(cierraCon('iv', 'i'), cierraCon('VI', 'VII', 'i'), cierraCon('iv', 'V', 'i'))],
    noDebe: [
      dicho('sigue en la tónica en la que ya está: de tónica a tónica', sigueCon('i')),
      dicho('contrasta en un final', esCamino('contraste')),
    ],
  }),

  // --- Todo dudoso ---------------------------------------------------------------------------
  caso({
    id: 'dudoso-todo-continuar',
    familia: 'dudoso',
    que: 'una toma entera dudosa, I IV V I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I? IV? V? I?',
    // «al menos tres salidas sencillas», «I IV V I», «vi IV V I». Y «ii V I», que
    // el arreglista no escribió y es lo mismo, como dice el corpus del equipo de
    // `un-acorde`: el ii y el IV son la misma subdominante delante del V, y `IV ii V I`
    // es `IV V I` con la subdominante desplegada. Nada raro encima de lo dudoso.
    debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'))],
    noDebe: [
      dicho(
        'construye con algo raro encima de una toma dudosa',
        o(
          meteUnaSecundaria(),
          meteElGrado('bII'),
          meteElGrado('bIII'),
          meteElGrado('iv'),
          meteElGrado('bVI'),
          meteElGrado('bVII'),
          meteElGrado('vii°'),
        ),
      ),
    ],
    razonables: TRES,
  }),
  caso({
    id: 'dudoso-retocar',
    familia: 'dudoso',
    que: 'vi IV I V con tres compases dudosos',
    mode: 'major',
    kind: 'retocar',
    toma: 'vi? IV I? V?',
    estilo: 'pop',
    // «cambiar lo dudoso por lo más probable (vi↔I, iii)», «otro reparto», «otro final».
    debe: [
      o(
        y(
          cambiaLoDudoso(),
          o(compasEs(1, 'I'), compasEs(1, 'iii'), compasEs(3, 'vi'), compasEs(3, 'iii')),
        ),
        esCamino('estirar'),
        esCamino('otro-final'),
      ),
    ],
    razonables: TRES,
  }),

  // --- Punteos que marcan tercera o séptima --------------------------------------------------
  caso({
    id: 'punteo-terceras-mayor',
    familia: 'punteo',
    que: 'I IV V I con el punteo en las terceras: Mi, La, Si y Do fuertes',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV V I',
    punteo: ['4F 7', '9F 5', '11F 2', '0F 4'],
    estilo: 'pop',
    // «vi por I» (con el Mi o con el Do), «ii por IV» (con el La), «iii por V» (con el Si).
    debe: [o(compasEs(1, 'vi'), compasEs(4, 'vi'), compasEs(2, 'ii'), compasEs(3, 'iii'))],
    noDebe: [
      chocaConElPunteoDondeSuena(),
      dicho('iv por IV: el La contra el Lab', compasEs(2, 'iv')),
      dicho('bVII por V: el Si contra el Sib', compasEs(3, 'bVII')),
      dicho(
        'bVI o bIII por I: el Mi contra el Mib',
        o(compasEs(1, 'bVI'), compasEs(1, 'bIII'), compasEs(4, 'bVI'), compasEs(4, 'bIII')),
      ),
    ],
  }),
  caso({
    id: 'punteo-sensible-menor',
    familia: 'punteo',
    que: 'i iv V i con la sensible fuerte en el V',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv V i',
    punteo: ['3F 0', '8F 5', '11F 2', '0F 3'],
    estilo: 'pop',
    // «VI por i» (con el Do o con el La), «ii° por iv» (con el Fa), «iv VI V i?».
    debe: [o(compasEs(1, 'VI'), compasEs(4, 'VI')), CAMBIO_DE_CASA(2, 'ii°')],
    noDebe: [
      chocaConElPunteoDondeSuena(),
      dicho('v por V: el Sol contra el Sol#', compasEs(3, 'v')),
      dicho('VII por V: el Sol contra el Sol#', compasEs(3, 'VII')),
    ],
  }),
  caso({
    id: 'punteo-septimas-jazz',
    familia: 'punteo',
    que: 'ii7 V7 Imaj7 con el punteo en las séptimas',
    mode: 'major',
    kind: 'retocar',
    toma: 'ii@minor7 V@dominant7 I@major7 I@major7',
    punteo: ['0F 5', '5F 11', '11F 7', '4F 0'],
    estilo: 'jazz',
    // «bII7 por V» (comparte Fa y Si), «II7 por ii» (con el Do de séptima), «vi7 en el 4».
    debe: [o(compasEs(2, 'bII'), compasEs(1, 'V/V'), compasEs(4, 'vi'))],
    noDebe: [
      chocaConElPunteoDondeSuena(),
      dicho('IV por I con el Si fuerte', compasEs(3, 'IV')),
      dicho('bVII por V: el Si contra el Sib', compasEs(2, 'bVII')),
    ],
  }),
  caso({
    id: 'punteo-continuar-tercera',
    familia: 'punteo',
    que: 'I vi IV V con el punteo en las terceras, para continuar',
    mode: 'major',
    kind: 'continuar',
    toma: 'I vi IV V',
    punteo: ['4F', '0F', '9F', '11F'],
    estilo: 'pop',
    // «I», «vi IV V I», «IV V I». Lo nuevo no tiene punteo, así que nada choca.
    debe: [o(sigueCon('I'), cierraCon('vi', 'IV', 'V', 'I'), cierraCon('IV', 'V', 'I'))],
    noDebe: [chocaConElPunteoDondeSuena()],
  }),

  // --- Canciones largas ------------------------------------------------------------------------
  caso({
    id: 'larga-16-pop',
    familia: 'larga',
    que: 'dieciséis compases de I V vi IV',
    mode: 'major',
    kind: 'continuar',
    toma: vueltas(4, 'I V vi IV'),
    estilo: 'pop',
    // «I», «ii V I / V I», «una parte de 4 que contraste». Las frases de tres son `NUNCA`.
    debe: [o(sigueCon('I'), cierraCon('V', 'I'), y(esCamino('contraste'), alarga(4)))],
    noDebe: [duraMasDe(32)],
  }),
  caso({
    id: 'larga-24-blues',
    familia: 'larga',
    que: 'dos coros de blues con turnaround',
    mode: 'major',
    kind: 'continuar',
    toma: todosEn('dominant7', vueltas(2, 'I I I I IV IV I I V IV I V')),
    estilo: 'blues',
    // «I7», «I7 IV7 I7 V7 … I7», «I7 IV7 I7»: llegar desde el turnaround.
    debe: [sigueCon('I')],
    noDebe: [
      TRIADAS,
      dicho('mete un ii–V de jazz', meteElGiro('ii', 'V')),
      dicho('mete el vi o el iii', o(meteElGrado('vi'), meteElGrado('iii'))),
    ],
    aceptable: [loNuevoComoDominantes()],
  }),
  caso({
    id: 'larga-31-rock',
    familia: 'larga',
    que: 'treinta y un compases de rock que acaban en IV',
    mode: 'major',
    kind: 'continuar',
    toma: `${vueltas(4, 'I bVII IV I')} ${vueltas(2, 'vi IV I V')} I bVII IV I I bVII IV`,
    estilo: 'rock',
    // «I», el único que cabe.
    debe: [sigueCon('I')],
    razonables: {
      cuantas: 1,
      porque: 'a treinta y un compases solo cabe uno más: la I que llega',
    },
  }),
  caso({
    id: 'larga-32-retocar',
    familia: 'larga',
    que: 'treinta y dos compases en menor',
    mode: 'minor',
    kind: 'retocar',
    toma: `${vueltas(4, 'i VI III VII')} iv VI VII i iv VI V V i VI III VII i VI V i`,
    estilo: 'pop',
    // «rearmonizar algo del medio», «otro final», «otro reparto».
    debe: [
      o(
        y(esCamino('rearmonizar'), cambiaAlgunoEntre(2, 31)),
        esCamino('otro-final'),
        esCamino('estirar'),
      ),
    ],
    // «Sale de los 32 compases» es pasarse del tope, no cambiar el largo: estaba
    // escrito como «no dura 32», y eso tachaba todo `estirar` —a doble tiempo son
    // dieciséis, a medio tiempo sesenta y cuatro— cuando «otro reparto» es una de
    // sus tres respuestas. Es lo mismo que pide `larga-16-pop`.
    noDebe: [dicho('sale de los 32 compases', duraMasDe(32))],
    razonables: TRES,
  }),

  // --- Casos límite ------------------------------------------------------------------------------
  caso({
    id: 'limite-1-compas-I',
    familia: 'limite',
    que: 'un compás de I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I',
    // «IV V I», «vi IV V I», «V I».
    debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('V', 'I'))],
    razonables: TRES,
  }),
  caso({
    id: 'limite-1-compas-V',
    familia: 'limite',
    que: 'un compás de V',
    mode: 'major',
    kind: 'continuar',
    toma: 'V',
    // «I», «vi IV V I», «IV I».
    debe: [o(sigueCon('I'), cierraCon('vi', 'IV', 'V', 'I'), cierraCon('IV', 'I'))],
    razonables: TRES,
  }),
  caso({
    id: 'limite-2-iguales-vi',
    familia: 'limite',
    que: 'dos compases de vi',
    mode: 'major',
    kind: 'continuar',
    toma: 'vi vi',
    // «IV V I», «ii V I», «IV I».
    debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'), cierraCon('IV', 'I'))],
    razonables: TRES,
  }),
  caso({
    id: 'limite-fuera-bII',
    familia: 'limite',
    que: 'I y el napolitano',
    mode: 'major',
    kind: 'continuar',
    toma: 'I bII',
    // «I» (el napolitano a casa), «V I», «bII V I».
    debe: [o(sigueCon('I'), cierraCon('V', 'I'))],
    noDebe: [
      dicho('tu bII va a algo sin sentido', no(o(sigueCon('I'), sigueCon('V'), sigueCon('bII')))),
    ],
    razonables: TRES,
  }),
  caso({
    id: 'limite-1-compas-i-retocar',
    familia: 'limite',
    que: 'un compás de i, para retocar',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i',
    // «otro reparto», «i por VI o III» (sin final), «un mensaje claro si no hay
    // nada». La frase falsa sobre «cierra» es `diceAlgoFalso`.
    debe: [esCamino('estirar')],
    razonables: {
      cuantas: 1,
      porque: 'un acorde solo no se retoca sin tocar su único compás: cabe estirarlo y poco más',
    },
  }),
  caso({
    id: 'limite-V-iii-raro',
    familia: 'limite',
    que: 'I y la dominante del iii',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V/iii',
    estilo: 'pop',
    // «iii vi ii V I», «iii IV V I», «iii vi IV V».
    debe: [sigueCon('iii')],
    // «V/iii que no va a iii (o a vi como mucho)».
    tolera: ['vi'],
    razonables: TRES,
  }),
];

// --- Los menús que se examinan ------------------------------------------------------------

/** Lo que se pide de la petición para la que no se escribió el caso: nada, y no se examina. */
const SIN_EXAMEN: LoQueSeExige = { debe: [], noDebe: [] };

/** Una petición de un caso, con el contexto con que se pide: lo que da un menú. */
export interface ExamenCiego {
  readonly caso: CasoExigible & { readonly familia: FamiliaCiega };
  readonly kind: PathKind;
}

/**
 * Los menús que se examinan: cada caso por su petición, **y dos veces** los de un
 * estilo que `styles.ts` no tenía, sin estilo y con el más cercano. Sus nombres lo
 * dicen: `funk-vamp-I7/sin-estilo` y `funk-vamp-I7/blues`. **Y tres** los de un
 * estilo que ya tiene (`suEstilo`): la tercera con el suyo, `funk-vamp-I7/funk`.
 */
export function examenesCiegos(corpus: readonly CasoCiego[] = CORPUS_CIEGO): ExamenCiego[] {
  return corpus.flatMap((caso) => {
    const conEstilo = {
      ...(caso.estilo === undefined ? {} : { estilo: caso.estilo }),
      ...caso.contexto,
    };
    // Un estilo de verdad va siempre con el más cercano: lo comprueba el test.
    const variantes: { id: string; que: string; contexto: ContextoDeSalidas; suyo?: true }[] =
      caso.estiloReal === undefined
        ? [{ id: caso.id, que: caso.que, contexto: conEstilo }]
        : [
            {
              id: `${caso.id}/sin-estilo`,
              que: `${caso.que} (${caso.estiloReal}, sin estilo)`,
              contexto: caso.contexto,
            },
            {
              id: `${caso.id}/${caso.estilo!}`,
              que: `${caso.que} (${caso.estiloReal}, con el estilo ${caso.estilo!})`,
              contexto: conEstilo,
            },
            ...(caso.suEstilo === undefined
              ? []
              : [
                  {
                    id: `${caso.id}/${caso.suEstilo}`,
                    que: `${caso.que} (con su estilo, ${caso.suEstilo})`,
                    contexto: { estilo: caso.suEstilo, ...caso.contexto },
                    suyo: true as const,
                  },
                ]),
          ];
    return variantes.map(({ id, que, contexto, suyo }) => {
      // Lo que depende del estilo solo se pide con él, y lo que depende del de verdad,
      // solo con el de verdad.
      const delEstilo = contexto.estilo === undefined ? [] : (caso.delEstilo ?? []);
      const delSuyo = suyo === true ? (caso.delSuyo ?? []) : [];
      const espera: LoQueSeExige =
        delEstilo.length + delSuyo.length === 0
          ? caso.espera
          : { ...caso.espera, noDebe: [...delSuyo, ...delEstilo, ...caso.espera.noDebe] };
      return {
        kind: caso.kind,
        caso: {
          id,
          familia: caso.familia,
          que,
          mode: caso.mode,
          compases: caso.compases,
          contexto,
          continuar: caso.kind === 'continuar' ? espera : SIN_EXAMEN,
          ...(caso.kind === 'retocar' ? { retocar: espera } : {}),
        },
      };
    });
  });
}
