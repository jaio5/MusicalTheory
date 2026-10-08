/**
 * El quinto examen: **50 canciones a medias escritas por un arreglista antes de ver
 * ningún menú ni ninguno de los cuatro corpus de antes**. Mitad mayor y mitad menor,
 * mitad para continuar y mitad para retocar, repartidas por lo que se toca de verdad
 * —el cantautor, la balada, el blues y el jazz, el country y el reggae, el cine, el
 * vals, el flamenco y el bolero— y por lo que pone a prueba la forma: un periodo a
 * medias, un pre que tiene que llegar, un final, un puente, una toma dudosa.
 *
 * Es la medida que hacía falta: los cuatro de antes se usaron ya para ajustar y han
 * dejado de medir (adr/0097). **La cifra honesta es la de antes de tocar nada**, y
 * la dice `corpus-quinto.test.ts`.
 *
 * El arreglista escribió para cada caso **lo que propondría** (`buenas`, de tres a
 * cuatro) y **lo que no debería salir nunca** (`errores`), y juzgó a mano los 50
 * menús: 74 % bien, 24 % aceptable y 2 % mal. Aquí está traducido a los predicados
 * de los otros corpus y se examina con el criterio del ciego (`exigir`): una de sus
 * buenas entre las tres primeras, ningún error en todo el menú y la calidad de cada
 * una de las tres primeras.
 *
 * **Lo que no se traduce, se dice**, caso por caso: dos buenas hablan de grados que
 * el dominio no tiene (un `V/IV` en mayor, un `IV` en menor), y un cambio solo de
 * especie —`V` por `V7`— no lo ve ningún predicado, que miran grados y pulsos.
 */

