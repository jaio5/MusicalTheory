/**
 * El corpus final: **50 canciones a medias escritas antes de ejecutar nada y sin
 * abrir los otros tres corpus**, como medida ciega de cierre. Son contextos
 * corrientes —el I V vi IV de un cantautor, el blues a medias, la andaluza, el
 * vals, el riff de quintas, el estribillo que no cierra— y no las formas raras del
 * ciego: lo que alguien toca un martes.
 *
 * Un arreglista escribió para cada caso **lo que esperaría ver arriba** (de dos a
 * cuatro respuestas) y **lo que no debería salir nunca**, y juzgó los 50 menús a
 * mano: 72 % bien, 18 % aceptable y 10 % mal. Los fallos eran de causas que los
 * otros corpus no miraban: nombre y motivo que se contradicen sobre qué parte se
 * añade, quintas descritas como si tuvieran tercera, un blues de doce a medias que
 * nadie completaba, la andaluza con punteo sin una sola rearmonización, el ritmo
 * armónico de dos compases echado del menú por la variedad, y un acorde dudoso
 * sosteniendo la cadencia final.
 *
 * Aquí está traducido a los predicados de los otros corpus y se examina con el
 * mismo criterio que el ciego (`exigir`): el `debe` en las tres primeras, el
 * `noDebe` en todo el menú y la calidad de cada una de las tres primeras. **Las
 * respuestas son las del arreglista**: donde dio tres, el `debe` admite las tres.
 *
 * **Lo que no se traduce, se dice**, caso por caso. Donde el arreglista habló del
 * orden («el estribillo que no cierra en la primera», «contraste puesto primero en
 * un estribillo»), va en `primera`. Donde dijo «como lo único» —«V→I con sensible
 * después de iv como lo único»—, lo cubre el `debe`, que pide otra cosa entre las
 * tres primeras.
 *
 * **Y la rumba y la andaluza, otra vez con su estilo.** Se escribieron sin él porque
 * `styles.ts` no tenía flamenco; ahora lo tiene, y esos cuatro casos se examinan dos
 * veces (`suEstilo`): 50 casos y 54 menús.
 */

