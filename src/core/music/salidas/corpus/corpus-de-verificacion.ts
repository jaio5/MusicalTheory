/**
 * El corpus de verificación: **48 canciones a medias que el equipo no había
 * visto**, escritas por una verificación independiente antes de ejecutar nada.
 *
 * El corpus de las salidas (`corpus-de-salidas.ts`) llegó al 98 % y la
 * verificación demostró que el examen era blando: un `debe` es «alguna de las tres
 * primeras hace algo de esto», casi siempre con varias alternativas, así que
 * basta con que **una** acierte y las otras dos pueden ser malas. Un menú con un
 * buen cierre arriba y dos disparates debajo aprobaba entero.
 *
 * Este examen pide más. Además del `debe` y el `noDebe` de siempre, **cada una de
 * las tres primeras** tiene que pasar los `noDebe` y lo `aceptable` de su caso —lo
 * mínimo que no suena mal: un estribillo que sigue cerrando en la tónica, un riff
 * de quintas que sigue en quintas, un acorde nuevo que no choca con el punteo—.
 * Y en los casos raros —un acorde solo, treinta y dos compases, pulsos de uno, una
 * toma entera dudosa— pide **al menos tres salidas razonables**, o dice por qué no
 * puede haberlas.
 *
 * Se escribió en prosa, con buenas respuestas y errores; aquí está traducido a
 * predicados del corpus viejo, con los que le faltaban añadidos allí. Las tomas van
 * en la notación del verificador, `grado:pulsos@especie?` (`leerToma`), que se lee
 * de un vistazo y deja ver el caso entero en una línea.
 *
 * **El vocabulario tiene huecos**, y no se rellenan inventando grados: en menor no
 * hay IV mayor (dórico), en mayor no hay II mayor fuera de `V/V`, ni I7 como `V/IV`,
 * ni inversiones. Donde el verificador pedía uno de esos, la expectativa se queda
 * con lo que sí se puede escribir.
 */

import { esEspecieDeBloque, type EspecieDeBloque } from '../../chords';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { SectionRole } from '../../song';
import type { StyleId } from '../../styles';
import type { ContextoDeSalidas, NotaDelCompas } from '../contexto';
import type { PathKind, PathStep, SalidaPosible } from '../tipos';
import {
  acabaAMitadDeCompas,
  alarga,
  algoNuevoEn,
  cambiaAlgo,
  cambiaAlgunoEntre,
  cambiaElCompasQueAbre,
  cambiaLoDudoso,
  cambiaTuEspecie,
  chocaConElPunteo,
  cierraCon,
  cierraEnLaTonica,
  cifras,
  compasDeUnPulso,
  compasEs,
  conservaElFinal,
  conSuEstilo,
  cuadra,
  dicho,
  dominanteSinSeptima,
  duraCompases,
  empiezaEn,
  enGrados,
  enLinea,
  esCamino,
  examinar,
  fraseCoja,
  fueraDeLaRejilla,
  llevaTusEspecies,
  loNuevoConSeptima,
  loNuevoEn,
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
  PRIMERAS,
  relleno,
  repiteAlVecino,
  repiteLoTuyo,
  respetaFrasesDe,
  sigueCon,
  tieneElGrado,
  y,
  type Expectativa,
  type Incumplida,
  type LoQueSeEspera,
  type SalidaExaminada,
} from './corpus-de-salidas';

// --- La notación del verificador ------------------------------------------------

/** Una toma leída: los compases y lo que se sabe de ellos, alineado compás a compás. */
export interface Toma {
  readonly compases: readonly PathStep[];
  /** Ausente si ningún compás dice especie: entonces todos son tríadas. */
  readonly especies?: readonly (EspecieDeBloque | null)[];
  /** Ausente si no hay ninguno dudoso. */
  readonly dudosos?: readonly boolean[];
}

const COMPAS = /^([^:@?]+)(?::(\d+))?(?:@([A-Za-z0-9]+))?(\?)?$/;

/**
 * Lee una toma escrita como `'I:2 V/vi:2@dominant7 vi?'`: grado, pulsos si no son
 * los de por defecto, especie si la lleva y `?` si se oyó con duda.
 *
 * **Revienta con lo que no entiende**, en vez de saltárselo: un compás mal escrito
 * que desapareciera en silencio examinaría otra canción.
 */
export function leerToma(texto: string, pulsos = 4): Toma {
  const leidos = texto
    .trim()
    .split(/\s+/)
    .map((compas) => {
      const partes = COMPAS.exec(compas);
      if (partes === null) {
        throw new SyntaxError(`No se entiende el compás «${compas}».`);
      }
      const [, degree, beats, especie, duda] = partes;
      if (especie !== undefined && !esEspecieDeBloque(especie)) {
        throw new SyntaxError(`«${especie}» no es una especie, en «${compas}».`);
      }
      return {
        paso: {
          degree: degree as DegreeSymbol,
          beats: beats === undefined ? pulsos : Number(beats),
        },
        especie: especie ?? null,
        dudoso: duda !== undefined,
      };
    });
  const especies = leidos.map((leido) => leido.especie);
  const dudosos = leidos.map((leido) => leido.dudoso);
  return {
    compases: leidos.map((leido) => leido.paso),
    ...(especies.some((especie) => especie !== null) ? { especies } : {}),
    ...(dudosos.some(Boolean) ? { dudosos } : {}),
  };
}

const NOTA = /^(\d{1,2})(F?)$/;

/**
 * Lee el punteo de cada compás: semitonos sobre la tónica, con `F` los que caen en
 * un pulso fuerte. `['0F 4', '9F']` es un Do fuerte y un Mi en el primer compás y
 * un La fuerte en el segundo, en Do.
 */
export function leerPunteo(compases: readonly string[]): NotaDelCompas[][] {
  return compases.map((compas) =>
    compas
      .trim()
      .split(/\s+/)
      .filter((nota) => nota !== '')
      .map((nota) => {
        const partes = NOTA.exec(nota);
        if (partes === null || Number(partes[1]) > 11) {
          throw new SyntaxError(`No se entiende la nota «${nota}».`);
        }
        return { nota: Number(partes[1]), fuerte: partes[2] === 'F' };
      }),
  );
}

// --- Lo que se exige ------------------------------------------------------------

/** Cuántas salidas razonables tiene que haber en el menú, y por qué no más si son pocas. */
export interface Razonables {
  readonly cuantas: number;
  /** Por qué no pueden ser tres: sin esto, menos de tres es un error. */
  readonly porque?: string;
}

/**
 * Lo que se espera de una petición, **con la calidad de las primeras**.
 *
 * Opcionales para que el corpus viejo se pueda examinar igual: sin `aceptable`,
 * la calidad de las primeras es pasar los `noDebe`.
 */
export interface LoQueSeExige extends LoQueSeEspera {
  /**
   * Lo mínimo que no suena mal: **cada una** de las tres primeras lo cumple, y
   * además no hace nada de lo de `noDebe`.
   */
  readonly aceptable?: readonly Expectativa[];
  /** En los casos raros: cuántas del menú entero pasan lo mismo que las primeras. */
  readonly razonables?: Razonables;
}

/** Lo que hace falta de un caso para examinarlo así, sea de este corpus o del viejo. */
export interface CasoExigible {
  readonly id: string;
  readonly familia: string;
  readonly que: string;
  readonly mode: KeyMode;
  readonly compases: readonly PathStep[];
  readonly contexto: ContextoDeSalidas;
  readonly continuar: LoQueSeExige;
  readonly retocar?: LoQueSeExige;
}

/**
 * Las familias, para leer la nota por partes. Juntan los estilos del verificador
 * de seis en seis, más o menos, para que cada cifra cuente algo.
 */
export type FamiliaDeVerificacion =
  | 'pop-balada-soul-cine'
  | 'jazz-gospel-bossa-bolero'
  | 'rock-punk-metal-blues'
  | 'menor-andaluza-folk-vals'
  | 'especies-punteo-duda-intro'
  | 'raros';

export const FAMILIAS_DE_VERIFICACION: readonly FamiliaDeVerificacion[] = [
  'pop-balada-soul-cine',
  'jazz-gospel-bossa-bolero',
  'rock-punk-metal-blues',
  'menor-andaluza-folk-vals',
  'especies-punteo-duda-intro',
  'raros',
];

/** En este corpus todo se exige con su `aceptable`: el verificador habló de las dos peticiones. */
interface ExigenciaDeVerificacion extends LoQueSeExige {
  readonly aceptable: readonly Expectativa[];
}

