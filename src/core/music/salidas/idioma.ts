/**
 * El idioma de tu canción: lo que se lee de lo tuyo antes de construir nada.
 *
 * Estilo, especies, ritmo, forma, cómo llegas a casa. Todo camino parte de aquí
 * (`idiomaDe`), y por eso se lee una vez por petición y no una por camino.
 */
import {
  esSeventhQuality,
  notasDeEspecieSimple,
  seventhNotes,
  type EspecieDeBloque,
} from '../chords';
import type { KeyMode } from '../keys';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import type { SectionRole } from '../song';
import { STYLES, type StyleId } from '../styles';
import type { ContextoDeSalidas, NotaDelCompas } from './contexto';
import { cadenciaPropia } from './juez/cadencia';
import { vivePrestado } from './juez/novedad';
import { pulsosHabituales } from './juez/ritmo-armonico';
import type { PathStep } from './tipos';
import { tonicaDe } from './tonica';
import { esUnBlues, MAX_BEATS, pulsosDe } from './validar';

/** Los compases de una frase: lo que mide la parte que se añade de una vez. */
export const LARGO_DE_UNA_FRASE = 4;

/**
 * El peso de una familia que ni suma ni resta: por encima, el estilo la usa más de
 * lo corriente y meterla suma; por debajo, cuesta. Es la mitad de la escala de
 * `STYLES`, que va de 0 —no se usa— a 1 —es lo de casa—.
 */
export const PESO_NEUTRO = 0.5;

/**
 * Cuánto pesa cada familia sin estilo elegido: **ni premia ni castiga ningún
 * idioma**, así que el préstamo y la dominante secundaria están justo en el
 * neutro. El sustituto tritonal y el napolitano no: son idiomas con nombre —el
 * jazz, el metal—, y sin estilo que los pida suenan a otro sitio.
 *
 * Con estilo, los pesos salen de `STYLES`, que es la chuleta que ya usan las
 * sugerencias: el bVII pesa en un rock y no en un jazz por lo que dice allí.
 */
const SIN_ESTILO = {
  borrowed: PESO_NEUTRO,
  secondaryDominant: PESO_NEUTRO,
  tritoneSub: 0.2,
  neapolitan: 0.2,
  // El vii° como acorde con nombre propio es de coral y de jazz: sin estilo que lo
  // pida, neutro es no premiar lo raro.
  diminished: 0.2,
};

type Lenguaje = 'triadas' | 'septimas' | 'quintas';

/**
 * Lo que se sabe de tu canción además de sus grados, ya pensado para elegir qué
 * giros probar: los pesos de su estilo, el modo en que se mueve y lo que mide una
 * frase.
 */