import type { ContextoDeSalidas } from './contexto-de-salidas';
import {
  alarga,
  algoNuevoEn,
  cadenciaDeViiTriada,
  cambiaTuEspecie,
  chocaConElPunteo,
  cierraCon,
  cierraEnLaTonica,
  cierraSobreLoDudoso,
  citaLoDudosoComoSeguro,
  compasEs,
  contrasteQueReposaEnLaTonica,
  cruzaLaBarra,
  cuadra,
  dicho,
  diceAlgoFalso,
  duraCompases,
  duraMasDe,
  empiezaEn,
  encadenaSecundarias,
  esCamino,
  loNuevoCambiaCada,
  loNuevoConSeptima,
  loNuevoEn,
  loNuevoEnMultiplosDe,
  meteElGiro,
  meteElGrado,
  meteLaSensible,
  meteUnaSecundaria,
  mismosAcordesA,
  no,
  NUNCA,
  o,
  pasaPor,
  pierdeLaSecundaria,
  poneComo,
  repiteLoTuyo,
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

/** Las cuatro partes del corpus, como las escribió el arreglista. */
export type FamiliaFinal =
  'mayor-continuar' | 'mayor-retocar' | 'menor-continuar' | 'menor-retocar';

export const FAMILIAS_FINALES: readonly FamiliaFinal[] = [
  'mayor-continuar',
  'mayor-retocar',
  'menor-continuar',
  'menor-retocar',
];

export interface CasoFinal {
  readonly id: string;
  readonly familia: FamiliaFinal;
  /** Lo que es, en las palabras del arreglista. */
  readonly que: string;
  readonly mode: KeyMode;
  /** La petición para la que se escribió: cada caso, una. */
  readonly kind: PathKind;
  readonly compases: readonly PathStep[];
  /** Todo lo que sabe la petición, estilo incluido. */
  readonly contexto: ContextoDeSalidas;
  /**
   * El estilo de verdad de un caso que se escribió sin él porque `styles.ts` no lo
   * tenía: la rumba y la andaluza son flamenco. Se examina otra vez, con él.
   */
  readonly suEstilo?: StyleId;
  readonly espera: LoQueSeExige;
}

/** Un caso como lo escribió el arreglista: la toma en la notación compacta y lo esperado. */
interface CasoEscrito extends Omit<LoQueSeExige, 'noDebe' | 'aceptable'> {
  readonly id: string;
  readonly que: string;
  readonly mode: KeyMode;
  readonly kind: PathKind;
  /** En la notación de `leerToma`: `grado:pulsos@especie?`. */
  readonly toma: string;
  readonly pulsosPorCompas?: number;
  /** Todos los dicen: el arreglista escribió cada caso como una parte de una canción. */
  readonly papel: SectionRole;
  /** En la notación de `leerPunteo`: semitonos sobre la tónica, `F` los fuertes. */
  readonly punteo?: readonly string[];
  readonly estilo?: StyleId;
  readonly suEstilo?: StyleId;
  /** Los errores propios del caso; los de todos los añade `caso`. */
  readonly noDebe?: readonly Expectativa[];
  readonly aceptable?: readonly Expectativa[];
  /** Lo que el arreglista admite detrás de una secundaria además de su destino. */
  readonly tolera?: readonly DegreeSymbol[];
}

/**
 * Lo que no puede hacer ninguna salida de este corpus: lo de siempre, mentir de
 * sí misma, dejar una secundaria sin destino y cerrar con el vii° pelado. Al
 * retocar, además, no quitarle a una secundaria tuya el sitio adonde iba. Es lo
 * mismo que en el ciego, y por la misma razón: todo es música popular.
 */
function nuncaFinal(kind: PathKind, tolera: readonly DegreeSymbol[]): Expectativa[] {
  return [
    ...NUNCA,
    diceAlgoFalso(),
    secundariaQueNoResuelve(...tolera),
    cadenciaDeViiTriada(),
    ...(kind === 'retocar' ? [pierdeLaSecundaria()] : []),
  ];
}

/** Al continuar, lo mínimo de cada una de las tres primeras: si es un puente, que se vaya. */
const SIN_REPOSO = no(contrasteQueReposaEnLaTonica(), 'si contrasta, no reposa en la tónica');

function familiaDe(mode: KeyMode, kind: PathKind): FamiliaFinal {
  return `${mode === 'major' ? 'mayor' : 'menor'}-${kind}`;
}

function caso({
  toma,
  pulsosPorCompas,
  papel,
  punteo,
  estilo,
  suEstilo,
  noDebe = [],
  aceptable = [],
  tolera = [],
  ...resto
}: CasoEscrito): CasoFinal {
  const pulsos = pulsosPorCompas ?? 4;
  const { compases, ...leido } = leerToma(toma, pulsos);
  const { id, que, mode, kind, debe, primera, razonables } = resto;
  return {
    id,
    familia: familiaDe(mode, kind),
    que,
    mode,
    kind,
    compases,
    contexto: {
      ...(estilo === undefined ? {} : { estilo }),
      ...(pulsosPorCompas === undefined ? {} : { pulsosPorCompas }),
      papel,
      ...leido,
      ...(punteo === undefined ? {} : { melodia: leerPunteo(punteo) }),
    },
    ...(suEstilo === undefined ? {} : { suEstilo }),
    espera: {
      debe,
      noDebe: [...noDebe, ...nuncaFinal(kind, tolera)],
      aceptable: kind === 'continuar' ? [SIN_REPOSO, ...aceptable] : aceptable,
      ...(primera === undefined ? {} : { primera }),
      ...(razonables === undefined ? {} : { razonables }),
    },
  };
}

// --- Lo que se repite entre casos ---------------------------------------------------

const TRIADAS = dicho('pone tríadas donde todo lleva séptima', no(loNuevoConSeptima()));

const FUERA_DE_LAS_QUINTAS = dicho(
  'pone algo que no es una quinta sobre un riff de quintas',
  no(loNuevoEn('quinta')),
);

const COMPASES_DE_CUATRO = dicho('pone compases de cuatro en un vals', no(loNuevoEnMultiplosDe(3)));

const JAZZ = dicho(
  'jazzea: séptimas mayores o menores, o secundarias encadenadas',
  o(algoNuevoEn('major7'), algoNuevoEn('minor7'), encadenaSecundarias()),
);

const BII = dicho('mete el bII sin que nada lo pida', meteElGrado('bII'));

/**
 * El punteo, **en sus notas fuertes**: los errores que el arreglista apuntó son todos
 * de una nota fuerte contra el acorde nuevo —«10 contra Si natural 11»—, y el de la
 * verificación da por bueno un iv bajo un La débil. **Corregida**: se tradujo
 * primero con el predicado del ciego, que cuenta también las débiles, y eso tachaba
 * en la balada menor lo que este arreglista no tachó.
 */
const CHOCA_CON_EL_PUNTEO = chocaConElPunteo();

/** El arreglista apuntó «menú de menos de tres» como error. */
const TRES: Razonables = { cuantas: 3 };

/** Un seguir que acaba en ese grado: «cerrar en vi», «quedarse en III». */
const seQuedaEn = (grado: DegreeSymbol) =>
  dicho(`sigue y se queda en ${grado}`, y(esCamino('seguir'), cierraCon(grado)));

/** Un contraste que arranca en alguno de esos grados: «contraste: estribillo en IV o vi». */
const contrasteDesde = (...grados: DegreeSymbol[]) =>
  dicho(
    `un contraste que arranca en ${grados.join(' o ')}`,
    y(esCamino('contraste'), empiezaEn(...grados)),
  );

/** Lo dudoso, las dos maneras de fiarse de ello: decirlo y cerrar encima. */
const LO_DUDOSO = dicho(
  'se fía de lo que se oyó con duda: lo cita como seguro o cierra encima',
  o(citaLoDudosoComoSeguro(), cierraSobreLoDudoso()),
);

/**
 * «Dejarlo abierto siendo estribillo»: **la primera** cierra en la tónica. No va
 * en el `noDebe`, que mira todo el menú: lo tuyo ya acaba abierto, y una
 * rearmonización que no toca el final no lo empeora. Lo que el arreglista echa en
 * falta es que lo primero que se ve lo arregle.
 */
const LA_PRIMERA_CIERRA = dicho('la primera cierra en la tónica', cierraEnLaTonica());

// --- El corpus -------------------------------------------------------------------------

export const CORPUS_FINAL: readonly CasoFinal[] = [
  // --- Mayor, para continuar ---------------------------------------------------------
  caso({
    id: 'MC01',
    que: 'cantautor, I V vi IV en Sol, estrofa folk',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi IV',
    estilo: 'folk',
    papel: 'estrofa',
    // «IV→V→I o IV→I», «repite el bucle y cierra», «estribillo que arranca en IV o vi».
    debe: [
      o(
        y(esCamino('seguir'), o(cierraCon('V', 'I'), cierraCon('IV', 'I'))),
        contrasteDesde('IV', 'vi'),
      ),
    ],
    noDebe: [
      dicho('bII o V/iii en un folk', o(meteElGrado('bII'), meteElGrado('V/iii'))),
      dicho('cierra con V→vi y lo llama cierre', y(esCamino('seguir'), cierraCon('V', 'vi'))),
    ],
  }),
  caso({
    id: 'MC02',
    que: 'pop, I V vi IV en Do con punteo, estribillo',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi IV',
    punteo: ['4F 7', '2F 11', '0F 9', '9F 5'],
    estilo: 'pop',
    papel: 'estribillo',
    // «IV V I», «ii V I o IV I», «repite y cierra en I».
    debe: [y(esCamino('seguir'), o(cierraCon('V', 'I'), cierraCon('IV', 'I')))],
    // «Estribillo que no cierra en la primera» y «contraste presentado como cierre».
    primera: [
      dicho('la primera sigue y cierra el estribillo', y(esCamino('seguir'), cierraEnLaTonica())),
    ],
  }),
  caso({
    id: 'MC03',
    que: 'blues de 12 en La, los ocho primeros compases',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@dominant7 I@dominant7 I@dominant7 I@dominant7 IV@dominant7 IV@dominant7 I@dominant7 I@dominant7',
    estilo: 'blues',
    papel: 'estrofa',
    // «V7 IV7 I7 V7» (los cuatro que faltan), «V7 IV7 I7 I7», «ii7 V7 I7».
    debe: [
      dicho(
        'completa el blues con los cuatro compases que faltan, desde el V7 o el ii7',
        y(alarga(4), o(sigueCon('V'), sigueCon('ii'))),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('pone un Imaj7', algoNuevoEn('major7')),
      dicho('no completa los doce del blues', no(cuadra(12))),
      // «V I a secas como blues»: el V–I suelto, sin la forma. **Corregida**: se
      // tradujo como «cierra V→I sin pasar por el IV», y eso tachaba el `ii7 V7 I7`
      // que el mismo arreglista da por bueno en este caso.
      dicho(
        'cierra V→I a secas, en dos compases y sin la forma',
        y(alarga(2), cierraCon('V', 'I')),
      ),
    ],
  }),
  caso({
    id: 'MC04',
    que: 'riff de rock en quintas, I bVII IV I en Re',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@quinta bVII@quinta IV@quinta I@quinta',
    estilo: 'rock',
    papel: 'idea',
    // «bVII IV I o IV V I», «contraste: bVI bVII I, o IV con V», «bIII IV I».
    debe: [
      o(
        cierraCon('bVII', 'IV', 'I'),
        cierraCon('IV', 'V', 'I'),
        cierraCon('bIII', 'IV', 'I'),
        y(esCamino('contraste'), o(pasaPor('bVI'), y(pasaPor('IV'), pasaPor('V')))),
      ),
    ],
    noDebe: [
      FUERA_DE_LAS_QUINTAS,
      dicho('mete V/ii o vii°', o(meteElGrado('V/ii'), meteElGrado('vii°'))),
      dicho(
        'sigue repitiendo la tónica sin cadencia',
        y(
          esCamino('seguir'),
          sigueCon('I'),
          no(o(cierraCon('V', 'I'), cierraCon('bVII', 'I'), cierraCon('IV', 'I'))),
        ),
      ),
    ],
  }),
  caso({
    id: 'MC05',
    que: 'balada en vals, I vi IV V en Do, 3/4',
    mode: 'major',
    kind: 'continuar',
    toma: 'I vi IV V',
    pulsosPorCompas: 3,
    estilo: 'pop',
    papel: 'estrofa',
    // «I (V→I) en 3 pulsos, o la vuelta entera cerrando», «contraste en IV o vi», «I vi ii V I».
    debe: [
      o(
        y(esCamino('seguir'), sigueCon('I'), cierraEnLaTonica()),
        contrasteDesde('IV', 'vi'),
        cierraCon('ii', 'V', 'I'),
      ),
    ],
    noDebe: [COMPASES_DE_CUATRO, dicho('acaba en V otra vez como cierre', seQuedaEn('V'))],
  }),
  caso({
    id: 'MC06',
    que: 'jazz, ii7 V7 Imaj7 Imaj7 en Fa',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii@minor7 V@dominant7 I@major7 I@major7',
    estilo: 'jazz',
    papel: 'idea',
    // «vi7 (o VI7) ii7 V7 Imaj7», «contraste: IVmaj7, o iii7 VI7 ii7 V7», «II7 V7 I».
    debe: [
      o(
        cierraCon('vi', 'ii', 'V', 'I'),
        cierraCon('V/ii', 'ii', 'V', 'I'),
        y(esCamino('contraste'), o(empiezaEn('IV'), meteElGiro('iii', 'V/ii', 'ii', 'V'))),
        cierraCon('V/V', 'V', 'I'),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('mete el bVII del rock', meteElGrado('bVII')),
      dicho('pone quintas', algoNuevoEn('quinta')),
    ],
  }),
  caso({
    id: 'MC07',
    que: 'intro corta, I IV en Mi, pop',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV',
    estilo: 'pop',
    papel: 'intro',
    // «I IV V I o I IV | V I», «IV→I repetido», «contraste: vi IV».
    debe: [
      o(
        cierraCon('IV', 'V', 'I'),
        cierraCon('IV', 'I'),
        y(esCamino('contraste'), meteElGiro('vi', 'IV')),
      ),
    ],
    noDebe: [dicho('una cadencia rara para una intro: el bII', meteElGrado('bII'))],
  }),
  caso({
    id: 'MC08',
    que: 'pre-estribillo, ii IV V V en Re',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii IV V V',
    estilo: 'pop',
    papel: 'pre',
    // «I», «contraste: estribillo que arranca en I o vi», «V→vi (rota) y luego IV V I».
    debe: [
      o(sigueCon('I'), contrasteDesde('I', 'vi'), y(sigueCon('vi'), cierraCon('IV', 'V', 'I'))),
    ],
    noDebe: [
      dicho('vuelve al ii sin resolver', sigueCon('ii')),
      dicho('mete la retrogresión V→ii', meteElGiro('V', 'ii')),
    ],
  }),
  caso({
    id: 'MC09',
    que: 'rumba en mayor, I IV I V en La',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV I V',
    suEstilo: 'flamenco',
    papel: 'estrofa',
    // «I (resuelve el V)», «I IV V I», «contraste: vi o IV».
    debe: [o(sigueCon('I'), contrasteDesde('vi', 'IV'))],
    noDebe: [JAZZ, BII],
  }),
  caso({
    id: 'MC10',
    que: 'doo-wop, I vi IV V dos veces, estribillo pop en Sib',
    mode: 'major',
    kind: 'continuar',
    toma: 'I vi IV V I vi IV V',
    estilo: 'pop',
    papel: 'estribillo',
    // «I (cierra)», «I vi IV V I o ii V I», «contraste: IV I o vi».
    debe: [
      o(
        y(esCamino('seguir'), sigueCon('I')),
        cierraCon('ii', 'V', 'I'),
        contrasteDesde('IV', 'vi'),
      ),
    ],
    noDebe: [
      dicho('sigue con más de una frase que no aporta', y(esCamino('seguir'), duraMasDe(16))),
      seQuedaEn('vi'),
    ],
  }),
  caso({
    id: 'MC11',
    que: 'canon, I V vi iii IV I IV V en Re, folk',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi iii IV I IV V',
    estilo: 'folk',
    papel: 'estrofa',
    // «I», «contraste: vi IV I V, o IV V vi», «repite el canon y cierra».
    debe: [o(y(esCamino('seguir'), sigueCon('I')), contrasteDesde('vi', 'IV'))],
    noDebe: [JAZZ, BII, seQuedaEn('V')],
  }),
  caso({
    id: 'MC12',
    que: 'toma oída, I IV vi V con el vi dudoso, pop en Sol',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV vi? V',
    estilo: 'pop',
    papel: 'idea',
    // «I», «I IV V I», «contraste en IV».
    debe: [o(sigueCon('I'), contrasteDesde('IV'))],
    // «Construir sobre el vi: el V/vi antes, motivos que lo citen como seguro».
    // **Corregida**: se tradujo como «mete un V/vi», y tachaba un puente que encadena
    // `V/vi V/ii ii V`, donde el III7 va al VI7 y no se apoya en el vi. Lo que dijo
    // el arreglista es «el V/vi antes»: la dominante del vi delante de un vi.
    noDebe: [
      dicho(
        'mete el V/vi delante de un vi, que construye sobre el vi dudoso',
        meteElGiro('V/vi', 'vi'),
      ),
      LO_DUDOSO,
    ],
  }),
  caso({
    id: 'MC13',
    que: 'Creep, I V/vi IV iv en Sol, rock, estrofa',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V/vi IV iv',
    estilo: 'rock',
    papel: 'estrofa',
    // «I (iv→I, plagal menor)», «repite el giro y cierra en I», «contraste: vi o bVI bVII I».
    debe: [
      o(
        sigueCon('I'),
        y(repiteLoTuyo(), cierraEnLaTonica()),
        y(esCamino('contraste'), o(empiezaEn('vi'), meteElGiro('bVI', 'bVII', 'I'))),
      ),
    ],
    noDebe: [],
    // «Decir que V/vi tiene que resolver a vi» es un error: el III7 que va al IV es
    // el giro de esta canción, y repetirlo no deja la secundaria sin destino.
    tolera: ['IV'],
  }),

  // --- Mayor, para retocar -----------------------------------------------------------
  caso({
    id: 'MR01',
    que: 'pop con punteo, I vi IV V en Do',
    mode: 'major',
    kind: 'retocar',
    toma: 'I vi IV V',
    punteo: ['0F 4', '9F 0', '5F 9', '7F 2'],
    estilo: 'pop',
    papel: 'estribillo',
    // «IV→ii», «vi→IV», «otro final: IV V I o ii V I».
    debe: [
      o(
        compasEs(3, 'ii'),
        compasEs(2, 'IV'),
        y(esCamino('otro-final'), o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'))),
      ),
    ],
    noDebe: [
      CHOCA_CON_EL_PUNTEO,
      dicho('vi→iii: choca con el La fuerte', compasEs(2, 'iii')),
      dicho('vi→V/vi: el Sol# contra el La', compasEs(2, 'V/vi')),
      dicho('V→V/V: el Fa# contra el Sol fuerte', compasEs(4, 'V/V')),
    ],
  }),
  caso({
    id: 'MR02',
    que: 'folk, estrofa larga I Isus2 IV I I I V V en Sol',
    mode: 'major',
    kind: 'retocar',
    toma: 'I I@sus2 IV I I I V V',
    estilo: 'folk',
    papel: 'estrofa',
    // «el 2.º I (o el 6.º) → vi», «compás 7 → ii o V/V antes del V», «otro final que cierre en I».
    debe: [
      o(
        compasEs(2, 'vi'),
        compasEs(6, 'vi'),
        compasEs(7, 'ii'),
        compasEs(7, 'V/V'),
        y(esCamino('otro-final'), cierraEnLaTonica()),
      ),
    ],
    noDebe: [
      dicho('dominantes alteradas en un folk', o(meteElGrado('bII'), encadenaSecundarias())),
      dicho('pierde la sus2 sin tocar el compás', cambiaTuEspecie()),
    ],
  }),
  caso({
    id: 'MR03',
    que: 'rock en quintas, I IV V IV en Mi',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@quinta IV@quinta V@quinta IV@quinta',
    estilo: 'rock',
    papel: 'estribillo',
    // «V→bVII», «IV→bIII o bVI», «otro final: IV V I o bVII IV I».
    debe: [
      o(
        compasEs(3, 'bVII'),
        compasEs(2, 'bIII'),
        compasEs(2, 'bVI'),
        compasEs(4, 'bIII'),
        compasEs(4, 'bVI'),
        y(esCamino('otro-final'), o(cierraCon('IV', 'V', 'I'), cierraCon('bVII', 'IV', 'I'))),
      ),
    ],
    noDebe: [
      FUERA_DE_LAS_QUINTAS,
      dicho('mete secundarias de jazz en un riff de quintas', meteUnaSecundaria()),
    ],
  }),
  caso({
    id: 'MR04',
    que: 'blues de 12 completo en Mi',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@dominant7 I@dominant7 I@dominant7 I@dominant7 IV@dominant7 IV@dominant7 I@dominant7 I@dominant7 V@dominant7 IV@dominant7 I@dominant7 V@dominant7',
    estilo: 'blues',
    papel: 'estrofa',
    // «quick change: IV7 en el 2», «ii7 V7 en 9-10, o VI7 en el 8», «turnaround I7 V7».
    debe: [o(compasEs(2, 'IV'), y(compasEs(9, 'ii'), compasEs(10, 'V')), compasEs(8, 'V/ii'))],
    noDebe: [
      TRIADAS,
      dicho('pone un Imaj7', algoNuevoEn('major7')),
      dicho('cambia la forma de 12', no(duraCompases(12))),
    ],
  }),
  caso({
    id: 'MR05',
    que: 'jazz, Imaj7 vi7 ii7 V7 en Sib',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@major7 vi@minor7 ii@minor7 V@dominant7',
    estilo: 'jazz',
    papel: 'idea',
    // «vi7→VI7», «V7→bII7», «I→iii7».
    debe: [o(compasEs(2, 'V/ii'), compasEs(4, 'bII'), compasEs(1, 'iii'))],
    noDebe: [TRIADAS, dicho('el bVII del rock en lugar del V', compasEs(4, 'bVII'))],
  }),
  caso({
    id: 'MR06',
    que: 'estribillo que no cierra, I V vi IV I IV V V en La',
    mode: 'major',
    kind: 'retocar',
    toma: 'I V vi IV I IV V V',
    estilo: 'pop',
    papel: 'estribillo',
    // «otro final: … IV V I, cerrando en el 8», «otro final: ii V I», «compás 6 → ii».
    debe: [
      o(
        y(cierraCon('IV', 'V', 'I'), duraCompases(8)),
        cierraCon('ii', 'V', 'I'),
        compasEs(6, 'ii'),
      ),
    ],
    noDebe: [dicho('cierra en vi', cierraCon('vi'))],
    primera: [LA_PRIMERA_CIERRA],
  }),
  caso({
    id: 'MR07',
    que: 'vals folk, I I V V V V I I en Re, 3/4',
    mode: 'major',
    kind: 'retocar',
    toma: 'I I V V V V I I',
    pulsosPorCompas: 3,
    estilo: 'folk',
    papel: 'estrofa',
    // «compás 2 → IV», «compás 5 → ii o V/V», «compás 4 → IV».
    debe: [o(compasEs(2, 'IV'), compasEs(5, 'ii'), compasEs(5, 'V/V'), compasEs(4, 'IV'))],
    noDebe: [COMPASES_DE_CUATRO, JAZZ],
  }),
  caso({
    id: 'MR08',
    que: 'vamp mixolidio corto, I v(menor) en La, rock',
    mode: 'major',
    kind: 'retocar',
    toma: 'I V@menor',
    estilo: 'rock',
    papel: 'idea',
    // «v→bVII», «v→IV», «otro reparto: 2+2 u 8+8».
    debe: [o(compasEs(2, 'bVII'), compasEs(2, 'IV'), esCamino('estirar'))],
    noDebe: [dicho('devuelve el v como V mayor con sensible', meteLaSensible())],
    razonables: TRES,
  }),
  caso({
    id: 'MR09',
    que: 'final, IV V I I en Do',
    mode: 'major',
    kind: 'retocar',
    toma: 'IV V I I',
    estilo: 'pop',
    papel: 'final',
    // «IV→ii (ii V I)», «V→iv (IV iv I)», «bVI bVII I».
    debe: [o(compasEs(1, 'ii'), compasEs(2, 'iv'), y(compasEs(1, 'bVI'), compasEs(2, 'bVII')))],
    noDebe: [
      dicho('un final que no acaba en I', no(cierraEnLaTonica())),
      dicho('acaba en vi', cierraCon('vi')),
    ],
  }),
  caso({
    id: 'MR10',
    que: 'cantautor con punteo, I iii IV V en Re',
    mode: 'major',
    kind: 'retocar',
    toma: 'I iii IV V',
    punteo: ['2F 4', '7F 11', '9F 5', '11F 2'],
    estilo: 'folk',
    papel: 'estrofa',
    // «IV→ii», «iii→V o I», «otro final con V→I».
    debe: [
      o(
        compasEs(3, 'ii'),
        compasEs(2, 'V'),
        compasEs(2, 'I'),
        y(esCamino('otro-final'), cierraCon('V', 'I')),
      ),
    ],
    noDebe: [
      CHOCA_CON_EL_PUNTEO,
      dicho('V→V/V: el La contra el Si fuerte', compasEs(4, 'V/V')),
      dicho('IV→bVII: el Do contra el Si fuerte', compasEs(3, 'bVII')),
      dicho('iii→vi: contra el Sol y el Si', compasEs(2, 'vi')),
    ],
  }),
  caso({
    id: 'MR11',
    que: 'toma oída, I V vi IV con el V dudoso en Mi, pop',
    mode: 'major',
    kind: 'retocar',
    toma: 'I V? vi IV',
    estilo: 'pop',
    papel: 'idea',
    // «el V dudoso → iii», «IV→ii», «otro final IV V I».
    debe: [
      o(
        compasEs(2, 'iii'),
        compasEs(4, 'ii'),
        y(esCamino('otro-final'), cierraCon('IV', 'V', 'I')),
      ),
    ],
    noDebe: [LO_DUDOSO],
  }),
  caso({
    id: 'MR12',
    que: 'mixolidio de estribillo, I bVII IV I en La, rock',
    mode: 'major',
    kind: 'retocar',
    toma: 'I bVII IV I',
    estilo: 'rock',
    papel: 'estribillo',
    // «bVII→bIII o bVI», «IV→ii o IV→V», «reparto 2+2».
    debe: [
      o(
        compasEs(2, 'bIII'),
        compasEs(2, 'bVI'),
        compasEs(3, 'ii'),
        compasEs(3, 'V'),
        y(esCamino('estirar'), mismosAcordesA(2)),
      ),
    ],
    noDebe: [dicho('bVII→V/V o vii°', o(compasEs(2, 'V/V'), compasEs(2, 'vii°'))), JAZZ],
  }),

  // --- Menor, para continuar ---------------------------------------------------------
  caso({
    id: 'mC01',
    que: 'cadencia andaluza, i VII VI V en La menor, rumba',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII VI V',
    suEstilo: 'flamenco',
    papel: 'estrofa',
    // «i (V→i)», «repite la andaluza y cae en i», «contraste: III o iv».
    debe: [o(sigueCon('i'), contrasteDesde('III', 'iv'))],
    noDebe: [
      dicho('el v menor en lugar del V en una andaluza', meteElGrado('v')),
      dicho('V→VI llamado cierre', y(esCamino('seguir'), sigueCon('VI'))),
    ],
  }),
  caso({
    id: 'mC02',
    que: 'pop-rock menor, i VI III VII en La menor, estribillo',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI III VII',
    estilo: 'pop',
    papel: 'estribillo',
    // «i (VII→i)», «VI VII i», «iv V i».
    debe: [
      o(
        y(esCamino('seguir'), sigueCon('i')),
        cierraCon('VI', 'VII', 'i'),
        cierraCon('iv', 'V', 'i'),
      ),
    ],
    noDebe: [seQuedaEn('III')],
    primera: [dicho('en un estribillo, lo primero no es un contraste', no(esCamino('contraste')))],
  }),
  caso({
    id: 'mC03',
    que: 'metal frigio en quintas, i bII i VII en Mi',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@quinta bII@quinta i@quinta VII@quinta',
    estilo: 'metal',
    papel: 'idea',
    // «VI VII i en quintas», «bII i», «contraste: VI bII o iv».
    debe: [
      o(
        cierraCon('VI', 'VII', 'i'),
        cierraCon('bII', 'i'),
        y(esCamino('contraste'), o(meteElGiro('VI', 'bII'), empiezaEn('iv'))),
      ),
    ],
    noDebe: [
      FUERA_DE_LAS_QUINTAS,
      dicho('un V con sensible y tercera mayor en un riff frigio', meteLaSensible()),
    ],
  }),
  caso({
    id: 'mC04',
    que: 'blues menor, los ocho primeros compases en La menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 i@minor7 i@minor7 i@minor7 iv@minor7 iv@minor7 i@minor7 i@minor7',
    estilo: 'blues',
    papel: 'estrofa',
    // «VI7 V7 i7 V7», «V7 iv7 i7 i7», «iv7 V7 i».
    debe: [
      dicho(
        'completa el blues con los cuatro compases que faltan',
        y(alarga(4), o(sigueCon('VI'), sigueCon('V'), sigueCon('iv'))),
      ),
    ],
    noDebe: [TRIADAS, dicho('cierra en mayor', o(cierraCon('V/iv'), cierraCon('III')))],
  }),
  caso({
    id: 'mC05',
    que: 'balada, i iv VII III en Re menor, folk',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i iv VII III',
    estilo: 'folk',
    papel: 'estrofa',
    // «VI ii° V i», «VI iv V i», «VI V i». **Corregida**: se tradujo como «acaba con
    // exactamente esos cuatro», y tachaba `VI V i VII i iv V i`, que es la tercera
    // del arreglista seguida de otra frase que vuelve a cerrar por el V. Lo que tienen
    // las tres en común es lo que pedía: seguir por el VI y llegar a la i desde el V.
    debe: [
      dicho('sigue por el VI y llega a la i desde el V', y(sigueCon('VI'), cierraCon('V', 'i'))),
    ],
    noDebe: [seQuedaEn('III'), BII],
  }),
  caso({
    id: 'mC06',
    que: 'jazz menor, iiø7 V7 en un compás y i7 i7, Do menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'ii°:2@halfDiminished7 V:2@dominant7 i@minor7 i@minor7',
    estilo: 'jazz',
    papel: 'idea',
    // «iv7 VII7 IIImaj7 VImaj7 iiø V7 i», «iiø7 V7 i7 (2+2+4)», «contraste a IIImaj7».
    debe: [
      o(
        meteElGiro('iv', 'VII', 'III', 'VI'),
        cierraCon('ii°', 'V', 'i'),
        y(esCamino('contraste'), empiezaEn('III')),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('pone quintas', algoNuevoEn('quinta')),
      dicho('pulsos desparejados: un acorde de dos suelto', cruzaLaBarra()),
    ],
  }),
  caso({
    id: 'mC07',
    que: 'vals menor, i iv V i en Mi menor, 3/4',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i iv V i',
    pulsosPorCompas: 3,
    estilo: 'folk',
    papel: 'estrofa',
    // «contraste: III VII III V», «VI iv V i», «iv V i».
    debe: [
      o(
        y(esCamino('contraste'), empiezaEn('III')),
        cierraCon('VI', 'iv', 'V', 'i'),
        cierraCon('iv', 'V', 'i'),
      ),
    ],
    noDebe: [
      COMPASES_DE_CUATRO,
      dicho('sigue con la tónica repetida', y(esCamino('seguir'), sigueCon('i'))),
    ],
  }),
  caso({
    id: 'mC08',
    que: 'intro rock, i VII VI VII en La menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII VI VII',
    estilo: 'rock',
    papel: 'intro',
    // «i (VII→i)», «VI VII i», «contraste: III VII o iv». «El V armónico como lo
    // único» lo cubre el `debe`, que pide la llegada sin él.
    debe: [o(sigueCon('i'), cierraCon('VI', 'VII', 'i'), contrasteDesde('III', 'iv'))],
    noDebe: [dicho('mete la ii°', meteElGrado('ii°'))],
  }),
  caso({
    id: 'mC09',
    que: 'toma oída, i VI VII con el VII dudoso, Si menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI VII?',
    estilo: 'pop',
    papel: 'idea',
    // «i», «i VI VII i, completando la frase de cuatro», «contraste: III».
    debe: [o(sigueCon('i'), y(esCamino('contraste'), empiezaEn('III')))],
    noDebe: [LO_DUDOSO],
  }),
  caso({
    id: 'mC10',
    que: 'folk menor con punteo, i III VII iv en Sol menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i III VII iv',
    punteo: ['7F 3', '3F 10', '2F 10', '0F 5'],
    estilo: 'folk',
    papel: 'estrofa',
    // «V i o v i», «VI V i», «contraste: VI III».
    debe: [o(cierraCon('V', 'i'), cierraCon('v', 'i'), y(esCamino('contraste'), empiezaEn('VI')))],
    noDebe: [BII],
  }),
  caso({
    id: 'mC11',
    que: 'pre-estribillo, iv v VI VII en Re menor, pop',
    mode: 'minor',
    kind: 'continuar',
    toma: 'iv v VI VII',
    estilo: 'pop',
    papel: 'pre',
    // «i (el estribillo en casa)», «contraste que arranca en i o en III», «VII→III».
    debe: [o(sigueCon('i'), contrasteDesde('i', 'III'), sigueCon('III'))],
    noDebe: [dicho('vuelve al iv sin llegar', sigueCon('iv'))],
  }),
  caso({
    id: 'mC12',
    que: 'estrofa lenta, i i VI VI III III VII VII en Fa# menor',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i i VI VI III III VII VII',
    estilo: 'pop',
    papel: 'estrofa',
    // «el mismo ritmo armónico, dos compases por acorde: i i», «iv iv V V i»,
    // «contraste: VI VII III».
    debe: [
      dicho(
        'sigue a dos compases por acorde, llegando a la i o contrastando',
        y(
          loNuevoCambiaCada(8),
          o(sigueCon('i'), cierraCon('iv', 'V', 'i'), y(esCamino('contraste'), empiezaEn('VI'))),
        ),
      ),
    ],
    noDebe: [
      dicho('pone acordes de un compás que rompen el ritmo armónico', no(loNuevoCambiaCada(8))),
    ],
  }),

  // --- Menor, para retocar -----------------------------------------------------------
  caso({
    id: 'mR01',
    que: 'pop menor, i VI III VII en Mi menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VI III VII',
    estilo: 'pop',
    papel: 'estrofa',
    // «VI→iv», «VII→V», «III→v o reparto 2+2».
    debe: [
      o(
        compasEs(2, 'iv'),
        compasEs(4, 'V'),
        compasEs(3, 'v'),
        y(esCamino('estirar'), mismosAcordesA(2)),
      ),
    ],
    noDebe: [BII],
  }),
  caso({
    id: 'mR02',
    que: 'andaluza con punteo, i VII VI V en La menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VII VI V',
    punteo: ['0F 3', '10F 2', '8F 0', '11F 7'],
    suEstilo: 'flamenco',
    papel: 'estrofa',
    // «VI→iv», «VII→v», «reparto 2+2».
    debe: [o(compasEs(3, 'iv'), compasEs(2, 'v'), y(esCamino('estirar'), mismosAcordesA(2)))],
    noDebe: [
      CHOCA_CON_EL_PUNTEO,
      dicho('V→bII: contra el Sol# fuerte', compasEs(4, 'bII')),
      dicho('V→v: el Sol contra el Sol#', compasEs(4, 'v')),
      dicho('VI→III', compasEs(3, 'III')),
    ],
  }),
  caso({
    id: 'mR03',
    que: 'metal en quintas, i VI VII i en Re menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@quinta VI@quinta VII@quinta i@quinta',
    estilo: 'metal',
    papel: 'estribillo',
    // «VI→bII (frigio, en quintas)», «VII→V o v en quintas», «reparto».
    debe: [o(compasEs(2, 'bII'), compasEs(3, 'V'), compasEs(3, 'v'), esCamino('estirar'))],
    noDebe: [FUERA_DE_LAS_QUINTAS, dicho('un IIImaj7', poneComo('III', 'major7'))],
  }),
  caso({
    id: 'mR04',
    que: 'blues menor de 12 completo en Re menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 i@minor7 i@minor7 i@minor7 iv@minor7 iv@minor7 i@minor7 i@minor7 VI@dominant7 V@dominant7 i@minor7 V@dominant7',
    estilo: 'blues',
    papel: 'estrofa',
    // «quick change: iv7 en el 2», «iiø7 en el 9», «bII7 en el 9 o el 12».
    debe: [o(compasEs(2, 'iv'), compasEs(9, 'ii°'), compasEs(9, 'bII'), compasEs(12, 'bII'))],
    noDebe: [TRIADAS, dicho('rompe la forma de 12', no(duraCompases(12)))],
  }),
  caso({
    id: 'mR05',
    que: 'jazz menor, i7 iv7 iiø7 V7 en Sol menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 iv@minor7 ii°@halfDiminished7 V@dominant7',
    estilo: 'jazz',
    papel: 'idea',
    // «V7→bII7», «iv7→VImaj7», «i→V/iv (el I7 que va al iv)».
    debe: [o(compasEs(4, 'bII'), compasEs(2, 'VI'), compasEs(1, 'V/iv'))],
    noDebe: [TRIADAS, dicho('pone quintas', algoNuevoEn('quinta'))],
  }),
  caso({
    id: 'mR06',
    que: 'estribillo folk que no cierra, i III VII iv i III iv V en Mi menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i III VII iv i III iv V',
    estilo: 'folk',
    papel: 'estribillo',
    // «otro final: iv V i, cerrando en el 8», «otro final: VI V i», «compás 6 → VI».
    debe: [
      o(
        y(cierraCon('iv', 'V', 'i'), duraCompases(8)),
        cierraCon('VI', 'V', 'i'),
        compasEs(6, 'VI'),
      ),
    ],
    noDebe: [BII],
    primera: [LA_PRIMERA_CIERRA],
  }),
  caso({
    id: 'mR07',
    que: 'vals menor, i i iv iv V V i i en Re menor, 3/4',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i i iv iv V V i i',
    pulsosPorCompas: 3,
    estilo: 'folk',
    papel: 'estrofa',
    // «compás 4 → ii°», «compás 2 → VI o V/iv», «compás 6 → bII o iv».
    debe: [
      o(
        compasEs(4, 'ii°'),
        compasEs(2, 'VI'),
        compasEs(2, 'V/iv'),
        compasEs(6, 'bII'),
        compasEs(6, 'iv'),
      ),
    ],
    noDebe: [COMPASES_DE_CUATRO],
  }),
  caso({
    id: 'mR08',
    que: 'idea corta, i iv en Do menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv',
    papel: 'idea',
    // «iv→VI», «i→V/iv», «reparto 2+2 u 8+8».
    debe: [o(compasEs(2, 'VI'), compasEs(1, 'V/iv'), esCamino('estirar'))],
    noDebe: [],
    razonables: TRES,
  }),
  caso({
    id: 'mR09',
    que: 'final en menor, iv V i i en Si menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'iv V i i',
    papel: 'final',
    // «iv→ii° o bII», «iv→VI», «el último i → I7, la tercera de picardía».
    debe: [o(compasEs(1, 'ii°'), compasEs(1, 'bII'), compasEs(1, 'VI'), compasEs(4, 'V/iv'))],
    noDebe: [
      dicho(
        'acaba fuera de la i, y no es la picardía',
        y(no(cierraEnLaTonica()), no(cierraCon('V/iv'))),
      ),
      dicho('un v menor que debilita la cadencia final', pasaPor('v')),
    ],
  }),
  caso({
    id: 'mR10',
    que: 'rock menor con el v dudoso, i v iv i en Mi menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i v? iv i',
    estilo: 'rock',
    papel: 'estrofa',
    // «v→VII», «v→VI», «reparto».
    debe: [o(compasEs(2, 'VII'), compasEs(2, 'VI'), esCamino('estirar'))],
    noDebe: [LO_DUDOSO],
  }),
  caso({
    id: 'mR11',
    que: 'rumba, i iv V i en La menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv V i',
    suEstilo: 'flamenco',
    papel: 'estrofa',
    // «iv→VI, o VII VI (la bajada andaluza)», «V→bII (flamenco) o iv→bII», «reparto».
    debe: [
      o(
        compasEs(2, 'VI'),
        y(compasEs(2, 'VII'), compasEs(3, 'VI')),
        compasEs(3, 'bII'),
        compasEs(2, 'bII'),
        esCamino('estirar'),
      ),
    ],
    noDebe: [
      dicho(
        'acordes de jazz con séptimas',
        o(algoNuevoEn('major7'), algoNuevoEn('minor7'), algoNuevoEn('halfDiminished7')),
      ),
      dicho('V→v', compasEs(3, 'v')),
    ],
  }),
  caso({
    id: 'mR12',
    que: 'balada menor con punteo, i VI iv V en Do menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VI iv V',
    punteo: ['7F 3', '0F 8', '5F 8', '11F 2'],
    estilo: 'pop',
    papel: 'estrofa',
    // «VI→iv», «iv→ii°», «reparto u otro final iv V i».
    debe: [
      o(
        compasEs(2, 'iv'),
        compasEs(3, 'ii°'),
        esCamino('estirar'),
        y(esCamino('otro-final'), cierraCon('iv', 'V', 'i')),
      ),
    ],
    noDebe: [
      CHOCA_CON_EL_PUNTEO,
      dicho('V→v: el Sib contra el Si natural', compasEs(4, 'v')),
      dicho('V→VII: el Sib contra el Si natural', compasEs(4, 'VII')),
      dicho('iv→III', compasEs(3, 'III')),
    ],
  }),
  caso({
    id: 'mR13',
    que: 'estribillo rock, i VII VI VII en Sol menor',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VII VI VII',
    estilo: 'rock',
    papel: 'estribillo',
    // «otro final: VI VII i», «el último VII → V», «VI→iv». El arreglista dudó de su
    // propio error —«dejarlo abierto… aunque un vamp de rock lo admite»— y no entra.
    debe: [o(cierraCon('VI', 'VII', 'i'), compasEs(4, 'V'), compasEs(3, 'iv'))],
    noDebe: [],
  }),
];

// --- Los menús que se examinan ------------------------------------------------------------

/** Lo que se pide de la petición para la que no se escribió el caso: nada. */
const SIN_EXAMEN: LoQueSeExige = { debe: [], noDebe: [] };

/** Una petición de un caso, con su contexto: lo que da un menú. */
export interface ExamenFinal {
  readonly caso: CasoExigible & { readonly familia: FamiliaFinal };
  readonly kind: PathKind;
}

/**
 * Los menús que se examinan: cada caso, por la petición para la que se escribió, y
 * **otra vez con su estilo de verdad** si se escribió sin él (`suEstilo`): `mC01` y
 * `mC01/flamenco`. Lo que espera el arreglista es lo mismo: lo escribió pensando en
 * esa música, se la nombrara o no.
 */
export function examenesFinales(corpus: readonly CasoFinal[] = CORPUS_FINAL): ExamenFinal[] {
  return corpus.flatMap((caso) => {
    const variantes = [
      { id: caso.id, que: caso.que, contexto: caso.contexto },
      ...(caso.suEstilo === undefined
        ? []
        : [
            {
              id: `${caso.id}/${caso.suEstilo}`,
              que: `${caso.que} (con su estilo, ${caso.suEstilo})`,
              contexto: { ...caso.contexto, estilo: caso.suEstilo },
            },
          ]),
    ];
    return variantes.map(({ id, que, contexto }) => ({
      kind: caso.kind,
      caso: {
        id,
        familia: caso.familia,
        que,
        mode: caso.mode,
        compases: caso.compases,
        contexto,
        continuar: caso.kind === 'continuar' ? caso.espera : SIN_EXAMEN,
        ...(caso.kind === 'retocar' ? { retocar: caso.espera } : {}),
      },
    }));
  });
}