export interface CasoDeVerificacion extends CasoExigible {
  readonly familia: FamiliaDeVerificacion;
  /** El giro que no tiene estilo propio en `styles.ts`: gospel, bolero, cine. */
  readonly giro?: string;
  readonly continuar: ExigenciaDeVerificacion;
  readonly retocar: ExigenciaDeVerificacion;
}

/** Un caso como lo escribió el verificador: la toma en su notación y el contexto suelto. */
interface CasoEscrito {
  readonly id: string;
  readonly familia: FamiliaDeVerificacion;
  readonly que: string;
  readonly mode: KeyMode;
  readonly toma: string;
  /** Los pulsos de los compases que no los dicen. */
  readonly pulsos?: number;
  readonly estilo?: StyleId;
  readonly pulsosPorCompas?: number;
  readonly papel?: SectionRole;
  readonly punteo?: readonly string[];
  readonly giro?: string;
  readonly continuar: ExigenciaDeVerificacion;
  readonly retocar: ExigenciaDeVerificacion;
}

function caso({ toma, pulsos, estilo, pulsosPorCompas, papel, punteo, ...resto }: CasoEscrito) {
  const { compases, ...contexto } = leerToma(toma, pulsos);
  return {
    ...resto,
    compases,
    contexto: {
      ...(estilo === undefined ? {} : { estilo }),
      ...(pulsosPorCompas === undefined ? {} : { pulsosPorCompas }),
      ...(papel === undefined ? {} : { papel }),
      ...contexto,
      ...(punteo === undefined ? {} : { melodia: leerPunteo(punteo) }),
    },
  } satisfies CasoDeVerificacion;
}

// --- Lo que se repite entre casos -------------------------------------------------

/**
 * Lo que más se pide al retocar: el primer acorde es tuyo, y no se toca **si abre la
 * frase** —la tónica, lo que hace de ella, el centro de un vaivén—. Si es la
 * predominante de un `ii V I`, de un pre o de un final, se puede cambiar
 * (`cambiaElCompasQueAbre`, y lo que pidió el corpus final).
 */
const QUIETO_EL_1 = cambiaElCompasQueAbre();

/** Al retocar, lo mínimo: no deja dos compases iguales donde no los había. */
const SIN_PEGAR = no(repiteAlVecino(), 'no deja dos compases iguales donde no los había');

/**
 * Al continuar, lo mínimo de casi todos: si sigue, cierra en casa; si contrasta,
 * vuelve a lo tuyo, que es lo que hace un contraste.
 */
const CIERRA_O_CONTRASTA = dicho(
  'si sigue, cierra en la tónica (o contrasta y vuelve a lo tuyo)',
  o(esCamino('contraste'), cierraEnLaTonica()),
);

const RETROGRESION = dicho('mete V→IV, la retrogresión', meteElGiro('V', 'IV'));

const TRIADAS_EN_UN_JAZZ = dicho('pone tríadas donde todo lleva séptima', no(loNuevoConSeptima()));

const FUERA_DE_LAS_QUINTAS = dicho('pone algo que no es una quinta', no(loNuevoEn('quinta')));

/**
 * Las frases de tres a propósito: lo de siempre, **menos la frase coja**, que aquí
 * es la forma y no un error. Lo que la rompe se mira con `respetaFrasesDe(3)`.
 */
const NUNCA_SALVO_LO_IMPAR: readonly Expectativa[] = [
  relleno(),
  acabaAMitadDeCompas(),
  compasDeUnPulso(),
  fueraDeLaRejilla(),
];

/**
 * Un compás de cuatro acordes de un pulso: aquí el pulso es el ritmo armónico,
 * así que ni un acorde de un pulso es un error ni uno de cuatro es relleno. Lo que
 * sí es un error es contar cada pulso como si fuera un compás.
 */
const NUNCA_A_PULSOS: readonly Expectativa[] = [
  dicho(
    'cuenta cada pulso como un compás: la canción no llena compases enteros',
    acabaAMitadDeCompas(),
  ),
  fraseCoja(),
  fueraDeLaRejilla(),
];

/** Retocar un acorde solo es estirarlo: cambiarlo es cambiar su único compás. */
const UN_ACORDE_SOLO: Razonables = {
  cuantas: 1,
  porque: 'un acorde solo no se retoca sin tocar su único compás: cabe estirarlo y poco más',
};

const TRES: Razonables = { cuantas: 3 };

// --- El corpus -------------------------------------------------------------------