export interface Idioma {
  readonly mode: KeyMode;
  readonly tonica: DegreeSymbol;
  readonly estilo: StyleId | null;
  /** De 0 a 1, de la chuleta de estilos. */
  readonly prestamo: number;
  readonly secundaria: number;
  readonly tritono: number;
  readonly napolitano: number;
  /** Cuánto usa el estilo los disminuidos: el vii° como cadencia es suyo o es raro. */
  readonly disminuido: number;
  readonly tuyos: ReadonlySet<DegreeSymbol>;
  /** Mayor con bVII y sin V: la sensible le quitaría el modo. */
  readonly mixolidio: boolean;
  /**
   * Por dónde llega a casa tu canción cuando no es por la dominante: el VII de un
   * menor natural o el iv de una de cine (`cadenciaPropia`, la vara del juez).
   * Cerrar como ella es lo fuerte, y el V con sensible, un color que se trae.
   */
  readonly cadenciaPropia: DegreeSymbol | null;
  /**
   * Las llegadas **sin sensible** que tu canción eligió en lugar del V, la primera
   * la tuya: el bVII de un riff mixolidio, la v de un folk eólico, el bII de un
   * metal frigio —y en menor, el VII, que es la otra—. Vacío si tocas el V o no
   * elegiste ninguna. Es lo que dice que el V es de otro idioma (`precioDelGrado`).
   */
  readonly modales: readonly DegreeSymbol[];
  /** Con qué especie tocas cada grado: lo nuevo del mismo grado suena igual. */
  readonly especieDelGrado: ReadonlyMap<DegreeSymbol, EspecieDeBloque | null>;
  /** Vive de dominantes secundarias, sin bVII: un bolero, un estándar. */
  readonly funcional: boolean;
  /** Vive de la mezcla con el menor: lo prestado es más de la mitad de lo suyo (`vivePrestado`). */
  readonly mezcla: boolean;
  /**
   * Los dos acordes con los que lo tuyo llega a casa (`suLlegada`), el de antes nulo
   * si no lo hay. Nulo si no llega de ninguna manera.
   */
  readonly suLlegada: { readonly antes: DegreeSymbol | null; readonly llega: DegreeSymbol } | null;
  /**
   * Un vaivén de dos acordes que no gira alrededor de la tónica: su centro es otro.
   * **Salvo que el papel pida llegar**: un pre, un puente o un final en `VI VII VI
   * VII` preparan la tónica, no viven en otro modo (lo encontró el quinto examen: lo
   * que seguía a un pre así nunca caía en la i). Entonces está en `vaiven`.
   */
  readonly centroModal: DegreeSymbol | null;
  /** Los dos acordes de lo tuyo si es un vaivén que no pasa por la tónica, sea cual sea su papel. */
  readonly vaiven: readonly DegreeSymbol[] | null;
  /** Con qué especie suena lo tuyo: lo nuevo habla igual. */
  readonly lenguaje: Lenguaje;
  /**
   * Si tu tónica o tu subdominante suenan con séptima de dominante: el idioma del
   * funk, del soul, del gospel y del blues aunque no se haya elegido el estilo. Lo
   * nuevo habla igual —un IV7, no un IVmaj7— (`especieNueva`).
   */
  readonly dominantes: boolean;
  readonly papel: SectionRole;
  /** Los pulsos de un compás nuevo. */
  readonly pulsos: number;
  /** Los pulsos de un compás de verdad. */
  readonly compas: number;
  /** Los pulsos de una frase: cuatro compases, o el coro entero de un blues. */
  readonly frase: number;
  /** Si lo tuyo es un coro de blues de doce compases. */
  readonly blues: boolean;
  readonly dudosos: readonly boolean[];
  /**
   * Los grados tuyos que **solo** se oyeron con duda, cuando lo demás se oyó bien:
   * lo nuevo no se apoya en ellos (`precioDelGrado`).
   */
  readonly soloConDuda: ReadonlySet<DegreeSymbol>;
  /** Si la mitad o más de lo tuyo se oyó con duda: lo nuevo, sin color. */
  readonly tomaDudosa: boolean;
  readonly melodia: readonly (readonly NotaDelCompas[])[];
  readonly especies: readonly (EspecieDeBloque | null)[];
}

/**
 * El centro de un vaivén de dos acordes, si no es la tónica.
 *
 * `ii V ii V` en Do mayor es Re dórico escrito en Do: cerrarlo en Do se carga el
 * modo. Se reconoce por la forma —dos grados que se alternan, cuatro compases o
 * más— y por dónde empieza.
 */
function centroDelVaiven(original: readonly PathStep[], tonica: DegreeSymbol): DegreeSymbol | null {
  const grados = original.map((paso) => paso.degree);
  if (
    grados.length < 4 ||
    new Set(grados).size !== 2 ||
    grados.some((grado, i) => i > 0 && grado === grados[i - 1])
  ) {
    return null;
  }
  return grados[0] === tonica ? null : grados[0]!;
}