import { blockChord, writtenBlock } from '../../arrangement';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { SectionRole } from '../../song';
import type { StyleId } from '../../styles';
import type { ContextoDeSalidas } from '../contexto';
import type { PathKind, PathStep } from '../tipos';
import {
  alarga,
  algoNuevoDura,
  algoNuevoEn,
  cadenciaDeViiTriada,
  cambiaAlgo,
  cambiaElCompasQueAbre,
  cambiaTuEspecie,
  cierraCon,
  cierraEnLaTonica,
  cierraSobreLoDudoso,
  citaLoDudosoComoSeguro,
  compasEs,
  contrasteQueReposaEnLaTonica,
  diceAlgoFalso,
  dicho,
  duraCompases,
  duraMasDe,
  empiezaEn,
  esCamino,
  loNuevoConSeptima,
  loNuevoEn,
  loNuevoEnMultiplosDe,
  loNuevoVaA,
  meteElGiro,
  meteElGrado,
  no,
  NUNCA,
  o,
  pasaPor,
  pierdeElPrestado,
  pierdeLaSecundaria,
  poneComo,
  repiteLoTuyo,
  secundariaQueNoResuelve,
  sigueCon,
  tieneElGrado,
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

// --- Los casos ---------------------------------------------------------------------

/** Las familias del arreglista, como las escribió: por música y por lo que se pone a prueba. */
export type FamiliaQuinta =
  | 'pop-rock-cantautor'
  | 'baladas'
  | 'country-folk-reggae'
  | 'blues-jazz-funk'
  | 'cine'
  | 'forma-y-papel'
  | 'vals'
  | 'flamenco-rumba-bolero'
  | 'limite-y-contexto';

export const FAMILIAS_QUINTAS: readonly FamiliaQuinta[] = [
  'pop-rock-cantautor',
  'baladas',
  'country-folk-reggae',
  'blues-jazz-funk',
  'cine',
  'forma-y-papel',
  'vals',
  'flamenco-rumba-bolero',
  'limite-y-contexto',
];

export interface CasoQuinto {
  readonly id: string;
  readonly familia: FamiliaQuinta;
  /** Lo que es, en pocas palabras. */
  readonly que: string;
  readonly mode: KeyMode;
  /** La petición para la que se escribió: cada caso, una. */
  readonly kind: PathKind;
  readonly compases: readonly PathStep[];
  /** Todo lo que sabe la petición, estilo incluido. */
  readonly contexto: ContextoDeSalidas;
  readonly espera: LoQueSeExige;
}

/** Un caso como lo escribió el arreglista: la toma en la notación compacta y lo esperado. */
interface CasoEscrito extends Omit<LoQueSeExige, 'noDebe' | 'aceptable'> {
  readonly id: string;
  readonly familia: FamiliaQuinta;
  readonly que: string;
  readonly mode: KeyMode;
  readonly kind: PathKind;
  /** En la notación de `leerToma`: `grado:pulsos@especie?`, con `?` lo que se oyó con duda. */
  readonly toma: string;
  readonly pulsosPorCompas?: number;
  /** Solo los que lo dicen: la mitad del corpus se escribió sin papel. */
  readonly papel?: SectionRole;
  /** En la notación de `leerPunteo`: semitonos sobre la tónica, `F` los fuertes. */
  readonly punteo?: readonly string[];
  readonly estilo?: StyleId;
  /** Los errores que apuntó el arreglista; los de todos los añade `caso`. */
  readonly noDebe: readonly Expectativa[];
  readonly aceptable?: readonly Expectativa[];
}

/**
 * Lo que no puede hacer ninguna salida de este corpus, como en el ciego y en el
 * final: lo de siempre, mentir de sí misma, dejar una secundaria sin destino y
 * cerrar con el vii° pelado. Al retocar, además, no quitarle a una secundaria tuya
 * el sitio adonde iba.
 */
function nuncaQuinto(kind: PathKind): Expectativa[] {
  return [
    ...NUNCA,
    diceAlgoFalso(),
    secundariaQueNoResuelve(),
    cadenciaDeViiTriada(),
    ...(kind === 'retocar' ? [pierdeLaSecundaria()] : []),
  ];
}

/** Al continuar, lo mínimo de cada una de las tres primeras: si es un puente, que se vaya. */
const SIN_REPOSO = no(contrasteQueReposaEnLaTonica(), 'si contrasta, no reposa en la tónica');

function caso({
  toma,
  pulsosPorCompas,
  papel,
  punteo,
  estilo,
  noDebe,
  aceptable = [],
  ...resto
}: CasoEscrito): CasoQuinto {
  const { compases, ...leido } = leerToma(toma, pulsosPorCompas ?? 4);
  const { id, familia, que, mode, kind, debe, razonables } = resto;
  return {
    id,
    familia,
    que,
    mode,
    kind,
    compases,
    contexto: {
      ...(estilo === undefined ? {} : { estilo }),
      ...(pulsosPorCompas === undefined ? {} : { pulsosPorCompas }),
      ...(papel === undefined ? {} : { papel }),
      ...leido,
      ...(punteo === undefined ? {} : { melodia: leerPunteo(punteo) }),
    },
    espera: {
      debe,
      noDebe: [...noDebe, ...nuncaQuinto(kind)],
      aceptable: kind === 'continuar' ? [SIN_REPOSO, ...aceptable] : aceptable,
      ...(razonables === undefined ? {} : { razonables }),
    },
  };
}

// --- Predicados que pidió este corpus -----------------------------------------------
//
// Los demás son los de siempre (`corpus-de-salidas.ts`). Estos los pidió una frase
// del arreglista que ninguno decía: «I IV V de tres acordes», «un acorde que no
// contiene la nota fuerte», «séptimas de blues» en un cine.

/** Los grados sin repetir los seguidos: un acorde de dos compases se oye como uno. */
function giro(grados: readonly DegreeSymbol[]): string {
  return grados.filter((grado, i) => i === 0 || grados[i - 1] !== grado).join(' ');
}

/**
 * **Al retocar, la canción queda así**, en grados y sin contar cuánto dura cada
 * uno: «I vi ii V» es la respuesta del arreglista, y un ii–V partido o un acorde
 * sostenido dos compases la cumplen igual.
 */
function queda(texto: string): Expectativa {
  return {
    dice: `queda ${texto}`,
    cumple: (s) =>
      giro(s.cancion.map((paso) => paso.degree)) === giro(texto.split(' ') as DegreeSymbol[]),
  };
}

/** El grado suena menos veces que en lo tuyo: «perder el V». */
function menosVecesQueTu(grado: DegreeSymbol): Expectativa {
  const veces = (pasos: readonly { readonly degree: DegreeSymbol }[]) =>
    pasos.filter((paso) => paso.degree === grado).length;
  return {
    dice: `${grado} suena menos veces que en lo tuyo`,
    cumple: (s) => veces(s.cancion) < veces(s.tuyos),
  };
}

/** Todo lo que pone son estos grados: «un I IV V de tres acordes». */
function loNuevoSoloCon(...grados: DegreeSymbol[]): Expectativa {
  return {
    dice: `lo nuevo solo usa ${grados.join(', ')}`,
    cumple: (s) => s.nuevos.length > 0 && s.nuevos.every((paso) => grados.includes(paso.degree)),
  };
}

/** Todo lo que pone ya estaba en lo tuyo: un puente que no se va a ningún sitio. */
function soloConLoTuyo(): Expectativa {
  return {
    dice: 'lo nuevo solo usa acordes que ya tocas',
    cumple: (s) =>
      s.nuevos.length > 0 &&
      s.nuevos.every((paso) => s.tuyos.some((tuyo) => tuyo.degree === paso.degree)),
  };
}

/** Algo de lo que pone suena con séptima, sea cual sea: en un riff de quintas, ninguna. */
function algoNuevoConSeptima(): Expectativa {
  return {
    dice: 'pone algo con séptima',
    cumple: (s) => s.nuevos.some((paso) => paso.especie?.endsWith('7') === true),
  };
}

/**
 * **Una séptima de blues**: la de dominante sobre un acorde que no es dominante —un
 * I7, un IV7, un VI7 que no apunta a nada—. En un cine o un pop es otro idioma; la
 * del V y la de una secundaria son las de siempre.
 */
function septimaDeBlues(): Expectativa {
  return {
    dice: 'pone una séptima de blues sobre algo que no es dominante',
    cumple: (s) =>
      s.nuevos.some(
        (paso) =>
          paso.especie === 'dominant7' && paso.degree !== 'V' && !paso.degree.startsWith('V/'),
      ),
  };
}

/** El nombre de la salida lo dice: «otro pre». */
function seLlama(patron: RegExp): Expectativa {
  return {
    dice: `se llama ${patron.source}`,
    cumple: (s) => patron.test(s.palabras.nombre),
  };
}

/**
 * **Un acorde nuevo que no lleva la nota fuerte del punteo** de su compás: el
 * arreglista lo pide así, más estricto que el choque de frente, en una melodía de
 * una nota por compás donde cada acorde tiene que sostenerla. El punteo es el del
 * caso: el que se le manda a la petición.
 */
function noLlevaLaNotaFuerte(punteo: readonly string[]): Expectativa {
  const notas = leerPunteo(punteo);
  return {
    dice: 'pone un acorde que no lleva la nota fuerte del punteo',
    cumple: (s) =>
      s.nuevos.some((paso) => {
        const { notes } = blockChord(
          0,
          s.mode,
          writtenBlock('', paso.degree, 4, paso.especie ?? undefined),
        );
        const suyas: readonly number[] = notes;
        // Un compás partido en dos acordes ya no es del punteo de uno: lo de detrás
        // del tuyo no tiene nota.
        return notas
          .slice(paso.donde, paso.donde + 1)
          .flat()
          .some(({ nota, fuerte }) => fuerte && !suyas.includes(nota));
      }),
  };
}

// --- Lo que se repite entre casos ---------------------------------------------------

const TRIADAS = dicho('pone tríadas donde todo lleva séptima', no(loNuevoConSeptima()));

const BII = dicho('mete el bII sin que nada lo pida', meteElGrado('bII'));

const V_DE_V = dicho('mete V/V', meteElGrado('V/V'));

/** «Séptimas de jazz»: séptimas mayores o menores, que el V7 lo lleva cualquiera. */
const SEPTIMAS_DE_JAZZ = dicho(
  'pone séptimas de jazz: mayores o menores',
  o(algoNuevoEn('major7'), algoNuevoEn('minor7')),
);

const QUINTAS = dicho('pone quintas', algoNuevoEn('quinta'));

const FUERA_DE_LAS_QUINTAS = dicho(
  'pone algo que no es una quinta sobre un riff de quintas',
  no(loNuevoEn('quinta')),
);

const SEPTIMAS_EN_LAS_QUINTAS = dicho('pone séptimas en un riff de quintas', algoNuevoConSeptima());

const COMPASES_DE_CUATRO = dicho('pone compases de cuatro en un vals', no(loNuevoEnMultiplosDe(3)));

/** El arreglista apuntó «menú vacío» o «una sola salida» como error. */
const TRES: Razonables = { cuantas: 3 };

/** Un seguir que acaba en ese grado: «acabar en V otra vez». */
const seQuedaEn = (grado: DegreeSymbol) =>
  dicho(`sigue y se queda en ${grado}`, y(esCamino('seguir'), cierraCon(grado)));

/** «Abrir una parte nueva larga» en un final: un contraste, o más de ocho compases. */
const PARTE_NUEVA_LARGA = dicho(
  'abre una parte nueva larga: un contraste, o más de ocho compases',
  o(esCamino('contraste'), duraMasDe(8)),
);

/** «Otro pre»: tu pre otra vez, o algo que se llama así. */
const OTRO_PRE = dicho('es otro pre', o(repiteLoTuyo(), seLlama(/\bpre\b/i)));

/** «Construir encima del dudoso como si fuera seguro»: citarlo así o cerrar sobre él. */
const LO_DUDOSO = dicho(
  'se fía de lo que se oyó con duda: lo cita como seguro o cierra encima',
  o(citaLoDudosoComoSeguro(), cierraSobreLoDudoso()),
);

// --- El corpus -------------------------------------------------------------------------

export const CORPUS_QUINTO: readonly CasoQuinto[] = [
  // --- Mayor -------------------------------------------------------------------------
  caso({
    id: 'M01',
    familia: 'pop-rock-cantautor',
    que: 'estrofa pop, I V vi IV',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi IV',
    papel: 'estrofa',
    estilo: 'pop',
    // «Segunda vuelta que cierra: I V IV I o … IV V I», «estribillo: IV V I vi», «otra
    // estrofa igual y luego pre ii IV V».
    debe: [
      o(
        y(sigueCon('I'), o(cierraCon('IV', 'I'), cierraCon('IV', 'V', 'I'))),
        dicho('un estribillo que arranca en IV', empiezaEn('IV')),
        y(repiteLoTuyo(), meteElGiro('ii', 'IV', 'V')),
      ),
    ],
    noDebe: [
      dicho('bII o bVI sin motivo en una estrofa pop', o(meteElGrado('bII'), meteElGrado('bVI'))),
      dicho('acaba en iii o vii°', o(cierraCon('iii'), cierraCon('vii°'))),
      dicho('un ii–V con séptimas de jazz', y(meteElGiro('ii', 'V'), poneComo('ii', 'minor7'))),
    ],
  }),
  caso({
    id: 'M02',
    familia: 'pop-rock-cantautor',
    que: 'estribillo de rock, I bVII IV I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I bVII IV I',
    papel: 'estribillo',
    estilo: 'rock',
    // «Otra vuelta», «cerrar con V o con bVII–I», «puente: vi IV / bVI bVII I».
    debe: [
      o(
        repiteLoTuyo(),
        y(esCamino('seguir'), o(cierraCon('V', 'I'), cierraCon('bVII', 'I'))),
        y(esCamino('contraste'), o(empiezaEn('vi'), pasaPor('bVI'))),
      ),
    ],
    noDebe: [
      dicho('V/iii o vii°', o(meteElGrado('V/iii'), meteElGrado('vii°'))),
      dicho(
        'un ii–V–I jazzero',
        y(meteElGiro('ii', 'V', 'I'), o(algoNuevoEn('minor7'), algoNuevoEn('major7'))),
      ),
      // «Convertirlo en pop quitando el bVII»: lo nuevo deja el bVII y se va al V–vi.
      dicho(
        'lo convierte en pop: lo nuevo sin bVII y con el V–vi',
        y(no(pasaPor('bVII')), meteElGiro('V', 'vi')),
      ),
    ],
  }),
  caso({
    id: 'M03',
    familia: 'baladas',
    que: 'estribillo de balada, I vi IV V',
    mode: 'major',
    kind: 'retocar',
    toma: 'I vi IV V',
    papel: 'estribillo',
    estilo: 'pop',
    // «I vi ii V», «I iii IV V», «I vi IV iv». La cuarta del arreglista se descarta a
    // sí misma («no cabe»).
    debe: [o(queda('I vi ii V'), queda('I iii IV V'), queda('I vi IV iv'))],
    noDebe: [
      BII,
      dicho('cambia el I del arranque por algo lejano', cambiaElCompasQueAbre(['iii', 'vi'])),
      // Su propia buena acaba en iv, que también lleva a casa: eso no es quitarla.
      // **Corregida**: se tradujo como «cambia el compás 4», y eso tachaba `I vi V I`,
      // que llega a la dominante un compás antes y la resuelve. Quitarla es que no
      // quede ningún V (ni el iv que el arreglista acepta en su lugar).
      dicho('le quita la llegada a la dominante', y(no(tieneElGrado('V')), no(compasEs(4, 'iv')))),
    ],
  }),
  caso({
    id: 'M04',
    familia: 'country-folk-reggae',
    que: 'estrofa country, I IV I V',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV I V',
    papel: 'estrofa',
    estilo: 'country',
    // «I IV V I», «I IV V/V V → I», «IV IV I I | V V I I».
    debe: [
      o(
        y(sigueCon('I'), cierraCon('V', 'I')),
        meteElGiro('V/V', 'V'),
        y(sigueCon('IV'), cierraCon('V', 'I')),
      ),
    ],
    noDebe: [
      dicho('bVI o iv menor', o(meteElGrado('bVI'), meteElGrado('iv'))),
      dicho('mete iii', meteElGrado('iii')),
      SEPTIMAS_DE_JAZZ,
    ],
  }),
  caso({
    id: 'M05',
    familia: 'blues-jazz-funk',
    que: 'blues de 12, los ocho primeros',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@dominant7 I@dominant7 I@dominant7 I@dominant7 IV@dominant7 IV@dominant7 I@dominant7 I@dominant7',
    papel: 'estrofa',
    estilo: 'blues',
    // «V7 IV7 I7 V7», «V7 IV7 I7 I7», «V7 V7 I7 I7»: los cuatro que faltan, desde el V7.
    debe: [y(alarga(4), sigueCon('V'))],
    noDebe: [
      TRIADAS,
      dicho(
        'vi, iii o un ii–V pop',
        o(meteElGrado('vi'), meteElGrado('iii'), poneComo('ii', null)),
      ),
      dicho('no son los cuatro compases que faltan', no(alarga(4))),
    ],
  }),
  caso({
    id: 'M06',
    familia: 'blues-jazz-funk',
    que: 'jazz, ii7 V7 Imaj7 Imaj7',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii@minor7 V@dominant7 I@major7 I@major7',
    estilo: 'jazz',
    // «vi7 ii7 V7 Imaj7», «V/ii7 ii7 V7 Imaj7», «IVmaj7 iv7 iii7 V/ii7…».
    debe: [
      o(
        cierraCon('vi', 'ii', 'V', 'I'),
        cierraCon('V/ii', 'ii', 'V', 'I'),
        y(sigueCon('IV'), pasaPor('iv')),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('el bVII rockero', poneComo('bVII', null)),
      dicho('un I IV V de tres acordes', loNuevoSoloCon('I', 'IV', 'V')),
    ],
  }),
  caso({
    id: 'M07',
    familia: 'blues-jazz-funk',
    que: 'vamp de funk, I7 I7 IV7 I7',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@dominant7 I@dominant7 IV@dominant7 I@dominant7',
    estilo: 'funk',
    // «I7 IV7 I7 IV7», «I7 bVII7 I7 IV7», «I7 I7 IV7 bVII7»: el IV7 que va y viene, o el bVII7.
    debe: [o(queda('I IV I IV'), poneComo('bVII', 'dominant7'))],
    noDebe: [
      dicho('una cadencia V–I con sensible, clásica', meteElGiro('V', 'I')),
      dicho('mete vi', meteElGrado('vi')),
      dicho('tríadas o maj7', o(no(loNuevoConSeptima()), algoNuevoEn('major7'))),
    ],
  }),
  caso({
    id: 'M08',
    familia: 'country-folk-reggae',
    que: 'estrofa de reggae, I IV I IV',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV I IV',
    papel: 'estrofa',
    estilo: 'reggae',
    // «vi IV I V (estribillo)», «V IV I I», «I IV V IV».
    debe: [o(empiezaEn('vi'), y(sigueCon('V'), cierraCon('IV', 'I')), meteElGiro('IV', 'V', 'IV'))],
    noDebe: [BII, SEPTIMAS_DE_JAZZ, dicho('una cadencia larga con V/V', meteElGrado('V/V'))],
  }),
  caso({
    id: 'M09',
    familia: 'cine',
    que: 'cine, I bVI IV I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I bVI IV I',
    estilo: 'cine',
    // «I bVI bVII I», «I bVI iv I», «I iii IV iv».
    debe: [o(queda('I bVI bVII I'), queda('I bVI iv I'), queda('I iii IV iv'))],
    noDebe: [septimaDeBlues(), dicho('un ii–V de jazz', meteElGiro('ii', 'V')), V_DE_V],
  }),
  caso({
    id: 'M10',
    familia: 'forma-y-papel',
    que: 'antecedente de un periodo, I IV V V con punteo',
    mode: 'major',
    kind: 'continuar',
    toma: 'I IV V V',
    papel: 'estrofa',
    punteo: ['0F 4', '9F 5', '2F 11', '7F'],
    // «I IV V I (consecuente paralelo)», «I ii V I», «vi IV V I»: cuatro compases que cierran.
    debe: [y(alarga(4), cierraCon('V', 'I'), o(sigueCon('I'), sigueCon('vi')))],
    noDebe: [
      dicho('acaba otra vez en V', seQuedaEn('V')),
      dicho(
        'sale a otra parte sin cerrar el periodo',
        y(esCamino('contraste'), no(compasEs(8, 'I'))),
      ),
      dicho('mete bVI', meteElGrado('bVI')),
    ],
  }),
  caso({
    id: 'M11',
    familia: 'forma-y-papel',
    que: 'las dos A de un rhythm changes, Imaj7 vi7 ii7 V7 dos veces',
    mode: 'major',
    kind: 'continuar',
    toma: 'I@major7 vi@minor7 ii@minor7 V@dominant7 I@major7 vi@minor7 ii@minor7 V@dominant7',
    papel: 'estrofa',
    estilo: 'jazz',
    // «B: V/vi7 … V/ii7 … V/V7 … V7», «B: IVmaj7 iv7 iii7 V/ii7 ii7 V7», «A otra vez
    // acabando en Imaj7».
    debe: [
      o(
        y(esCamino('contraste'), o(empiezaEn('V/vi', 'IV'), meteElGiro('V/ii', 'V/V'))),
        y(sigueCon('I'), cierraEnLaTonica()),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('el bVII rockero', poneComo('bVII', null)),
      dicho(
        'un puente que no se va a ningún sitio',
        y(esCamino('contraste'), o(contrasteQueReposaEnLaTonica(), soloConLoTuyo())),
      ),
    ],
  }),
  caso({
    id: 'M12',
    familia: 'vals',
    que: 'vals, I I V7 V7 V7 V7 I I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I:3 I:3 V:3@dominant7 V:3@dominant7 V:3@dominant7 V:3@dominant7 I:3 I:3',
    pulsosPorCompas: 3,
    // «IV IV I I V V I I», «I I IV IV V V I I», «vi vi ii ii V V I I». «Un acorde por
    // pulso» ya lo prohíbe `NUNCA`. **Corregida**: se tradujo cada una con su
    // penúltimo acorde, y lo que comparten las tres es otra cosa —ocho compases que
    // arrancan en IV, I o vi y cierran V–I—; `IV V I vi IV ii V I` es la primera con
    // el ii delante del V que pone la tercera.
    debe: [y(alarga(8), cierraCon('V', 'I'), o(sigueCon('IV'), sigueCon('I'), sigueCon('vi')))],
    noDebe: [COMPASES_DE_CUATRO, dicho('acaba en V', seQuedaEn('V'))],
  }),
  caso({
    id: 'M13',
    familia: 'flamenco-rumba-bolero',
    que: 'bolero, Imaj7 vi7 ii7 V7',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@major7 vi@minor7 ii@minor7 V@dominant7',
    estilo: 'bolero',
    // «Imaj7 V/ii7 ii7 V7», «iii7 vi7 ii7 V7», «Imaj7 vi7 ii7 bII7».
    debe: [o(queda('I V/ii ii V'), queda('iii vi ii V'), queda('I vi ii bII'))],
    noDebe: [TRIADAS, dicho('el bVII rockero', poneComo('bVII', null)), QUINTAS],
  }),
  caso({
    id: 'M14',
    familia: 'limite-y-contexto',
    que: 'un solo acorde, I',
    mode: 'major',
    kind: 'continuar',
    toma: 'I',
    // «I IV V I», «I V vi IV», «I vi IV V».
    debe: [
      o(
        meteElGiro('I', 'IV', 'V', 'I'),
        meteElGiro('I', 'V', 'vi', 'IV'),
        meteElGiro('I', 'vi', 'IV', 'V'),
      ),
    ],
    noDebe: [dicho('préstamos raros de entrada: el bII', meteElGrado('bII'))],
    razonables: TRES,
  }),
  caso({
    id: 'M15',
    familia: 'limite-y-contexto',
    que: 'pop con punteo de una nota por compás, I IV V I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV V I',
    punteo: ['4F', '9F', '2F', '0F'],
    estilo: 'pop',
    // «I ii V I», «vi IV V I», «iii IV V I», «I ii bVII I».
    debe: [o(queda('I ii V I'), queda('vi IV V I'), queda('iii IV V I'), queda('I ii bVII I'))],
    noDebe: [
      dicho('bVI bajo el Mi', compasEs(1, 'bVI')),
      dicho('iv bajo el La', compasEs(2, 'iv')),
      noLlevaLaNotaFuerte(['4F', '9F', '2F', '0F']),
    ],
  }),
  caso({
    id: 'M16',
    familia: 'country-folk-reggae',
    que: 'estrofa country de ocho, I I IV IV V V I I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I I IV IV V V I I',
    papel: 'estrofa',
    estilo: 'country',
    // «I I IV IV V/V V/V V I», «I I IV IV I I V I». La tercera, «V V7», solo cambia la
    // especie, y eso no lo ve ningún predicado.
    debe: [o(queda('I IV V/V V I'), queda('I IV I V I'), meteElGiro('V/V', 'V', 'I'))],
    noDebe: [
      dicho('iv o bVI', o(meteElGrado('iv'), meteElGrado('bVI'))),
      dicho(
        'un ii–V–I jazzero con séptimas',
        y(meteElGiro('ii', 'V'), o(algoNuevoEn('minor7'), algoNuevoEn('major7'))),
      ),
      dicho('le quita la llegada V–I', no(cierraCon('V', 'I'))),
    ],
  }),
  caso({
    id: 'M17',
    familia: 'pop-rock-cantautor',
    que: 'intro de rock en quintas, I5 V5 vi5 IV5',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@quinta V@quinta vi@quinta IV@quinta',
    papel: 'intro',
    estilo: 'rock',
    // «I5 bVII5 IV5 I5», «I5 bVI5 bVII5 I5», «vi5 IV5 I5 V5».
    debe: [o(queda('I bVII IV I'), queda('I bVI bVII I'), queda('vi IV I V'))],
    noDebe: [
      FUERA_DE_LAS_QUINTAS,
      SEPTIMAS_EN_LAS_QUINTAS,
      dicho('iii o vii°', o(meteElGrado('iii'), meteElGrado('vii°'))),
    ],
  }),
  caso({
    id: 'M18',
    familia: 'baladas',
    que: 'balada con la subdominante menor, I IV iv I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV iv I',
    estilo: 'pop',
    // «I vi IV iv», «I iii IV iv», «I bVII IV I».
    debe: [o(queda('I vi IV iv'), queda('I iii IV iv'), queda('I bVII IV I'))],
    noDebe: [
      BII,
      dicho('quita el iv y no deja nada que oscurezca', pierdeElPrestado()),
      dicho('mete V/iii', meteElGrado('V/iii')),
    ],
  }),
  caso({
    id: 'M19',
    familia: 'forma-y-papel',
    que: 'final de pop, I V vi IV',
    mode: 'major',
    kind: 'continuar',
    toma: 'I V vi IV',
    papel: 'final',
    estilo: 'pop',
    // «IV V I», «ii V I», «IV iv I».
    debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'), cierraCon('IV', 'iv', 'I'))],
    // «Acabar en V» es una manera de no acabar en I.
    noDebe: [dicho('no acaba en I', no(cierraEnLaTonica())), PARTE_NUEVA_LARGA],
  }),
  caso({
    id: 'M20',
    familia: 'forma-y-papel',
    que: 'puente de pop, vi iii IV V',
    mode: 'major',
    kind: 'continuar',
    toma: 'vi iii IV V',
    papel: 'puente',
    estilo: 'pop',
    // «Vuelta al estribillo: I V vi IV», «I IV V I», «I vi IV V».
    debe: [
      y(
        sigueCon('I'),
        o(
          meteElGiro('I', 'V', 'vi', 'IV'),
          meteElGiro('I', 'IV', 'V', 'I'),
          meteElGiro('I', 'vi', 'IV', 'V'),
        ),
      ),
    ],
    noDebe: [
      dicho('otro puente en vi', sigueCon('vi')),
      BII,
      dicho('se queda sin volver a I', no(pasaPor('I'))),
    ],
  }),
  caso({
    id: 'M21',
    familia: 'forma-y-papel',
    que: 'pre de pop, ii IV V V',
    mode: 'major',
    kind: 'continuar',
    toma: 'ii IV V V',
    papel: 'pre',
    estilo: 'pop',
    // «Estribillo: I V vi IV», «I IV I V», «vi IV I V (llegada engañosa)».
    debe: [
      o(
        y(sigueCon('I'), o(meteElGiro('I', 'V', 'vi', 'IV'), meteElGiro('I', 'IV', 'I', 'V'))),
        y(sigueCon('vi'), meteElGiro('vi', 'IV', 'I', 'V')),
      ),
    ],
    noDebe: [
      OTRO_PRE,
      dicho(
        'no llega a un estribillo: lo que sigue no entra en la I ni engaña en el vi',
        no(o(sigueCon('I'), sigueCon('vi'))),
      ),
      dicho('iv o bVI sin venir a cuento', o(meteElGrado('iv'), meteElGrado('bVI'))),
    ],
  }),
  caso({
    id: 'M22',
    familia: 'limite-y-contexto',
    que: 'pop con un iii que se oyó con duda, I iii? IV V',
    mode: 'major',
    kind: 'retocar',
    toma: 'I iii? IV V',
    estilo: 'pop',
    // «I vi IV V (cambiar el dudoso por lo que suele ser)», «I V IV V», «I iii IV V tal
    // cual con otro detalle».
    debe: [o(queda('I vi IV V'), queda('I V IV V'), y(compasEs(2, 'iii'), cambiaAlgo()))],
    noDebe: [
      dicho(
        'construye encima del iii como si fuera seguro: V/iii delante, o lo cita así',
        o(meteElGrado('V/iii'), citaLoDudosoComoSeguro()),
      ),
      BII,
    ],
  }),
  caso({
    id: 'M23',
    familia: 'pop-rock-cantautor',
    que: 'pop con suspendidos, Isus4 I IVsus2 IV',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@sus4 I IV@sus2 IV',
    estilo: 'pop',
    // «Isus4 I vi IV», «Isus4 I IVsus2 V», «Isus4 I ii IV».
    debe: [o(queda('I vi IV'), queda('I IV V'), queda('I ii IV'))],
    noDebe: [
      dicho('pierde las sus sin motivo', cambiaTuEspecie()),
      dicho('mete iii', meteElGrado('iii')),
      BII,
    ],
  }),
  caso({
    id: 'M24',
    familia: 'country-folk-reggae',
    que: 'folk de ocho, I IV I V I IV V I',
    mode: 'major',
    kind: 'retocar',
    toma: 'I IV I V I IV V I',
    estilo: 'folk',
    // «I IV vi V I IV V I», «I IV I V vi IV V I», «I IV I V I ii V I».
    debe: [o(queda('I IV vi V I IV V I'), queda('I IV I V vi IV V I'), queda('I IV I V I ii V I'))],
    noDebe: [
      SEPTIMAS_DE_JAZZ,
      dicho('bII o bVI', o(meteElGrado('bII'), meteElGrado('bVI'))),
      dicho('rompe el cierre V–I', no(cierraCon('V', 'I'))),
    ],
  }),
  caso({
    id: 'M25',
    familia: 'blues-jazz-funk',
    que: 'blues de 12 entero, con el cambio rápido',
    mode: 'major',
    kind: 'retocar',
    toma: 'I@dominant7 IV@dominant7 I@dominant7 I@dominant7 IV@dominant7 IV@dominant7 I@dominant7 I@dominant7 V@dominant7 IV@dominant7 I@dominant7 V@dominant7',
    estilo: 'blues',
    // «… I7 V/ii7 ii7 V7 I7 V7 (blues de jazz en 8-10)», «el turnaround I7 V/ii7 ii7 V7»,
    // «V7 V7 en 9-10». El `V/IV` del compás 4 de la segunda no es un grado del dominio.
    debe: [
      o(
        y(compasEs(8, 'V/ii'), compasEs(9, 'ii')),
        meteElGiro('V/ii', 'ii', 'V'),
        compasEs(10, 'V'),
      ),
    ],
    noDebe: [
      TRIADAS,
      dicho('cambia la forma de 12', no(duraCompases(12))),
      dicho('vi o iii, de pop', o(meteElGrado('vi'), meteElGrado('iii'))),
    ],
  }),

  // --- Menor -------------------------------------------------------------------------
  caso({
    id: 'm01',
    familia: 'flamenco-rumba-bolero',
    que: 'andaluza flamenca, i VII VI V',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII VI V',
    estilo: 'flamenco',
    // «Otra vuelta», «iv VI V V / iv iv V V», «VI V VI V (rasgueo sobre la bajada)».
    debe: [
      o(repiteLoTuyo(), y(sigueCon('iv'), cierraCon('V')), y(sigueCon('VI'), cierraCon('VI', 'V'))),
    ],
    noDebe: [
      dicho('la v menor, que quita la cadencia', meteElGrado('v')),
      dicho(
        'un ii–V de jazz',
        y(meteElGiro('ii°', 'V'), o(algoNuevoEn('halfDiminished7'), algoNuevoEn('minor7'))),
      ),
      dicho('el III–VII del pop', meteElGiro('III', 'VII')),
    ],
  }),
  caso({
    id: 'm02',
    familia: 'pop-rock-cantautor',
    que: 'estrofa menor, i iv V i',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv V i',
    papel: 'estrofa',
    // «i VI V i», «i ii° V i», «i iv VII III (abre hacia la relativa)».
    debe: [o(queda('i VI V i'), queda('i ii° V i'), queda('i iv VII III'))],
    noDebe: [
      BII,
      dicho('cambia la i del principio', cambiaElCompasQueAbre()),
      dicho('V/V sin preparación', meteElGrado('V/V')),
    ],
  }),
  caso({
    id: 'm03',
    familia: 'pop-rock-cantautor',
    que: 'estribillo menor de pop, i VI III VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI III VII',
    papel: 'estribillo',
    estilo: 'pop',
    // «Otra vuelta», «cierre: VI VII i i», «puente: iv VI III V».
    debe: [
      o(repiteLoTuyo(), cierraCon('VI', 'VII', 'i'), y(esCamino('contraste'), empiezaEn('iv'))),
    ],
    noDebe: [dicho('mete ii°', meteElGrado('ii°')), BII, V_DE_V],
  }),
  caso({
    id: 'm04',
    familia: 'country-folk-reggae',
    que: 'folk eólico, i v iv i',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i v iv i',
    estilo: 'folk',
    // «i VII iv i», «i VI iv i», «i v VI i / i III iv i».
    debe: [o(queda('i VII iv i'), queda('i VI iv i'), queda('i v VI i'), queda('i III iv i'))],
    noDebe: [
      V_DE_V,
      dicho('mete ii°', meteElGrado('ii°')),
      dicho('maj7 o séptimas de jazz', o(algoNuevoEn('major7'), algoNuevoEn('minor7'))),
    ],
  }),
  caso({
    id: 'm05',
    familia: 'flamenco-rumba-bolero',
    que: 'bolero menor, im7 ivm7 V7 im7',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 iv@minor7 V@dominant7 i@minor7',
    estilo: 'bolero',
    // «im7 ii∅7 V7 im7», «im7 V/iv7 iv7 V7», «im7 iv7 bII7 im7 (tritono)».
    debe: [o(compasEs(2, 'ii°'), meteElGrado('V/iv'), compasEs(3, 'bII'))],
    noDebe: [dicho('el VII rockero', poneComo('VII', null)), QUINTAS, TRIADAS],
  }),
  caso({
    id: 'm06',
    familia: 'blues-jazz-funk',
    que: 'blues menor de 12, los ocho primeros',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 i@minor7 i@minor7 i@minor7 iv@minor7 iv@minor7 i@minor7 i@minor7',
    estilo: 'blues',
    // «VI7 V7 im7 im7», «VI7 V7 im7 V7», «V7 iv7 im7 V7».
    debe: [y(alarga(4), o(sigueCon('VI'), sigueCon('V')))],
    noDebe: [
      TRIADAS,
      dicho('el III del pop', meteElGrado('III')),
      dicho('no pasa por V', no(pasaPor('V'))),
    ],
  }),
  caso({
    id: 'm07',
    familia: 'blues-jazz-funk',
    que: 'jazz menor, ii∅7 V7 im7 im7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'ii°@halfDiminished7 V@dominant7 i@minor7 i@minor7',
    estilo: 'jazz',
    // «iv7 VII7 IIImaj7 VImaj7 | ii∅ V7 im7 im7», «iv7 VII7 IIImaj7 VImaj7», «VI7 V7 im7».
    debe: [o(meteElGiro('iv', 'VII', 'III'), cierraCon('VI', 'V', 'i'))],
    noDebe: [
      TRIADAS,
      QUINTAS,
      dicho(
        'el VII rockero o el III pop, sin séptima',
        o(poneComo('VII', null), poneComo('III', null)),
      ),
    ],
  }),
  caso({
    id: 'm08',
    familia: 'cine',
    que: 'cine menor, i i VI VI iv iv V V',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i i VI VI iv iv V V',
    estilo: 'cine',
    // «i i VI VI bII bII V V (napolitano)», «i III VI VI iv iv V V», «i VII VI VI iv iv V V».
    debe: [o(queda('i VI bII V'), queda('i III VI iv V'), queda('i VII VI iv V'))],
    noDebe: [
      septimaDeBlues(),
      dicho(
        'un ii–V de jazz',
        y(meteElGiro('ii°', 'V'), o(algoNuevoEn('halfDiminished7'), algoNuevoEn('minor7'))),
      ),
      dicho('pierde la llegada al V', no(cierraCon('V'))),
    ],
  }),
  caso({
    id: 'm09',
    familia: 'limite-y-contexto',
    que: 'metal en quintas con el bII, i5 bII5 i5 bII5',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@quinta bII@quinta i@quinta bII@quinta',
    estilo: 'metal',
    // «i5 bII5 i5 VII5», «i5 bII5 VI5 VII5 / i5 VI5 bII5 i5», «i5 bII5 i5 v5».
    debe: [o(queda('i bII i VII'), queda('i bII VI VII'), queda('i VI bII i'), queda('i bII i v'))],
    noDebe: [
      FUERA_DE_LAS_QUINTAS,
      SEPTIMAS_EN_LAS_QUINTAS,
      dicho('el III del pop', meteElGrado('III')),
    ],
  }),
  caso({
    id: 'm10',
    familia: 'country-folk-reggae',
    que: 'estrofa de reggae menor, i VII i VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII i VII',
    papel: 'estrofa',
    estilo: 'reggae',
    // «VI VII i i (estribillo)», «iv VII i VII», «iv iv i i | VI VII i i».
    debe: [o(y(sigueCon('VI'), cierraCon('VI', 'VII', 'i')), sigueCon('iv'))],
    noDebe: [V_DE_V, SEPTIMAS_DE_JAZZ, BII],
  }),
  caso({
    id: 'm11',
    familia: 'blues-jazz-funk',
    que: 'vamp de funk menor, im7 ivm7 im7 ivm7',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 iv@minor7 i@minor7 iv@minor7',
    estilo: 'funk',
    // «im7 iv7 VII7 im7», «im7 im7 iv7 VII7», «im7 iv7 v7 im7».
    debe: [o(poneComo('VII', 'dominant7'), poneComo('v', 'minor7'))],
    noDebe: [
      TRIADAS,
      dicho('un V–i cadencial, clásico', meteElGiro('V', 'i')),
      dicho('el IIImaj7 de balada', poneComo('III', 'major7')),
    ],
  }),
  caso({
    id: 'm12',
    familia: 'vals',
    que: 'vals menor, i i iv iv V V i i',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i:3 i:3 iv:3 iv:3 V:3 V:3 i:3 i:3',
    pulsosPorCompas: 3,
    // «VI VI iv iv V V i i», «III III VII VII VI VI V V», «i i iv iv V V i i (otra vuelta)».
    debe: [y(alarga(8), o(sigueCon('VI'), sigueCon('III'), repiteLoTuyo()))],
    noDebe: [COMPASES_DE_CUATRO, dicho('acaba en la v menor', cierraCon('v'))],
  }),
  caso({
    id: 'm13',
    familia: 'forma-y-papel',
    que: 'antecedente menor, i iv V V con punteo',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i iv V V',
    papel: 'estrofa',
    punteo: ['0F 3', '5F 8', '11F 2', '7F'],
    // «i iv V i (consecuente)», «VI iv V i», «i ii° V i».
    debe: [y(alarga(4), cierraCon('V', 'i'), o(sigueCon('i'), sigueCon('VI')))],
    noDebe: [
      dicho('acaba en V otra vez', seQuedaEn('V')),
      dicho('la v menor en la cadencia', meteElGiro('v', 'i')),
      BII,
    ],
  }),
  caso({
    id: 'm14',
    familia: 'forma-y-papel',
    que: 'final menor de pop, i VI III VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VI III VII',
    papel: 'final',
    estilo: 'pop',
    // «VI VII i», «iv V i», «VI VII i i».
    debe: [o(cierraCon('VI', 'VII', 'i'), cierraCon('iv', 'V', 'i'))],
    // «Acabar en VII» es una manera de no acabar en i.
    noDebe: [dicho('no acaba en i', no(cierraEnLaTonica())), PARTE_NUEVA_LARGA],
  }),
  caso({
    id: 'm15',
    familia: 'forma-y-papel',
    que: 'puente menor de pop, III VII iv V',
    mode: 'minor',
    kind: 'retocar',
    toma: 'III VII iv V',
    papel: 'puente',
    estilo: 'pop',
    // «III VII VI V», «III VI iv V», «VI VII iv V».
    debe: [o(queda('III VII VI V'), queda('III VI iv V'), queda('VI VII iv V'))],
    noDebe: [
      dicho('acaba en i: cierra el puente', cierraEnLaTonica()),
      BII,
      dicho('le quita la tensión final', no(cierraCon('V'))),
    ],
  }),
  caso({
    id: 'm16',
    familia: 'limite-y-contexto',
    que: 'menor con punteo de una nota por compás, i VI iv V',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i VI iv V',
    punteo: ['3F', '0F', '5F', '11F'],
    // «i iv ii° V», «i VI VII V», «i iv bII V», «i i iv V».
    debe: [o(queda('i iv ii° V'), queda('i VI VII V'), queda('i iv bII V'), queda('i iv V'))],
    noDebe: [
      dicho('la v menor bajo el Sol#', compasEs(4, 'v')),
      dicho('V bajo el Do en el compás 1', compasEs(1, 'V')),
      dicho('III bajo el La', compasEs(2, 'III')),
    ],
  }),
  caso({
    id: 'm17',
    familia: 'flamenco-rumba-bolero',
    que: 'andaluza flamenca a dos compases, i i VII VII VI VI V7 V7',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i i VII VII VI VI V@dominant7 V@dominant7',
    estilo: 'flamenco',
    // «i i iv iv VI VI V7 V7», «i VII VI V7 i VII VI V7 (doble)», «iv iv VII VII VI VI V7 V7».
    debe: [o(queda('i iv VI V'), queda('i VII VI V i VII VI V'), queda('iv VII VI V'))],
    noDebe: [
      dicho('la v menor', meteElGrado('v')),
      dicho('el III–VII del pop', meteElGiro('III', 'VII')),
      dicho('tríadas encima del V7', poneComo('V', null)),
    ],
  }),
  caso({
    id: 'm18',
    familia: 'limite-y-contexto',
    que: 'menor de pop con un VII que se oyó con duda, i iv VII? III',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i iv VII? III',
    estilo: 'pop',
    // «VI ii° V i (círculo)», «VI VII i i», «otra vuelta i iv VII III».
    debe: [
      o(cierraCon('VI', 'ii°', 'V', 'i'), y(sigueCon('VI'), cierraCon('VII', 'i')), repiteLoTuyo()),
    ],
    noDebe: [LO_DUDOSO, BII, V_DE_V],
  }),
  caso({
    id: 'm19',
    familia: 'country-folk-reggae',
    que: 'estrofa folk eólica, i VII VI VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i VII VI VII',
    papel: 'estrofa',
    estilo: 'folk',
    // «VI VII i i», «iv VI VII i», «III VII i i».
    debe: [o(cierraCon('VI', 'VII', 'i'), cierraCon('III', 'VII', 'i'))],
    noDebe: [V_DE_V, SEPTIMAS_DE_JAZZ, BII],
  }),
  caso({
    id: 'm20',
    familia: 'forma-y-papel',
    que: 'pre menor de pop, VI VII VI VII',
    mode: 'minor',
    kind: 'continuar',
    toma: 'VI VII VI VII',
    papel: 'pre',
    estilo: 'pop',
    // «Estribillo: i VI III VII», «i iv VII III», «i VII VI V»: todas entran en la i.
    debe: [sigueCon('i')],
    noDebe: [
      dicho('no llega a la i', no(pasaPor('i'))),
      OTRO_PRE,
      dicho('mete ii°', meteElGrado('ii°')),
    ],
  }),
  caso({
    id: 'm21',
    familia: 'limite-y-contexto',
    que: 'dos compases, i iv',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i iv',
    // «i VI», «i VII», «i ii°». «Pasarlo a mayor» no se traduce: en menor no hay IV.
    debe: [o(queda('i VI'), queda('i VII'), queda('i ii°'))],
    noDebe: [dicho('lo alarga', no(duraCompases(2)))],
    razonables: TRES,
  }),
  caso({
    id: 'm22',
    familia: 'blues-jazz-funk',
    que: 'jazz menor, im7 im7 ivm7 V7',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 i@minor7 iv@minor7 V@dominant7',
    estilo: 'jazz',
    // «im7 V/iv7 iv7 V7», «im7 VImaj7 ii∅7 V7», «im7 im7 ii∅7 V7».
    debe: [o(compasEs(2, 'V/iv'), compasEs(3, 'ii°'))],
    noDebe: [
      TRIADAS,
      dicho('el VII rockero', poneComo('VII', null)),
      dicho('la v menor', meteElGrado('v')),
    ],
  }),
  caso({
    id: 'm23',
    familia: 'blues-jazz-funk',
    que: 'blues menor de 12 entero',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i@minor7 i@minor7 i@minor7 i@minor7 iv@minor7 iv@minor7 i@minor7 i@minor7 VI@dominant7 V@dominant7 i@minor7 V@dominant7',
    estilo: 'blues',
    // «im7 iv7 im7 im7 … (cambio rápido)», «… ii∅7 V7 en 9–10», «… bII7 V7 en 9–10».
    debe: [o(compasEs(2, 'iv'), compasEs(9, 'ii°'), compasEs(9, 'bII'))],
    noDebe: [
      TRIADAS,
      dicho('el III del pop', meteElGrado('III')),
      dicho('cambia la forma de 12', no(duraCompases(12))),
    ],
  }),
  caso({
    id: 'm24',
    familia: 'flamenco-rumba-bolero',
    que: 'estrofa de bolero menor, im7 V7/iv ivm7 ivm7',
    mode: 'minor',
    kind: 'continuar',
    toma: 'i@minor7 V/iv@dominant7 iv@minor7 iv@minor7',
    papel: 'estrofa',
    estilo: 'bolero',
    // «V7 V7 im7 im7», «VII7 IIImaj7 ii∅7 V7», «ii∅7 V7 im7 V7».
    debe: [
      o(
        y(sigueCon('V'), cierraCon('V', 'i')),
        meteElGiro('VII', 'III', 'ii°', 'V'),
        y(sigueCon('ii°'), meteElGiro('ii°', 'V', 'i')),
      ),
    ],
    noDebe: [
      dicho('rock: el VII sin séptima, o quintas', o(poneComo('VII', null), algoNuevoEn('quinta'))),
      TRIADAS,
      dicho('acaba en iv', cierraCon('iv')),
    ],
  }),
  caso({
    id: 'm25',
    familia: 'limite-y-contexto',
    que: 'andaluza de pop a dos pulsos, i VII VI V dos veces',
    mode: 'minor',
    kind: 'retocar',
    toma: 'i:2 VII:2 VI:2 V:2 i:2 VII:2 VI:2 V:2',
    estilo: 'pop',
    // «i iv VI V | i VII VI V (a dos pulsos)», «i VII VI V7 …», «i III VI V …». La
    // segunda solo cambia la especie del V, y eso no lo ve ningún predicado. Los
    // números son de acorde, no de compás: cada uno dura medio.
    debe: [
      y(
        loNuevoVaA(2),
        o(compasEs(2, 'iv'), compasEs(2, 'III'), compasEs(6, 'iv'), compasEs(6, 'III')),
      ),
    ],
    noDebe: [
      dicho('compases de cuatro que doblan la duración', o(algoNuevoDura(4), no(duraCompases(4)))),
      // **Corregida**: se tradujo como «cambia el acorde 4 o el 8», y `i VII VI V i iv V
      // i` no pierde ningún V, lo mueve. Perderlo es que suene menos veces.
      dicho('pierde el V', menosVecesQueTu('V')),
      dicho('la v menor', meteElGrado('v')),
    ],
  }),
];

// --- Los exámenes ------------------------------------------------------------------

export interface ExamenQuinto {
  readonly caso: CasoExigible & { readonly familia: FamiliaQuinta };
  readonly kind: PathKind;
}

/** Lo que no se pide a la petición para la que no se escribió el caso. */
const SIN_EXAMEN: LoQueSeExige = { debe: [], noDebe: [] };

/** Cada caso por su petición: cincuenta menús. */
export function examenesQuintos(corpus: readonly CasoQuinto[] = CORPUS_QUINTO): ExamenQuinto[] {
  return corpus.map((caso) => ({
    kind: caso.kind,
    caso: {
      id: caso.id,
      familia: caso.familia,
      que: caso.que,
      mode: caso.mode,
      compases: caso.compases,
      contexto: caso.contexto,
      continuar: caso.kind === 'continuar' ? caso.espera : SIN_EXAMEN,
      ...(caso.kind === 'retocar' ? { retocar: caso.espera } : {}),
    },
  }));
}