export const CORPUS_DE_VERIFICACION: readonly CasoDeVerificacion[] = [
  // --- Pop, balada, soul y cine --------------------------------------------------
  caso({
    id: 'pop-iv-prestado-estribillo',
    familia: 'pop-balada-soul-cine',
    que: 'estribillo con el iv prestado antes de volver a casa',
    mode: 'major',
    toma: 'I IV iv I',
    estilo: 'pop',
    papel: 'estribillo',
    continuar: {
      // «I IV iv I | vi IV V I», «vi IV V I», «un puente hacia vi o ii».
      debe: [
        o(
          cierraCon('V', 'I'),
          cierraCon('iv', 'I'),
          y(esCamino('contraste'), empiezaEn('vi', 'ii')),
        ),
      ],
      noDebe: [
        dicho('mete iv→IV, la retrogresión del préstamo', meteElGiro('iv', 'IV')),
        dicho('mete el bII en un pop', meteElGrado('bII')),
        dicho('añade una frase que no es de cuatro', no(respetaFrasesDe(4))),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «IV→ii», «I IV bVII I», «I IV bVI I», y el compás 1 quieto.
      debe: [o(compasEs(2, 'ii'), compasEs(3, 'bVI'), compasEs(3, 'bVII'))],
      noDebe: [QUIETO_EL_1, pierdeElPrestado(), ...NUNCA],
      aceptable: [
        SIN_PEGAR,
        dicho('el estribillo sigue cerrando en la tónica', cierraEnLaTonica()),
      ],
    },
  }),
  caso({
    id: 'soul-IV-iv-estrofa',
    familia: 'pop-balada-soul-cine',
    que: 'estrofa soul que vuelve al I por el plagal menor',
    mode: 'major',
    toma: 'I vi IV iv',
    papel: 'estrofa',
    giro: 'soul',
    continuar: {
      // «I vi IV iv | I vi ii V», «iv→I directo», «un estribillo en IV o en vi».
      debe: [
        o(
          y(cierraEnLaTonica(), o(meteElGiro('V', 'I'), meteElGiro('iv', 'I'))),
          y(esCamino('contraste'), empiezaEn('IV', 'vi')),
        ),
      ],
      noDebe: [
        dicho('mete iv→IV, la retrogresión del préstamo', meteElGiro('iv', 'IV')),
        dicho(
          'mete un V/vi que no resuelve en vi',
          y(pasaPor('V/vi'), no(meteElGiro('V/vi', 'vi'))),
        ),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii en lugar de IV», «V/vi antes de vi».
      debe: [o(compasEs(3, 'ii'), compasEs(2, 'V/vi'))],
      noDebe: [
        QUIETO_EL_1,
        dicho('quita el iv sin poner otro préstamo', pierdeElPrestado()),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'balada-sus4',
    familia: 'pop-balada-soul-cine',
    que: 'balada con el V suspendido',
    mode: 'major',
    toma: 'I iii IV V@sus4',
    estilo: 'pop',
    papel: 'estrofa',
    continuar: {
      // «V→I y otra frase», «V→vi y luego IV V I», «un estribillo en IV o en vi».
      debe: [
        o(
          cierraCon('V', 'I'),
          meteElGiro('V', 'vi'),
          y(esCamino('contraste'), empiezaEn('IV', 'vi')),
        ),
      ],
      noDebe: [
        dicho('V→IV justo detrás de tu V: la retrogresión inmediata', sigueCon('IV')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii en lugar de IV», «iv en lugar de IV».
      debe: [o(compasEs(3, 'ii'), compasEs(3, 'iv'))],
      noDebe: [QUIETO_EL_1, dicho('quita el sus4 sin motivo', cambiaTuEspecie()), ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'pop-cadencia-rota',
    familia: 'pop-balada-soul-cine',
    que: 'estrofa que acaba en cadencia rota',
    mode: 'major',
    toma: 'I IV V vi',
    estilo: 'pop',
    papel: 'estrofa',
    continuar: {
      // «IV V I, ahora sí», «un estribillo en IV o en I».
      debe: [o(cierraCon('V', 'I'), y(esCamino('contraste'), empiezaEn('IV', 'I')))],
      noDebe: [
        dicho('vuelve a acabar en vi como si cerrara', y(esCamino('seguir'), cierraCon('vi'))),
        RETROGRESION,
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii en lugar de IV», «I IV V I», «bVI en lugar de vi».
      debe: [o(compasEs(2, 'ii'), y(compasEs(3, 'V'), compasEs(4, 'I')), compasEs(4, 'bVI'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'pop-desde-vi',
    familia: 'pop-balada-soul-cine',
    que: 'pop-rock que gira en el relativo',
    mode: 'major',
    toma: 'vi V IV V',
    estilo: 'pop',
    papel: 'estrofa',
    continuar: {
      // «resolver al I», «repetir y cerrar IV V I», «un puente que vaya a ii o a iii».
      debe: [o(cierraEnLaTonica(), y(esCamino('contraste'), o(pasaPor('ii'), pasaPor('iii'))))],
      noDebe: [
        dicho('cierra V→IV→I: la retrogresión ya es tuya', cierraCon('V', 'IV', 'I')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «otro final que llegue por V→I», «ii en lugar de IV».
      debe: [o(cierraCon('V', 'I'), compasEs(3, 'ii'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'pre-estribillo',
    familia: 'pop-balada-soul-cine',
    que: 'pre-estribillo que sube por grados hasta la dominante',
    mode: 'major',
    toma: 'ii iii IV V',
    estilo: 'pop',
    papel: 'pre',
    continuar: {
      // «un estribillo que arranque en I o en vi y cierre», «V sostenido un compás más».
      debe: [o(y(empiezaEn('I', 'vi'), cierraEnLaTonica()), empiezaEn('V'))],
      noDebe: [dicho('lo que sigue no es una frase de cuatro', no(respetaFrasesDe(4))), ...NUNCA],
      aceptable: [
        dicho(
          'lo que sigue a un pre entra por la tónica, el relativo, el IV o la dominante',
          empiezaEn('I', 'vi', 'IV', 'V'),
        ),
      ],
    },
    retocar: {
      // «V/V en lugar de IV», «iv en lugar de IV».
      debe: [o(compasEs(3, 'V/V'), compasEs(3, 'iv'))],
      noDebe: [QUIETO_EL_1, dicho('acaba en I: un pre no cierra', cierraEnLaTonica()), ...NUNCA],
      aceptable: [SIN_PEGAR, dicho('el pre sigue acabando en tu dominante', conservaElFinal())],
    },
  }),
  caso({
    id: 'puente-ocho',
    familia: 'pop-balada-soul-cine',
    que: 'puente de ocho que tiene que volver al estribillo',
    mode: 'major',
    toma: 'IV V iii vi ii iii IV V',
    estilo: 'pop',
    papel: 'puente',
    continuar: {
      // «vuelta al estribillo en I», «V→I directo», «un final que cierre».
      debe: [dicho('vuelve directo a la tónica', empiezaEn('I'))],
      noDebe: [
        dicho('sigue sin volver a I', no(pasaPor('I'))),
        dicho('añade partes de 2 o de 6 compases', no(respetaFrasesDe(4))),
        ...NUNCA,
      ],
      aceptable: [
        dicho(
          'vuelve a casa: arranca en I, o acaba en ella',
          o(empiezaEn('I'), cierraEnLaTonica()),
        ),
      ],
    },
    retocar: {
      // «V/vi en lugar del iii», «iv en lugar del IV del 7», «V/V en lugar del ii».
      debe: [o(compasEs(3, 'V/vi'), compasEs(7, 'iv'), compasEs(5, 'V/V'))],
      noDebe: [
        QUIETO_EL_1,
        dicho('quita el V final, que es la vuelta', no(conservaElFinal())),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'final-coda',
    familia: 'pop-balada-soul-cine',
    que: 'coda que se queda en el aire',
    mode: 'major',
    toma: 'I IV I V',
    papel: 'final',
    continuar: {
      // «V→I en dos o cuatro», «bVI bVII I», «IV iv I».
      debe: [o(cierraCon('V', 'I'), cierraCon('bVI', 'bVII', 'I'), cierraCon('IV', 'iv', 'I'))],
      noDebe: [
        dicho('deja abierto un final', no(cierraEnLaTonica())),
        dicho('añade un contraste a un final', esCamino('contraste')),
        ...NUNCA,
      ],
      aceptable: [
        dicho(
          'cierra en cuatro compases o menos: una coda no es otra canción',
          o(alarga(1), alarga(2), alarga(3), alarga(4)),
        ),
      ],
    },
    retocar: {
      // «I IV V I», «I IV iv I», «I IV bVII I».
      debe: [o(cierraCon('V', 'I'), cierraCon('iv', 'I'), cierraCon('bVII', 'I'))],
      noDebe: [QUIETO_EL_1, dicho('deja abierto un final', no(cierraEnLaTonica())), ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'pop-mario',
    familia: 'pop-balada-soul-cine',
    que: 'estribillo que cierra a lo épico',
    mode: 'major',
    toma: 'I IV bVI bVII',
    estilo: 'pop',
    papel: 'estribillo',
    continuar: {
      // «bVII→I y cerrar», «repetir y cerrar en I», «contraste en vi».
      debe: [o(sigueCon('I'), y(esCamino('contraste'), empiezaEn('vi')))],
      noDebe: [
        dicho('bVII→V: la dominante detrás del bVII', sigueCon('V')),
        dicho('mete el V/V en mitad del préstamo', meteElGrado('V/V')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «iv en lugar de IV», «bIII», «I IV V I».
      debe: [o(compasEs(2, 'iv'), compasEs(3, 'bIII'), cierraCon('V', 'I'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'cine-heroico',
    familia: 'pop-balada-soul-cine',
    que: 'música de cine heroica, con mediantes prestadas',
    mode: 'major',
    toma: 'I iv I bVI',
    giro: 'cine',
    continuar: {
      // «bVI bVII I», «bVI→iv→I o bVI→V→I», «repetir con bIII».
      debe: [
        o(
          cierraCon('bVI', 'bVII', 'I'),
          sigueCon('bVII'),
          meteElGiro('bVI', 'iv'),
          meteElGiro('bVI', 'V', 'I'),
          meteElGrado('bIII'),
        ),
      ],
      noDebe: [
        dicho('mete un ii–V de jazz', meteElGiro('ii', 'V')),
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «IV en lugar de iv», «bIII en lugar de bVI», «otro final con bVII I».
      debe: [o(compasEs(2, 'IV'), compasEs(4, 'bIII'), cierraCon('bVII', 'I'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR, no(pierdeElPrestado(), 'conserva algo del color prestado')],
    },
  }),

  // --- Jazz, gospel, bossa y bolero ---------------------------------------------
  caso({
    id: 'gospel-secundarias',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'gospel con secundarias encadenadas hasta el V',
    mode: 'major',
    toma: 'I:2 V/vi:2@dominant7 vi:2@minor7 V/ii:2@dominant7 ii:2@minor7 V/V:2@dominant7 V@dominant7',
    giro: 'gospel',
    continuar: {
      // «V→I», «V→I con el IV–iv–I del gospel», «otra vuelta de la cadena».
      debe: [o(sigueCon('I'), repiteLoTuyo())],
      noDebe: [
        dicho('una dominante sin séptima', dominanteSinSeptima()),
        dicho('mete el bVII', meteElGrado('bVII')),
        dicho('pone quintas', algoNuevoEn('quinta')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bII7 en lugar del V7», «otro final que llegue a I».
      debe: [o(compasEs(7, 'bII'), cierraEnLaTonica())],
      noDebe: [QUIETO_EL_1, dicho('una dominante sin séptima', dominanteSinSeptima()), ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'jazz-rhythm-A',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'la A de un rhythm changes, Imaj7 VI7 ii7 V7 a dos pulsos',
    mode: 'major',
    toma: 'I:2@major7 V/ii:2@dominant7 ii:2@minor7 V:2@dominant7 I:2@major7 V/ii:2@dominant7 ii:2@minor7 V:2@dominant7',
    estilo: 'jazz',
    continuar: {
      // «el puente III7 VI7 II7 V7», «cerrar en Imaj7», «repetir la A con ii V I».
      debe: [
        o(
          y(esCamino('contraste'), pasaPor('V/vi'), pasaPor('V/V')),
          cierraEnLaTonica(),
          meteElGiro('ii', 'V', 'I'),
        ),
      ],
      noDebe: [
        TRIADAS_EN_UN_JAZZ,
        dicho('mete bVII→I', meteElGiro('bVII', 'I')),
        RETROGRESION,
        ...NUNCA,
      ],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «bII7 en lugar del V7», «iii7 en lugar del I del 5».
      debe: [o(meteElGrado('bII'), compasEs(5, 'iii'))],
      noDebe: [QUIETO_EL_1, TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'bossa-II7',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'bossa con el II7 lidio-dominante',
    mode: 'major',
    toma: 'I@major7 V/V@dominant7 ii@minor7 V@dominant7',
    estilo: 'jazz',
    continuar: {
      // «Imaj7 y otra frase», «bII7 I», «un puente a IVmaj7 o a iv7».
      debe: [
        o(sigueCon('I'), meteElGiro('bII', 'I'), y(esCamino('contraste'), empiezaEn('IV', 'iv'))),
      ],
      noDebe: [
        TRIADAS_EN_UN_JAZZ,
        dicho('mete el bVII', meteElGrado('bVII')),
        dicho('pone quintas', algoNuevoEn('quinta')),
        ...NUNCA,
      ],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «bII7 por V7», «V/ii en el 2», «iv7 en lugar del ii7».
      debe: [o(compasEs(4, 'bII'), compasEs(2, 'V/ii'), compasEs(3, 'iv'))],
      noDebe: [QUIETO_EL_1, TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'jazz-iii-VI-ii-V',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'jazz que llega por terceras y se queda en V',
    mode: 'major',
    toma: 'iii@minor7 V/ii@dominant7 ii@minor7 V@dominant7',
    estilo: 'jazz',
    continuar: {
      // «Imaj7 y una frase de cuatro», «bII7 Imaj7», «un puente en IV».
      debe: [o(sigueCon('I'), meteElGiro('bII', 'I'), y(esCamino('contraste'), empiezaEn('IV')))],
      noDebe: [dicho('mete bVII→I', meteElGiro('bVII', 'I')), TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [llevaTusEspecies(), CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bII7 por V7», «otro final que llegue por V→I».
      debe: [o(compasEs(4, 'bII'), cierraCon('V', 'I'))],
      noDebe: [QUIETO_EL_1, TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'jazz-backdoor',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'la puerta de atrás, iv7 bVII7 Imaj7',
    mode: 'major',
    toma: 'iv@minor7 bVII@dominant7 I@major7 I@major7',
    estilo: 'jazz',
    continuar: {
      // «ii7 V7 Imaj7, por la puerta de delante» —o su tritono—, «iii7 VI7 ii7 V7»,
      // «IVmaj7 iv7 I».
      debe: [
        o(
          meteElGiro('ii', 'V', 'I'),
          meteElGiro('ii', 'bII', 'I'),
          y(pasaPor('iii'), pasaPor('V/ii')),
          meteElGiro('IV', 'iv', 'I'),
        ),
      ],
      noDebe: [TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «bII7 en lugar del bVII7», «un V en lugar del bVII».
      debe: [o(compasEs(2, 'bII'), compasEs(2, 'V'))],
      noDebe: [QUIETO_EL_1, TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'jazz-menor-turnaround',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'jazz menor, im7 bVImaj7 iiø7 V7',
    mode: 'minor',
    toma: 'i@minor7 VI@major7 ii°@halfDiminished7 V@dominant7',
    estilo: 'jazz',
    continuar: {
      // «im7 y otra vuelta», «el ciclo iv7 VII7 III VI ii° V i», «bII7 i».
      debe: [
        o(sigueCon('i'), meteElGiro('bII', 'i'), y(pasaPor('iv'), pasaPor('VII'), pasaPor('III'))),
      ],
      noDebe: [
        dicho('VII→i como cadencia en un jazz menor', meteElGiro('VII', 'i')),
        dicho('mete la v menor', meteElGrado('v')),
        TRIADAS_EN_UN_JAZZ,
        ...NUNCA,
      ],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «bII7 por V7», «iv7 por VI», «otro final».
      debe: [o(compasEs(4, 'bII'), compasEs(2, 'iv'), cierraEnLaTonica())],
      noDebe: [QUIETO_EL_1, TRIADAS_EN_UN_JAZZ, ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'bolero-menor',
    familia: 'jazz-gospel-bossa-bolero',
    que: 'bolero en menor, im i7 ivm V7',
    mode: 'minor',
    toma: 'i V/iv@dominant7 iv V@dominant7',
    giro: 'bolero',
    continuar: {
      // «V→i y la segunda frase a III o a VI», «VI ii° V i», «repetir y cerrar».
      debe: [
        o(
          y(sigueCon('i'), o(pasaPor('III'), pasaPor('VI'))),
          meteElGiro('VI', 'ii°', 'V', 'i'),
          y(sigueCon('i'), cierraCon('V', 'i')),
        ),
      ],
      noDebe: [
        dicho('VII→i, sin sensible, en un bolero funcional', meteElGiro('VII', 'i')),
        dicho('pone quintas', algoNuevoEn('quinta')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii° en lugar de iv», «VI antes del V», «el napolitano antes del V».
      debe: [o(compasEs(3, 'ii°'), compasEs(3, 'VI'), compasEs(3, 'bII'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),

  // --- Rock, punk, metal y blues ------------------------------------------------
  caso({
    id: 'punk-tres-acordes',
    familia: 'rock-punk-metal-blues',
    que: 'punk en quintas',
    mode: 'major',
    toma: 'I@quinta IV@quinta V@quinta IV@quinta',
    estilo: 'rock',
    continuar: {
      // «repetir y cerrar V I», «bVII IV I», «contraste en vi o en bVI–bVII».
      debe: [
        o(
          cierraCon('V', 'I'),
          cierraCon('bVII', 'IV', 'I'),
          y(esCamino('contraste'), empiezaEn('vi', 'bVI')),
        ),
      ],
      noDebe: [
        FUERA_DE_LAS_QUINTAS,
        dicho('mete dominantes secundarias en un riff de quintas', meteUnaSecundaria()),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bVII en lugar del IV final», «vi en lugar de un IV». Y el bVII en lugar del V,
      // `I IV bVII IV`, que es este mismo riff como lo pide el corpus del equipo
      // (`rock-louie`, `I IV V IV`: «el compás 3 es bVII»): los dos meten el bVII del
      // rock en el riff de tres acordes. Cambiar el IV por el bVII o por el vi no lo
      // define ningún movimiento —en quintas no comparten notas—; el V por el bVII sí,
      // la dominante sin sensible.
      debe: [o(compasEs(4, 'bVII'), compasEs(3, 'bVII'), compasEs(2, 'vi'), compasEs(4, 'vi'))],
      noDebe: [QUIETO_EL_1, FUERA_DE_LAS_QUINTAS, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'rock-bIII-bVII',
    familia: 'rock-punk-metal-blues',
    que: 'rock con el bIII y el bVII',
    mode: 'major',
    toma: 'I bIII bVII IV',
    estilo: 'rock',
    continuar: {
      // «IV→I y repetir», «bVI bVII I», «contraste en vi o en bVI».
      debe: [
        o(
          sigueCon('I'),
          cierraCon('bVI', 'bVII', 'I'),
          y(esCamino('contraste'), empiezaEn('vi', 'bVI')),
        ),
      ],
      noDebe: [
        dicho('mete la sensible: rompe el modo', meteLaSensible()),
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        dicho('mete un ii–V', meteElGiro('ii', 'V')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bVI en lugar de bIII», «iv en lugar de IV», «otro final que llegue a I».
      debe: [o(compasEs(2, 'bVI'), compasEs(4, 'iv'), cierraEnLaTonica())],
      noDebe: [QUIETO_EL_1, dicho('mete el V', meteElGrado('V')), ...NUNCA],
      aceptable: [SIN_PEGAR, no(meteLaSensible(), 'no mete la sensible')],
    },
  }),
  caso({
    id: 'rock-mixolidio-estribillo',
    familia: 'rock-punk-metal-blues',
    que: 'estribillo mixolidio que ya cierra',
    mode: 'major',
    toma: 'I bVII IV I',
    estilo: 'rock',
    papel: 'estribillo',
    continuar: {
      // «otra vuelta, I bVII IV I o I bVII IV IV», «bVI bVII I», «puente en vi o IV».
      debe: [
        o(
          repiteLoTuyo(),
          y(compasEs(5, 'I'), compasEs(6, 'bVII')),
          cierraCon('bVI', 'bVII', 'I'),
          y(esCamino('contraste'), empiezaEn('vi', 'IV')),
        ),
      ],
      noDebe: [
        dicho('mete la sensible en un estribillo mixolidio', meteLaSensible()),
        dicho('mete un ii–V–I de jazz', meteElGiro('ii', 'V', 'I')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bIII en lugar de bVII», «iv en lugar de IV», «otro final bVII–I».
      debe: [o(compasEs(2, 'bIII'), compasEs(3, 'iv'), cierraCon('bVII', 'I'))],
      noDebe: [QUIETO_EL_1, dicho('mete el V', meteElGrado('V')), ...NUNCA],
      aceptable: [
        SIN_PEGAR,
        dicho('el estribillo sigue cerrando en la tónica', cierraEnLaTonica()),
      ],
    },
  }),
  caso({
    id: 'rock-menor-eolio',
    familia: 'rock-punk-metal-blues',
    que: 'rock en menor que acaba en iv',
    mode: 'minor',
    toma: 'i III VII iv',
    estilo: 'rock',
    continuar: {
      // «iv→i y repetir», «VI VII i», «contraste en III o en VI».
      debe: [
        o(
          sigueCon('i'),
          cierraCon('VI', 'VII', 'i'),
          y(esCamino('contraste'), empiezaEn('III', 'VI')),
        ),
      ],
      noDebe: [dicho('mete el V/V en un rock eólico', meteElGrado('V/V')), ...NUNCA],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «VI en lugar de III», «v o V en el último», «VI VII i».
      debe: [o(compasEs(2, 'VI'), compasEs(4, 'v'), compasEs(4, 'V'), cierraCon('VI', 'VII', 'i'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'metal-frigio-vamp',
    familia: 'rock-punk-metal-blues',
    que: 'metal frigio en quintas',
    mode: 'minor',
    toma: 'i@quinta bII@quinta i@quinta bII@quinta',
    estilo: 'metal',
    continuar: {
      // «bII→i y VI VII i», «contraste en iv o en VI».
      debe: [
        o(
          cierraCon('bII', 'i'),
          cierraCon('VI', 'VII', 'i'),
          y(esCamino('contraste'), empiezaEn('iv', 'VI')),
        ),
      ],
      noDebe: [
        dicho('mete el V/V en un frigio', meteElGrado('V/V')),
        FUERA_DE_LAS_QUINTAS,
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «VI en lugar de un bII», «VII en lugar del último bII».
      debe: [o(compasEs(2, 'VI'), compasEs(4, 'VI'), compasEs(4, 'VII'))],
      noDebe: [
        QUIETO_EL_1,
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        dicho('pierde todo el bII, que es el modo', no(tieneElGrado('bII'))),
        FUERA_DE_LAS_QUINTAS,
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'metal-neoclasico',
    familia: 'rock-punk-metal-blues',
    que: 'metal neoclásico con el napolitano y la dominante armónica',
    mode: 'minor',
    toma: 'i VI bII V',
    estilo: 'metal',
    continuar: {
      // «V→i y repetir», «iv V i», «VI VII i».
      debe: [o(sigueCon('i'), cierraCon('iv', 'V', 'i'), cierraCon('VI', 'VII', 'i'))],
      noDebe: [
        dicho('mete V→iv', meteElGiro('V', 'iv')),
        dicho('se queda sin resolver', y(esCamino('seguir'), no(cierraEnLaTonica()))),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «iv en lugar de bII», «ii° en lugar de bII», «otro final».
      debe: [o(compasEs(3, 'iv'), compasEs(3, 'ii°'), cierraEnLaTonica())],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'metal-escalera-rapida',
    familia: 'rock-punk-metal-blues',
    que: 'metal a dos pulsos en quintas',
    mode: 'minor',
    toma: 'i:2@quinta VII:2@quinta VI:2@quinta VII:2@quinta',
    estilo: 'metal',
    continuar: {
      // «repetir y cerrar VI VII i», «bII i», «contraste en iv». Y «VI V i»: en
      // quintas el V no lleva sensible, y es el otro cierre del metal en menor.
      debe: [
        o(
          cierraCon('VI', 'VII', 'i'),
          cierraCon('VI', 'V', 'i'),
          meteElGiro('bII', 'i'),
          y(esCamino('contraste'), empiezaEn('iv')),
        ),
      ],
      noDebe: [
        dicho('acordes de cuatro pulsos donde todo va a dos', no(loNuevoVaA(2))),
        FUERA_DE_LAS_QUINTAS,
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «bII en lugar del último VII», «iv en lugar de VI». Y el V en lugar del último
      // VII, `i VII VI V`: la andaluza en quintas, que este mismo caso da por buena al
      // continuar («en quintas el V no lleva sensible, y es el otro cierre del metal en
      // menor»). Lo que pedía no lo define ningún movimiento en quintas: sin tercera,
      // el VI5 y el iv5 no comparten ni una nota, y el VII y el bII tampoco.
      debe: [o(compasEs(4, 'bII'), compasEs(3, 'iv'), compasEs(4, 'V'))],
      noDebe: [QUIETO_EL_1, FUERA_DE_LAS_QUINTAS, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'blues-ocho',
    familia: 'rock-punk-metal-blues',
    que: 'blues de ocho compases',
    mode: 'major',
    toma: 'I@dominant7 V@dominant7 IV@dominant7 IV@dominant7 I@dominant7 V@dominant7 I@dominant7 V@dominant7',
    estilo: 'blues',
    continuar: {
      // «otro coro de 8», «cierre en I7», «IV7 iv I».
      debe: [o(alarga(8), sigueCon('I'), cierraCon('IV', 'iv', 'I'))],
      noDebe: [
        dicho('mete maj7 en un blues', algoNuevoEn('major7')),
        dicho('mete un ii–V de jazz', meteElGiro('ii', 'V')),
        dicho('mete una frase de 4 detrás de una forma de 8', alarga(4)),
        ...NUNCA,
      ],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «IV7 en el 2, el quick change», «V/V antes del V».
      debe: [o(compasEs(2, 'IV'), compasEs(7, 'V/V'), compasEs(5, 'V/V'))],
      noDebe: [QUIETO_EL_1, dicho('tríadas en un blues', no(loNuevoConSeptima())), ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),

  // --- Menor, andaluza, folk, vals y frases de tres -----------------------------
  caso({
    id: 'menor-ciclo-quintas',
    familia: 'menor-andaluza-folk-vals',
    que: 'el ciclo de quintas en menor, abierto en V',
    mode: 'minor',
    toma: 'i iv VII III VI ii° V V',
    continuar: {
      // «V→i y cerrar», «repetir con otro final», «contraste en III».
      debe: [o(sigueCon('i'), y(esCamino('contraste'), empiezaEn('III')))],
      noDebe: [
        dicho('mete V→iv', meteElGiro('V', 'iv')),
        dicho('una frase de dos', alarga(2)),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «V/V en lugar de ii°», «un solo compás de V y la tónica».
      debe: [o(compasEs(6, 'V/V'), y(compasEs(7, 'V'), compasEs(8, 'i')))],
      noDebe: [
        QUIETO_EL_1,
        dicho('rompe la secuencia de quintas', cambiaAlgunoEntre(2, 5)),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'menor-V-armonico',
    familia: 'menor-andaluza-folk-vals',
    que: 'menor clásico con la dominante armónica',
    mode: 'minor',
    toma: 'i iv V@dominant7 i',
    papel: 'estrofa',
    continuar: {
      // «una segunda frase que va a III y vuelve», «VI iv V i», «VI ii° V i».
      debe: [
        o(
          pasaPor('III'),
          meteElGiro('VI', 'iv', 'V', 'i'),
          meteElGiro('VI', 'ii°', 'V', 'i'),
          y(esCamino('contraste'), empiezaEn('VI', 'III')),
        ),
      ],
      noDebe: [
        dicho('la v menor después de haber elegido V', meteElGrado('v')),
        dicho('VII→i como cadencia', cierraCon('VII', 'i')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii° en lugar de iv», «VI en lugar de iv», «bII en lugar de iv».
      debe: [o(compasEs(2, 'ii°'), compasEs(2, 'VI'), compasEs(2, 'bII'))],
      noDebe: [
        QUIETO_EL_1,
        dicho('cambia la dominante por VII→i', cierraCon('VII', 'i')),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'andaluza',
    familia: 'menor-andaluza-folk-vals',
    que: 'la cadencia andaluza',
    mode: 'minor',
    toma: 'i VII VI V',
    continuar: {
      // «V→i y repetir la andaluza», «iv V i», «VI V i».
      debe: [
        o(repiteLoTuyo(), sigueCon('i'), cierraCon('iv', 'V', 'i'), cierraCon('VI', 'V', 'i')),
      ],
      noDebe: [
        dicho('mete V→iv', meteElGiro('V', 'iv')),
        dicho('tu V va a VI', sigueCon('VI')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «otro final, VI V i», «iv en lugar de VII», «bII en lugar de VII». Las tres
      // contradicen lo que los otros dos corpus piden de la andaluza: **su bajada es la
      // forma** —el equipo tacha el V/V que rompe `i VII VI V`, y el ciego, la línea
      // rota de un cine en menor—, y el iv o el bII en el 2 le cambian el bajo; `VI V
      // i` al final cambia tres compases de cuatro, y otro final deja la primera mitad
      // en pie. Sin romperla, lo que queda es otro reparto: menos de tres salidas, y
      // es lo que hay.
      debe: [
        o(cierraCon('VI', 'V', 'i'), compasEs(2, 'iv'), compasEs(2, 'bII'), esCamino('estirar')),
      ],
      noDebe: [QUIETO_EL_1, dicho('quita el V', no(tieneElGrado('V'))), ...NUNCA],
      aceptable: [SIN_PEGAR],
      razonables: {
        cuantas: 2,
        porque: 'la andaluza es su bajada: sin romperla, se retoca su reparto y poco más',
      },
    },
  }),
  caso({
    id: 'folk-eolio',
    familia: 'menor-andaluza-folk-vals',
    que: 'folk eólico sin sensible',
    mode: 'minor',
    toma: 'i v VII i',
    estilo: 'folk',
    continuar: {
      // «III VII i», «VI VII i», «iv v i».
      debe: [
        o(cierraCon('III', 'VII', 'i'), cierraCon('VI', 'VII', 'i'), cierraCon('iv', 'v', 'i')),
      ],
      noDebe: [
        dicho('mete la sensible en un eólico', meteLaSensible()),
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «III en lugar de v», «iv en lugar de v», «VI en lugar de VII».
      debe: [o(compasEs(2, 'III'), compasEs(2, 'iv'), compasEs(3, 'VI'))],
      noDebe: [QUIETO_EL_1, dicho('mete el V armónico', meteLaSensible()), ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'folk-doble-tonica',
    familia: 'menor-andaluza-folk-vals',
    que: 'folk celta de doble tónica',
    mode: 'major',
    toma: 'I bVII I bVII',
    estilo: 'folk',
    continuar: {
      // «seguir el vaivén y cerrar bVII I», «IV bVII I», «contraste en IV o en vi».
      debe: [
        o(
          cierraCon('bVII', 'I'),
          cierraCon('IV', 'bVII', 'I'),
          y(esCamino('contraste'), empiezaEn('IV', 'vi')),
        ),
      ],
      noDebe: [
        dicho('mete la sensible en una doble tónica', meteLaSensible()),
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «IV en lugar de un bVII», «otro final bVII–I».
      debe: [o(compasEs(2, 'IV'), compasEs(4, 'IV'), cierraCon('bVII', 'I'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR, no(meteLaSensible(), 'no mete la sensible')],
    },
  }),
  caso({
    id: 'vals-folk',
    familia: 'menor-andaluza-folk-vals',
    que: 'vals folk de ocho compases en tres por cuatro',
    mode: 'major',
    toma: 'I iii IV I ii V V I',
    pulsos: 3,
    pulsosPorCompas: 3,
    estilo: 'folk',
    continuar: {
      // «una B de ocho en IV o en vi que vuelve», «repetir la A con otro final»,
      // «un cierre de cuatro».
      debe: [
        o(
          y(esCamino('contraste'), empiezaEn('IV', 'vi'), alarga(8)),
          y(esCamino('seguir'), alarga(8)),
          y(alarga(4), cierraEnLaTonica()),
        ),
      ],
      noDebe: [dicho('añade frases de 2, 5 o 7', no(respetaFrasesDe(4))), ...NUNCA],
      aceptable: [dicho('lo nuevo va a compás de vals', loNuevoVaA(3))],
    },
    retocar: {
      // «vi en lugar de iii», «V/V en lugar de ii».
      debe: [o(compasEs(2, 'vi'), compasEs(5, 'V/V'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'vals-menor',
    familia: 'menor-andaluza-folk-vals',
    que: 'vals en menor',
    mode: 'minor',
    toma: 'i iv V@dominant7 i',
    pulsos: 3,
    pulsosPorCompas: 3,
    continuar: {
      // «VI iv V i», «contraste en III».
      debe: [o(cierraCon('VI', 'iv', 'V', 'i'), pasaPor('III'))],
      noDebe: [dicho('mete la v menor', meteElGrado('v')), ...NUNCA],
      aceptable: [dicho('lo nuevo va a compás de vals', loNuevoVaA(3))],
    },
    retocar: {
      // «ii° en lugar de iv», «VI en lugar de iv».
      debe: [o(compasEs(2, 'ii°'), compasEs(2, 'VI'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'tres-mas-tres',
    familia: 'menor-andaluza-folk-vals',
    que: 'frases de tres compases a propósito',
    mode: 'major',
    toma: 'I IV V vi IV V',
    papel: 'estrofa',
    continuar: {
      // «otra frase de tres que cierre», «dos frases de tres».
      debe: [o(y(alarga(3), cierraEnLaTonica()), alarga(6))],
      noDebe: [
        dicho('añade 2 o 4 y la cuadra a 8 o 10: contradice la forma', no(respetaFrasesDe(3))),
        ...NUNCA_SALVO_LO_IMPAR,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «otro final en el 6: V→I», «ii en lugar de IV».
      debe: [o(compasEs(6, 'I'), compasEs(2, 'ii'), compasEs(5, 'ii'))],
      noDebe: [
        QUIETO_EL_1,
        dicho('cambia el largo de seis', y(no(esCamino('estirar')), no(duraCompases(6)))),
        ...NUNCA_SALVO_LO_IMPAR,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),

  // --- Especies, punteo, duda e intro ---------------------------------------------
  caso({
    id: 'sus4-resuelve',
    familia: 'especies-punteo-duda-intro',
    que: 'rock con un Vsus4 que resuelve en V',
    mode: 'major',
    toma: 'I IV V@sus4 V',
    estilo: 'rock',
    continuar: {
      // «V→I», «bVII IV I», «vi IV V I».
      debe: [o(sigueCon('I'), cierraCon('bVII', 'IV', 'I'), cierraCon('vi', 'IV', 'V', 'I'))],
      noDebe: [
        dicho('V→IV justo detrás de tu V', sigueCon('IV')),
        dicho('mete dominantes secundarias', meteUnaSecundaria()),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii en lugar de IV», «bVII en lugar del último V».
      debe: [o(compasEs(2, 'ii'), compasEs(4, 'bVII'))],
      noDebe: [QUIETO_EL_1, dicho('quita el sus4', cambiaTuEspecie()), ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'melodia-mayor',
    familia: 'especies-punteo-duda-intro',
    que: 'I vi IV V con punteo: Do, La, Fa y Si fuertes',
    mode: 'major',
    toma: 'I vi IV V',
    estilo: 'pop',
    punteo: ['0F 4', '9F 0', '5F 9', '11F 2'],
    continuar: {
      // «V→I», «V→vi», «contraste en IV».
      debe: [o(sigueCon('I'), sigueCon('vi'), y(esCamino('contraste'), empiezaEn('IV')))],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii en lugar de IV» y «iv en lugar de IV»: el Fa está en los dos.
      debe: [o(compasEs(3, 'ii'), compasEs(3, 'iv'))],
      noDebe: [
        QUIETO_EL_1,
        chocaConElPunteo(),
        dicho('bVII en lugar del V: choca con el Si', compasEs(4, 'bVII')),
        dicho('V/vi en lugar de vi: el La no está en Mi7', compasEs(2, 'V/vi')),
        dicho('bVI en lugar de IV: el Fa no está en Lab', compasEs(3, 'bVI')),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'melodia-menor',
    familia: 'especies-punteo-duda-intro',
    que: 'i iv VII III con punteo: tónica, sexta, segunda y quinta fuertes',
    mode: 'minor',
    toma: 'i iv VII III',
    punteo: ['0F', '8F', '2F', '7F'],
    continuar: {
      // «VI ii° V i», «VI iv V i», «VI VII i».
      debe: [
        o(
          cierraCon('VI', 'ii°', 'V', 'i'),
          cierraCon('VI', 'iv', 'V', 'i'),
          cierraCon('VI', 'VII', 'i'),
        ),
      ],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «ii° en lugar de iv», «V en lugar de VII».
      debe: [o(compasEs(2, 'ii°'), compasEs(3, 'V'))],
      noDebe: [
        QUIETO_EL_1,
        chocaConElPunteo(),
        dicho('VI en lugar de III: choca con la quinta', compasEs(4, 'VI')),
        dicho('iv en lugar de VII: la segunda no está en iv', compasEs(3, 'iv')),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'melodia-sensible',
    familia: 'especies-punteo-duda-intro',
    que: 'rock I IV V V con la sensible fuerte en el último compás',
    mode: 'major',
    toma: 'I IV V V',
    estilo: 'rock',
    punteo: ['4F', '5F', '2F', '11F'],
    continuar: {
      // «V→I»: la sensible ya sonó.
      debe: [sigueCon('I')],
      noDebe: [
        dicho('la sensible ya sonó fuerte y lo que sigue es el bVII', sigueCon('bVII')),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «V/V en el 3», «ii en el 2», «iii en el 4».
      debe: [o(compasEs(3, 'V/V'), compasEs(2, 'ii'), compasEs(4, 'iii'))],
      noDebe: [
        QUIETO_EL_1,
        chocaConElPunteo(),
        dicho('bVII en el compás 4: choca con el Si', compasEs(4, 'bVII')),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'duda-un-compas',
    familia: 'especies-punteo-duda-intro',
    que: 'I iii vi IV con el iii dudoso',
    mode: 'major',
    toma: 'I iii? vi IV',
    estilo: 'pop',
    continuar: {
      // «ii V I» o «IV V I», «V I», y no construir encima del iii.
      debe: [o(cierraCon('ii', 'V', 'I'), cierraCon('IV', 'V', 'I'), cierraCon('V', 'I'))],
      noDebe: [dicho('vuelve a apoyarse en el iii dudoso', pasaPor('iii')), ...NUNCA],
      aceptable: [CIERRA_O_CONTRASTA],
    },
    retocar: {
      // «sustituir el iii dudoso».
      debe: [cambiaLoDudoso()],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),
  caso({
    id: 'duda-todo',
    familia: 'especies-punteo-duda-intro',
    que: 'una toma entera dudosa',
    mode: 'major',
    toma: 'I? IV? V? I?',
    continuar: {
      // «al menos tres salidas razonables, prudentes».
      debe: [],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: { debe: [], noDebe: NUNCA, aceptable: [SIN_PEGAR], razonables: TRES },
  }),
  caso({
    id: 'septimas-pop',
    familia: 'especies-punteo-duda-intro',
    que: 'pop con séptimas, que no es jazz',
    mode: 'major',
    toma: 'I@major7 iii@minor7 vi@minor7 IV@major7',
    estilo: 'pop',
    continuar: {
      // «ii7 V7 Imaj7», «IVmaj7 V I», «contraste».
      debe: [o(meteElGiro('ii', 'V', 'I'), cierraCon('IV', 'V', 'I'), esCamino('contraste'))],
      noDebe: [
        dicho('tríadas en lo nuevo cuando todo es cuatríada', no(loNuevoConSeptima())),
        dicho('pone quintas', algoNuevoEn('quinta')),
        ...NUNCA,
      ],
      aceptable: [llevaTusEspecies()],
    },
    retocar: {
      // «ii7 en lugar de IVmaj7», «V/vi7 en lugar de iii7».
      debe: [o(compasEs(4, 'ii'), compasEs(2, 'V/vi'))],
      noDebe: [QUIETO_EL_1, dicho('una secundaria sin séptima', dominanteSinSeptima()), ...NUNCA],
      aceptable: [SIN_PEGAR, llevaTusEspecies()],
    },
  }),
  caso({
    id: 'intro-vamp',
    familia: 'especies-punteo-duda-intro',
    que: 'intro que tiene que llevar a la estrofa, no cerrar',
    mode: 'major',
    toma: 'I IV I IV',
    papel: 'intro',
    continuar: {
      // «una estrofa que empiece en I», «V para entrar».
      debe: [dicho('entra en la estrofa por I o por V', empiezaEn('I', 'V'))],
      noDebe: [
        dicho(
          'la trata como una canción terminada: le pone un final',
          y(esCamino('seguir'), cierraEnLaTonica()),
        ),
        ...NUNCA,
      ],
      aceptable: [
        dicho('entra por la tónica, la dominante o el relativo', empiezaEn('I', 'V', 'vi')),
      ],
    },
    retocar: {
      // «V al final», «ii en lugar del IV final».
      debe: [o(compasEs(4, 'V'), compasEs(4, 'ii'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
    },
  }),

  // --- Raros ---------------------------------------------------------------------
  caso({
    id: 'raro-un-acorde',
    familia: 'raros',
    que: 'un solo acorde',
    mode: 'major',
    toma: 'I',
    continuar: {
      // «IV V I», «vi IV V I», «IV I». Y «ii V I», que es lo mismo: el ii y el IV son
      // la misma subdominante delante del V (el corpus viejo lo razona en `un-acorde`).
      debe: [o(cierraCon('IV', 'V', 'I'), cierraCon('ii', 'V', 'I'), cierraCon('IV', 'I'))],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: {
      // «estirarlo a dos compases».
      debe: [esCamino('estirar')],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [dicho('sigue siendo tu acorde', compasEs(1, 'I'))],
      razonables: UN_ACORDE_SOLO,
    },
  }),
  caso({
    id: 'raro-un-acorde-largo-menor',
    familia: 'raros',
    que: 'un acorde de dieciséis pulsos en menor',
    mode: 'minor',
    toma: 'i:16',
    continuar: {
      // «iv V i» y «VI VII i», a dieciséis: lo que pide es llegar a i desde su
      // dominante o desde el VII, y `V i` a secas es la misma llegada sin preparar.
      debe: [o(cierraCon('V', 'i'), cierraCon('VII', 'i'))],
      noDebe: [
        dicho('pasa a acordes más cortos tras uno de cuatro compases', no(loNuevoVaA(16))),
        ...NUNCA,
      ],
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: {
      // «repartirlo en compases».
      debe: [esCamino('estirar')],
      noDebe: NUNCA,
      aceptable: [dicho('sigue siendo tu acorde', compasEs(1, 'i'))],
      razonables: UN_ACORDE_SOLO,
    },
  }),
  caso({
    id: 'raro-dos-acordes',
    familia: 'raros',
    que: 'dos acordes',
    mode: 'major',
    toma: 'I IV',
    continuar: {
      // «V I, cuatro en total», «I IV V I», «IV iv I».
      debe: [
        o(
          y(cierraCon('V', 'I'), duraCompases(4)),
          cierraCon('IV', 'V', 'I'),
          cierraCon('IV', 'iv', 'I'),
        ),
      ],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: {
      // «ii en lugar de IV», «iv en lugar de IV», «repartir».
      debe: [o(compasEs(2, 'ii'), compasEs(2, 'iv'), esCamino('estirar'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
      razonables: TRES,
    },
  }),
  caso({
    id: 'raro-pulso-uno',
    familia: 'raros',
    que: 'cuatro acordes de un pulso en un compás de cuatro',
    mode: 'major',
    toma: 'I:1 IV:1 V:1 I:1',
    continuar: {
      // «otro compás a pulso a pulso», «estirar».
      debe: [dicho('llena compases enteros, de dos en dos', cuadra(2))],
      noDebe: NUNCA_A_PULSOS,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: {
      // «ii en lugar de IV», «repartir a dos pulsos».
      debe: [o(compasEs(2, 'ii'), mismosAcordesA(2))],
      noDebe: [QUIETO_EL_1, ...NUNCA_A_PULSOS],
      aceptable: [SIN_PEGAR],
      razonables: TRES,
    },
  }),
  caso({
    id: 'raro-siete',
    familia: 'raros',
    que: 'rock en siete por cuatro',
    mode: 'major',
    toma: 'I bVII IV I',
    pulsos: 7,
    pulsosPorCompas: 7,
    estilo: 'rock',
    continuar: {
      // «otra frase en siete», «bVI bVII I en siete».
      debe: [o(y(loNuevoVaA(7), cierraEnLaTonica()), cierraCon('bVI', 'bVII', 'I'))],
      noDebe: NUNCA,
      aceptable: [dicho('lo nuevo va a compás de siete', loNuevoVaA(7))],
      razonables: TRES,
    },
    retocar: {
      // «bIII en lugar de bVII», «iv».
      debe: [o(compasEs(2, 'bIII'), compasEs(3, 'iv'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
      razonables: TRES,
    },
  }),
  caso({
    id: 'raro-dieciseis',
    familia: 'raros',
    que: 'dos acordes de cuatro compases cada uno',
    mode: 'major',
    toma: 'I:16 iv:16',
    continuar: {
      // «un I de dieciséis», «bVII I», «V I».
      debe: [o(sigueCon('I'), cierraCon('bVII', 'I'), cierraCon('V', 'I'))],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: TRES,
    },
    retocar: {
      // «IV en lugar de iv», «repartir».
      debe: [o(compasEs(2, 'IV'), esCamino('estirar'))],
      noDebe: [QUIETO_EL_1, ...NUNCA],
      aceptable: [SIN_PEGAR],
      razonables: TRES,
    },
  }),
  caso({
    id: 'raro-treinta-y-dos',
    familia: 'raros',
    que: 'un AABA de treinta y dos compases',
    mode: 'major',
    toma: 'I iii IV V I iii IV I I iii IV V I iii IV I vi iii IV I vi ii V V I iii IV V I iii IV I',
    estilo: 'folk',
    continuar: {
      // «una coda si cabe; si no, lo que quepa».
      debe: [],
      noDebe: NUNCA,
      aceptable: [CIERRA_O_CONTRASTA],
      razonables: {
        cuantas: 0,
        porque:
          'la canción ya llega a los treinta y dos compases que admite una salida: detrás no cabe nada',
      },
    },
    retocar: {
      // «cambios puntuales de sustitución».
      debe: [cambiaAlgo()],
      noDebe: [
        QUIETO_EL_1,
        dicho('cambia el largo de la forma', y(no(esCamino('estirar')), no(duraCompases(32)))),
        ...NUNCA,
      ],
      aceptable: [SIN_PEGAR],
      razonables: TRES,
    },
  }),
];

/** Los de verificación con un giro que ya es estilo (`conSuEstilo`): el cine y el bolero. */
export const VERIFICACION_CON_SU_ESTILO: readonly CasoDeVerificacion[] =
  conSuEstilo(CORPUS_DE_VERIFICACION);

// --- El examen -------------------------------------------------------------------

/** Dónde se incumple: lo del examen viejo, la calidad de una de las primeras o el menú corto. */
type DondeFalla = Incumplida['donde'] | 'calidad' | 'razonables';

interface Falta {
  readonly donde: DondeFalla;
  readonly dice: string;
  /** Las salidas que fallan, por su número en el menú. */
  readonly culpables: readonly number[];
}

export interface NotaExigente {
  readonly caso: CasoExigible;
  readonly kind: PathKind;
  /** Lo que se esperaba de esa petición. */
  readonly espera: LoQueSeExige;
  readonly menu: readonly SalidaPosible[];
  /** Cuántas del menú pasan los `noDebe` y lo `aceptable`. */
  readonly razonables: number;
  readonly cumplidas: number;
  readonly total: number;
  readonly incumplidas: readonly Falta[];
}

/** Lo que tiene de malo una salida: lo que hace de `noDebe` y lo `aceptable` que no cumple. */
function reparos(espera: LoQueSeExige, salida: SalidaExaminada): string[] {
  return [
    ...espera.noDebe.filter((e) => e.cumple(salida)).map((e) => e.dice),
    ...(espera.aceptable ?? []).filter((e) => !e.cumple(salida)).map((e) => `falta: ${e.dice}`),
  ];
}

/**
 * Examina un menú **con la calidad de las primeras**.
 *
 * Lo de siempre —`debe` contra las tres primeras, `noDebe` contra todo, `primera`
 * contra la primera— y además un punto por cada una de las tres primeras que no
 * tiene reparos, y otro si el menú trae las razonables que se piden. Las
 * primeras que faltan cuentan como malas: un menú de una salida no deja elegir.
 * Cuando el caso dice por qué no puede haber tres, se miran solo las que puede
 * haber. Nulo si no se esperaba nada de esa petición.
 */
export function exigir(
  caso: CasoExigible,
  kind: PathKind,
  menu: readonly SalidaPosible[],
): NotaExigente | null {
  const espera = caso[kind];
  if (espera === undefined) {
    return null;
  }
  const todas = menu.map((salida) => examinar(caso.mode, caso.compases, caso.contexto, salida));
  const vistas = todas.slice(0, PRIMERAS);
  const faltas: Falta[] = [];

  for (const expectativa of espera.debe) {
    if (!vistas.some((salida) => expectativa.cumple(salida))) {
      faltas.push({ donde: 'debe', dice: expectativa.dice, culpables: [] });
    }
  }
  for (const expectativa of espera.noDebe) {
    const culpables = todas.flatMap((salida, i) => (expectativa.cumple(salida) ? [i + 1] : []));
    if (culpables.length > 0) {
      faltas.push({ donde: 'noDebe', dice: expectativa.dice, culpables });
    }
  }
  for (const expectativa of espera.primera ?? []) {
    const primera = vistas[0];
    if (primera === undefined || !expectativa.cumple(primera)) {
      faltas.push({ donde: 'primera', dice: expectativa.dice, culpables: [1] });
    }
  }

  const huecos = Math.min(PRIMERAS, espera.razonables?.cuantas ?? PRIMERAS);
  for (let i = 0; i < huecos; i += 1) {
    const salida = todas[i];
    const malas = salida === undefined ? ['no hay'] : reparos(espera, salida);
    if (malas.length > 0) {
      faltas.push({
        donde: 'calidad',
        dice: `la ${i + 1}: ${malas.join('; ')}`,
        culpables: [i + 1],
      });
    }
  }
  const razonables = todas.filter((salida) => reparos(espera, salida).length === 0).length;
  if (espera.razonables !== undefined && razonables < espera.razonables.cuantas) {
    faltas.push({
      donde: 'razonables',
      dice: `${razonables} salidas razonables de ${espera.razonables.cuantas}`,
      culpables: [],
    });
  }

  const total =
    espera.debe.length +
    espera.noDebe.length +
    (espera.primera ?? []).length +
    huecos +
    (espera.razonables === undefined ? 0 : 1);
  return {
    caso,
    kind,
    espera,
    menu,
    razonables,
    cumplidas: total - faltas.length,
    total,
    incumplidas: faltas,
  };
}

/**
 * El informe: la nota, la de cada familia y la de cada petición, y caso por caso
 * lo que falla con el menú delante —con asterisco las tres primeras—.
 */
export function informeExigente(
  notas: readonly NotaExigente[],
  cabecera: readonly string[] = [],
): string {
  const lineas = [...cabecera, `Nota: ${enLinea(cifras(notas))}`];
  for (const familia of [...new Set(notas.map((nota) => nota.caso.familia))]) {
    const suyas = notas.filter((nota) => nota.caso.familia === familia);
    lineas.push(`  ${familia}: ${enLinea(cifras(suyas))}`);
  }
  for (const kind of ['continuar', 'retocar'] as const) {
    lineas.push(`  al ${kind}: ${enLinea(cifras(notas.filter((nota) => nota.kind === kind)))}`);
  }

  for (const nota of notas) {
    const marca = nota.incumplidas.length === 0 ? 'BIEN' : 'MAL ';
    const porque = nota.espera.razonables?.porque;
    lineas.push(
      '',
      `${marca} ${nota.caso.id}:${nota.kind} [${nota.caso.familia}] ${nota.caso.que}: ${nota.cumplidas}/${nota.total}`,
      ...(porque === undefined ? [] : [`   (${porque})`]),
    );
    if (nota.incumplidas.length === 0) {
      continue;
    }
    nota.menu.forEach((salida, i) =>
      lineas.push(
        `   ${i < PRIMERAS ? '*' : ' '}${i + 1}. ${enGrados(nota.caso, nota.kind, salida)}`,
      ),
    );
    for (const { donde, dice, culpables } of nota.incumplidas) {
      const quien = donde === 'noDebe' ? ` (la ${culpables.join(', la ')})` : '';
      lineas.push(`   ${donde}: ${dice}${quien}`);
    }
  }
  return lineas.join('\n');
}