/**
 * Lo que dura un acorde de lo tuyo, para lo que se le añade.
 *
 * Es `pulsosHabituales`, la vara del juez, **salvo con una toma regular**: si
 * todos tus acordes duran lo mismo y eso cabe en el compás —un pulso, medio
 * compás, uno entero o varios—, ese es tu ritmo armónico. Un riff `I IV V I` a un
 * pulso es un compás con cuatro acordes, no una toma desigual: la rejilla del juez
 * no tiene el pulso suelto y lo redondeaba a dos, y entonces todo lo nuevo iba a
 * la mitad de velocidad y «estirar» lo cuadraba como si se hubiera tocado mal.
 */
function pulsosDeTuRitmo(original: readonly PathStep[], compas: number): number {
  const primero = original[0]!.beats;
  const regular = original.every((paso) => paso.beats === primero);
  const cabe = compas % primero === 0 || (primero % compas === 0 && primero <= MAX_BEATS);
  return regular && cabe ? primero : pulsosHabituales(original, compas);
}

/**
 * Los pulsos de una frase de tu canción: cuatro compases, **o los que mida tu
 * forma si es regular y no es de cuatro**.
 *
 * `I IV V | vi IV V` son dos frases de tres compases que acaban igual: es una
 * forma, no una de cuatro mal contada, y completarla a ocho o quitarle dos para
 * dejarla en cuatro le rompía el periodo. Se reconoce por eso, porque se parte en
 * trozos iguales de tres, cinco, seis o siete compases que **acaban con los mismos
 * dos acordes** —la cadencia que hace de frase—. Y en un blues que no es de doce, el coro entero:
 * lo que sigue a un blues de ocho es otro coro de ocho, no una frase de cuatro.
 */
function fraseDeTuForma(
  original: readonly PathStep[],
  compas: number,
  estilo: StyleId | null,
  tonica: DegreeSymbol,
): number {
  const total = pulsosDe(original);
  const compases = total / compas;
  if (
    estilo === 'blues' &&
    [8, 16].includes(compases) &&
    original[0]!.degree === tonica &&
    original.every((paso) => paso.beats % compas === 0)
  ) {
    return total;
  }
  if (!Number.isInteger(compases) || compases % 4 === 0) {
    return 4 * compas;
  }
  // Dónde empieza cada acorde, para partir por compases y no por acordes.
  const inicios: number[] = [];
  let pulso = 0;
  for (const paso of original) {
    inicios.push(pulso);
    pulso += paso.beats;
  }
  // La cadencia de cada trozo: sus dos últimos acordes. Con uno solo, cualquier
  // paseo que pasara dos veces por el mismo acorde parecía una forma.
  const cadenciaAntesDe = (pulsoDelCorte: number): string | null => {
    const i = pulsoDelCorte === total ? original.length : inicios.indexOf(pulsoDelCorte);
    return i < 2 ? null : `${original[i - 2]!.degree} ${original[i - 1]!.degree}`;
  };
  for (const largo of [3, 5, 6, 7]) {
    if (compases % largo !== 0 || compases / largo < 2) {
      continue;
    }
    const cadencias = Array.from({ length: compases / largo }, (_, n) =>
      cadenciaAntesDe((n + 1) * largo * compas),
    );
    if (cadencias.every((cadencia) => cadencia !== null && cadencia === cadencias[0])) {
      return largo * compas;
    }
  }
  return 4 * compas;
}

/**
 * Las llegadas sin sensible que eligió tu canción, si no toca el V (`Idioma.modales`).
 * En menor, la v o el bII —lo que tocas— y el VII, que también llega sin sensible.
 *
 * **La v cuenta con el VII al lado, como en el juez** (`modalDe`). Sola es un
 * acorde de paso del menor natural —`i v VI III` baja por ella—, no una elección:
 * el arreglista cierra esa bajada con `iv V i`, y aquí el V costaba lo que cuesta
 * meter la sensible en un modo que la ha quitado. El bII sí elige solo: es el
 * semitono frigio que hace de dominante.
 */
function llegadasModales(
  mode: KeyMode,
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
): DegreeSymbol[] {
  const tuyos = new Set(original.map((paso) => paso.degree));
  // Y elegir es no tenerla en ningún sitio, como mira el juez (`modalDe`): el Imaj7
  // de un jazz la lleva dentro, y su bVII7 es la puerta de atrás, no un mixolidio.
  const laTiene = original.some(
    (paso, i) =>
      paso.degree.includes('/') || notasDelAcorde(mode, paso.degree, especies[i] ?? null).has(11),
  );
  if (tuyos.has('V') || laTiene) {
    return [];
  }
  if (mode === 'major') {
    return tuyos.has('bVII') ? ['bVII'] : [];
  }
  const elegidas = (['v', 'bII'] as const).filter(
    (grado) => tuyos.has(grado) && (grado === 'bII' || tuyos.has('VII')),
  );
  return elegidas.length === 0 ? [] : [...elegidas, 'VII'];
}

/**
 * Si tu canción **habla en funcional** (`Idioma.funcional`): llega por la dominante
 * y la prepara, sin el bVII ni el VII que cierran sin ella.
 *
 * Lo dicen dos cosas. **Las dominantes secundarias**, que es de lo que vive un
 * bolero o un estándar. **Y la célula ii–V**: la `ii° V` del menor, que es la
 * cadencia de manual, y la `ii V` en cuatríadas —con el V7—, que es el R&B y el
 * jazz aunque no se haya dicho el estilo. Antes solo contaban las secundarias, y a
 * un `Imaj7 vi7 ii7 V7` sin estilo le salía de segunda el `bVII I` del rock. En
 * tríadas el `ii V` del pop no dice tanto, y no cuenta. El idioma de dominantes de
 * un blues o un funk tampoco: allí el bVII7 es de la casa.
 */
function hablaEnFuncional(
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
  lenguaje: Lenguaje,
  tuyos: ReadonlySet<DegreeSymbol>,
): boolean {
  if (tuyos.has('bVII') || tuyos.has('VII')) {
    return false;
  }
  const celda = original.some((paso, i) => {
    const siguiente = original[i + 1];
    if (siguiente?.degree !== 'V') {
      return false;
    }
    return (
      paso.degree === 'ii°' ||
      (paso.degree === 'ii' && lenguaje === 'septimas' && especies[i + 1] === 'dominant7')
    );
  });
  return celda || [...tuyos].some((grado) => grado.includes('/'));
}

/**
 * Cómo llega lo tuyo a casa: los dos acordes distintos de antes de tu tónica final
 * o, si lo tuyo es un bucle que empieza en la tónica y acaba fuera, los dos últimos,
 * que llevan de vuelta al principio. Es lo que el juez llama `tuLlegada`.
 */
function suLlegada(
  tonica: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): { antes: DegreeSymbol | null; llega: DegreeSymbol } | null {
  const distintoAntes = (i: number) => {
    let k = i - 1;
    while (k >= 0 && grados[k] === grados[i]) {
      k -= 1;
    }
    return grados[k] ?? null;
  };
  const ultimo = grados.length - 1;
  if (grados[ultimo] !== tonica) {
    return grados[0] === tonica ? { antes: distintoAntes(ultimo), llega: grados[ultimo]! } : null;
  }
  let desde = ultimo;
  while (desde > 0 && grados[desde - 1] === tonica) {
    desde -= 1;
  }
  return desde === 0 ? null : { antes: distintoAntes(desde - 1), llega: grados[desde - 1]! };
}

/**
 * La especie con la que tocas cada grado: la que más veces, y a igualdad, **la que
 * no retiene**: un suspendido es una retención que resuelve, y lo nuevo del mismo
 * grado suena como su resolución. Antes, a igualdad, la primera: el `V(sus4) V` de un
 * rock daba a todo V nuevo un sus4, y un otro final acababa en la retención sin
 * resolverla. Entre las demás, la primera.
 */
function especiesPorGrado(
  original: readonly PathStep[],
  especies: readonly (EspecieDeBloque | null)[],
): Map<DegreeSymbol, EspecieDeBloque | null> {
  const cuentas = new Map<DegreeSymbol, Map<EspecieDeBloque | null, number>>();
  original.forEach((paso, i) => {
    const delGrado = cuentas.get(paso.degree) ?? new Map<EspecieDeBloque | null, number>();
    const especie = especies[i] ?? null;
    delGrado.set(especie, (delGrado.get(especie) ?? 0) + 1);
    cuentas.set(paso.degree, delGrado);
  });
  return new Map(
    [...cuentas].map(([grado, delGrado]) => {
      const mas = Math.max(...delGrado.values());
      const empatadas = [...delGrado].filter(([, veces]) => veces === mas);
      const resuelta = empatadas.find(([especie]) => especie !== 'sus2' && especie !== 'sus4');
      return [grado, (resuelta ?? empatadas[0]!)[0]];
    }),
  );
}

/**
 * Cuánto usa el estilo el bII **en este modo**: lo que dice `STYLES`, salvo el
 * flamenco en mayor. Su bII es el semitono frigio, el de un menor o del modo de Mi;
 * una rumba en mayor —`I IV I V`— no lo tiene, y el arreglista lo tachó. Lo mismo
 * mira el juez (`pesosDelEstilo`, en `juez/estilo.ts`).
 */
function napolitanoDe(mode: KeyMode, estilo: StyleId | null, peso: number): number {
  return estilo === 'flamenco' && mode === 'major' ? 0 : peso;
}

export function idiomaDe(
  mode: KeyMode,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas,
): Idioma {
  const estilo = contexto.estilo ?? null;
  const pesos = estilo === null ? SIN_ESTILO : STYLES[estilo].weights;
  const tonica = tonicaDe(mode);
  const tuyos = new Set(original.map((paso) => paso.degree));
  // Sin compás dicho, cuatro por cuatro: lo mismo que supone el juez, que mide las
  // frases con la misma vara. Si cada uno contara los compases a su manera, lo que
  // aquí cuadra allí saldría cojo.
  const pedido = contexto.pulsosPorCompas;
  const compas =
    pedido !== undefined && Number.isInteger(pedido) && pedido >= 1 && pedido <= MAX_BEATS
      ? pedido
      : 4;
  const pulsos = pulsosDeTuRitmo(original, compas);
  const blues = esUnBlues(mode, original);
  const especies = contexto.especies ?? [];
  const mitad = original.length / 2;
  const lenguaje: Lenguaje =
    especies.filter(esSeventhQuality).length > mitad
      ? 'septimas'
      : especies.filter((especie) => especie === 'quinta').length > mitad
        ? 'quintas'
        : estilo !== null && FUNCIONALES.has(estilo)
          ? 'septimas'
          : 'triadas';
  // El préstamo, lo que diga el estilo, **sin rebajarlo por no haber estilo**: eso
  // dejaba el pop y la canción sin estilo sin uno solo en el menú, ni el `IV iv I`
  // que es de manual.
  const prestamo = pesos.borrowed;
  // Sin especies dichas no se sabe cómo suena lo tuyo, y no se copia nada.
  const especieDelGrado =
    contexto.especies === undefined
      ? new Map<DegreeSymbol, EspecieDeBloque | null>()
      : especiesPorGrado(original, especies);
  // Lo que más suena en el grado, no una vez: el I7 de paso del gospel, `I I7 IV`,
  // es la dominante del IV, no el idioma de la canción.
  const dominantes = ([tonica, mode === 'major' ? 'IV' : 'iv'] as const).some(
    (grado) => especieDelGrado.get(grado) === 'dominant7',
  );
  const funcional = hablaEnFuncional(original, especies, lenguaje, tuyos) && !dominantes;
  const dudosos = contexto.dudosos ?? [];
  const conDuda = original.filter((_, i) => dudosos[i] === true).length;
  const ciertos = new Set(original.filter((_, i) => dudosos[i] !== true).map((p) => p.degree));
  const soloConDuda = new Set(
    [...tuyos].filter((grado) => !ciertos.has(grado) && grado !== tonica),
  );
  return {
    mode,
    tonica,
    estilo,
    prestamo,
    secundaria: pesos.secondaryDominant,
    tritono: funcional && estilo === null ? PESO_NEUTRO : pesos.tritoneSub,
    napolitano: napolitanoDe(mode, estilo, pesos.neapolitan),
    disminuido: pesos.diminished,
    tuyos,
    mixolidio: mode === 'major' && tuyos.has('bVII') && !tuyos.has('V'),
    modales: llegadasModales(mode, original, especies),
    cadenciaPropia: cadenciaPropia(
      mode,
      original.map((paso) => paso.degree),
    ),
    especieDelGrado,
    funcional,
    mezcla: vivePrestado(
      mode,
      original.map((paso) => paso.degree),
    ),
    suLlegada: suLlegada(
      tonica,
      original.map((paso) => paso.degree),
    ),
    centroModal: PIDEN_LLEGADA.has(contexto.papel ?? 'idea')
      ? null
      : centroDelVaiven(original, tonica),
    vaiven:
      centroDelVaiven(original, tonica) === null
        ? null
        : [original[0]!.degree, original[1]!.degree],
    lenguaje,
    dominantes,
    papel: contexto.papel ?? 'idea',
    pulsos,
    compas,
    frase: blues ? pulsosDe(original) : fraseDeTuForma(original, compas, estilo, tonica),
    blues,
    dudosos,
    soloConDuda,
    tomaDudosa: conDuda > 0 && conDuda * 2 >= original.length,
    melodia: contexto.melodia ?? [],
    especies,
  };
}

/** Si un grado viene de fuera de la escala: prestado del otro modo, o napolitano. */
export function esPrestado(mode: KeyMode, degree: DegreeSymbol): boolean {
  return mode === 'major' ? degree.startsWith('b') || degree === 'iv' : degree === 'bII';
}

/**
 * Los estilos que **viven de que la dominante llegue**: el jazz y el bolero. En ellos
 * lo de casa son las cuatríadas, la cadena de secundarias cuenta, el ii–V es la
 * célula y volver de la dominante no se construye.
 */
const FUNCIONALES: ReadonlySet<StyleId> = new Set(['jazz', 'bolero']);

export function esFuncional(id: Pick<Idioma, 'estilo'>): boolean {
  return id.estilo !== null && FUNCIONALES.has(id.estilo);
}

/** Las notas de un acorde sobre la tónica, con la especie con que suena. */
export function notasDelAcorde(
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): Set<number> {
  const acorde = resolveDegree(0, mode, degree);
  if (especie === null) {
    return new Set(acorde.notes);
  }
  return new Set(
    esSeventhQuality(especie)
      ? seventhNotes(acorde.root, especie)
      : notasDeEspecieSimple(acorde.root, especie),
  );
}

/** Las partes detrás de las cuales viene una llegada y no otra parte que se va. */
export const PIDEN_LLEGADA: ReadonlySet<SectionRole> = new Set(['pre', 'puente', 'final']);

/**
 * Dónde llega lo tuyo a casa **si llega antes del final y se queda**: el primer
 * compás de la tónica que acaba la canción, cuando dura más de un compás —`VI VII
 * i i`, `… IV V I I`—. Nulo si lo tuyo no acaba en la tónica, si la tónica final
 * es un compás solo o si todo es tónica.
 *
 * **La llegada es ese compás, no el último**: el segundo `i` de `VI VII i i` es la
 * llegada que se sostiene. Antes solo se guardaba el último compás, y salían `VI VII
 * VI i` o `VI VII V i`, que cambian justo el compás en el que la canción llega.
 */
export function llegadaSostenida(id: Idioma, original: readonly PathStep[]): number | null {
  let desde = original.length - 1;
  if (original[desde]!.degree !== id.tonica) {
    return null;
  }
  while (desde > 0 && original[desde - 1]!.degree === id.tonica) {
    desde -= 1;
  }
  return desde > 0 && desde < original.length - 1 ? desde : null;
}
