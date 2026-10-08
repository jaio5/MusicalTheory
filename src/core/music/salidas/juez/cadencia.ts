/**
 * Criterio 2: la cadencia, por posición.
 *
 * Dónde llega la salida y con cuánta fuerza; la misma vara que usa quien construye
 * las salidas para saber cómo llegas tú (`cadenciaPropia`).
 */
import { veces } from '../../../cifras';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { StyleId } from '../../styles';
import { reposoFrigio } from '../formas';
import { tonicaDe } from '../tonica';
import { enlace } from './enlace';
import { alCuartoYVuelta } from './forma';
import {
  acotar,
  esTension,
  llegadaDesdeLaSubdominante,
  sinSensible,
  type Acorde,
  type Cierre,
  type Final,
  type Funcion,
  type Hecho,
  type Juicio,
} from './juicio';
import { faltaLaLlegada, parteConPapel, QUEDAN_ABIERTAS } from './papel';

/** Lo que vale cada cierre cuando lo tuyo es modal: el bVII manda y el V sobra. */
const FUERZA_EN_MODAL: Readonly<Partial<Record<Cierre, number>>> = {
  perfecta: 0.3,
  'sin-sensible': 1,
};

/**
 * Lo que vale cada cierre cuando tu canción **llega a casa por su propio color**
 * (`cadenciaPropia`): las dos cadencias se cambian los papeles. La tuya cierra
 * entera, y la del V, que trae la sensible de fuera, como cierra en otro sitio una
 * sin sensible. No es el modo de `FUERZA_EN_MODAL`, que la descarta: el V cabe —en
 * un menor natural lo da por bueno el arreglista detrás de un `iv`—, pero no delante
 * de lo tuyo.
 */
const FUERZA_PROPIA = { perfecta: 0.75, suya: 1 } as const;

/**
 * Por dónde llega a casa tu canción **cuando no es por la dominante**, o nulo: el
 * acorde que va a la tónica dentro de lo tuyo, o tu último si acabas en él y empiezas
 * en ella, que es la vuelta de un bucle. Solo los que eligen un color y no la
 * sensible, y solo si no tocas ninguna dominante que la lleve:
 *
 * - **El VII de un menor sin V**: `VII i`, la cadencia eólica de `i VI III VII` o de
 *   un reggae en `i VII`.
 * - **El iv de un mayor sin V**: `iv I`, la plagal menor de la música de cine, `I iv
 *   I iv`.
 *
 * Esa es la cadencia de esa canción, y cerrar con ella es lo fuerte: antes el V
 * cerraba siempre mejor, y a un reggae le salía primero un V con la sensible «a
 * todo trapo», y a una de cine, un `IV V I`. El IV de un `I IV I IV` no: es la
 * subdominante de la escala, no un color elegido. Lo usa también quien construye
 * las salidas (`salidas/`): si cada uno oyera otra cadencia, uno construiría lo
 * que el otro baja.
 */
export function cadenciaPropia(
  mode: KeyMode,
  grados: readonly DegreeSymbol[],
): DegreeSymbol | null {
  const tonica = tonicaDe(mode);
  const suya: DegreeSymbol = mode === 'minor' ? 'VII' : 'iv';
  const conSensible = grados.some(
    (grado) => grado === 'V' || grado === 'vii°' || grado.includes('/'),
  );
  if (conSensible) {
    return null;
  }
  const dentro = grados.some((grado, i) => grado === tonica && grados[i - 1] === suya);
  return dentro || (grados.at(-1) === suya && grados[0] === tonica) ? suya : null;
}

/**
 * Si un acorde es el vii° **tríada**: la sensible con dos notas de la dominante
 * encima y sin su fundamental. Con su séptima —el semidisminuido, el disminuido—
 * es la dominante de novena sin bajo y hace su papel; sin ella, en un pop o un
 * rock, suena a ejercicio de armonía y no a llegada.
 */
function esSensibleSuelta(acorde: Pick<Acorde, 'degree' | 'especie'>): boolean {
  return acorde.degree === 'vii°' && (acorde.especie === null || acorde.especie === 'dim');
}

/**
 * Los estilos en los que el vii° tríada no es una dominante: los de canción, y el
 * flamenco y el cine, donde la sensible sin su V suena a ejercicio de coral. El jazz
 * y el bolero lo tocan con su séptima, y ahí sí hace de dominante.
 */
const POPULARES: ReadonlySet<StyleId> = new Set([
  'pop',
  'rock',
  'metal',
  'folk',
  'blues',
  'funk',
  'country',
  'reggae',
  'flamenco',
  'cine',
]);

/** Si el vii° tríada, aquí, no hace de dominante: en los estilos de canción. */
function sensibleSueltaFloja(j: Juicio, acorde: Acorde): boolean {
  return esSensibleSuelta(acorde) && j.estilo !== undefined && POPULARES.has(j.estilo);
}

/** Cómo cierra la canción, si acaba en la tónica. */
export function finalDe(j: Juicio): Final | null {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  if (ultimo.funcion !== 'tonica') {
    return null;
  }
  let desde = j.cancion.length - 1;
  while (desde > 0 && j.cancion[desde - 1]!.funcion === 'tonica') {
    desde -= 1;
  }
  const antes = j.cancion[desde - 1];
  const POR_FUNCION: Readonly<Record<Funcion, Cierre>> = {
    dominante: 'perfecta',
    tritono: 'perfecta',
    modal: 'sin-sensible',
    subdominante: 'plagal',
    sustituto: 'rebote',
    secundaria: 'rebote',
    tonica: 'ninguna',
  };
  const cierre: Cierre =
    antes === undefined
      ? 'ninguna'
      : esSensibleSuelta(antes)
        ? 'sensible'
        : POR_FUNCION[antes.funcion];
  return {
    cierre,
    desde,
    compas: j.cancion[desde]!.inicio / j.pc,
    antes,
  };
}

const FUERZA: Readonly<Record<Cierre, number>> = {
  perfecta: 1,
  'sin-sensible': 0.75,
  plagal: 0.55,
  sensible: 0.5,
  rebote: 0.1,
  ninguna: 0,
};

/**
 * Lo que cierra el vii° tríada: menos que una plagal, y en un estilo de canción
 * casi nada. Contaba como `perfecta`, porque la tabla de papeles lo pone con la
 * dominante, y un `IV vii° I` salía como un cierre fuerte en un pop.
 */
function fuerzaDeLaSensible(j: Juicio, antes: Acorde): number {
  return sensibleSueltaFloja(j, antes) ? 0.3 : FUERZA.sensible;
}

/**
 * Cómo se llama la cadencia, **por el acorde que llega y no solo por su papel**.
 *
 * La plagal es IV I —o iv I, la menor—: el amén. Antes cualquier subdominante que
 * llegaba a casa se llamaba así, y un `ii I` salía como «cadencia plagal, el
 * amén», que no lo es. Y la perfecta desde el bII7 es la del sustituto tritonal.
 */
function nombreDelCierre(cierre: Cierre, antes: Acorde | undefined): string {
  switch (cierre) {
    case 'perfecta':
      return antes?.funcion === 'tritono'
        ? 'cadencia perfecta por el sustituto tritonal'
        : 'cadencia perfecta';
    case 'sin-sensible':
      return 'cierra sin sensible';
    case 'plagal':
      return llegadaDesdeLaSubdominante(antes!.degree);
    case 'sensible':
      return 'llega desde el vii°, con la sensible y sin la dominante entera';
    case 'rebote':
      return 'llega de rebote, sin cadencia';
    case 'ninguna':
      return 'todo es tónica, no hay cadencia';
  }
}

/**
 * Lo que cierra una cadencia sin sensible **en este estilo**: entera en un rock,
 * la mitad en un jazz en menor y casi nada en uno en mayor, donde `bVII I` o `v i`
 * suenan a otro idioma. Es lo mismo que ya decía la sintaxis (`SIN_SENSIBLE`), y
 * sin esto la cadencia lo contradecía: un `v i` cerraba un jazz casi tan bien
 * como un `V i`.
 */
function fuerzaSinSensible(j: Juicio): number {
  return FUERZA['sin-sensible'] * (0.5 + 0.5 * sinSensible(j));
}

/**
 * Si la tónica llega donde el oído la espera.
 *
 * Dos sitios valen: **el último compás de un grupo de cuatro** —o el tercero, si
 * la tónica se sostiene hasta el cuarto, como en `ii V I I`— y **el primero del
 * grupo siguiente**, que es donde cae el acorde final de una canción que acababa
 * en V: `I vi IV V | I`. Lo segundo es lo que haría un arreglista con un bucle
 * abierto, y es la razón de que cinco compases no sean una frase coja si el
 * quinto es la llegada.
 */
function llegaATiempo(j: Juicio, final: Final): number {
  const { compas } = final;
  if (!Number.isInteger(compas)) {
    return 0.25;
  }
  // De cuatro en cuatro, o del largo de tus frases si son otro.
  const grupo = j.frase;
  const alAbrir = compas > 0 && compas % grupo === 0 && j.largo - compas <= grupo;
  const alCerrar = j.largo % grupo === 0 && j.largo - compas <= 2;
  if (alAbrir || alCerrar) {
    return compas % (2 * grupo) === 0 || j.largo % (2 * grupo) === 0 ? 1 : 0.9;
  }
  return 0.5;
}

/**
 * Cómo llega lo tuyo a casa: **los dos acordes de antes de tu tónica final** —el que
 * va a ella y el que lo prepara— o, si lo tuyo es un bucle que empieza en la tónica y
 * acaba fuera, tus dos últimos, que son los que llevan de vuelta al principio. Nulo
 * si no llega de ninguna manera; el de antes, nulo si no lo hay.
 *
 * Con dos y no con uno: `IV iv I` no es la llegada de `I iv I iv` aunque acabe igual,
 * es la plagal menor preparada —una de las tres respuestas del arreglista—, y
 * mirando solo el iv salía como «otra vuelta más».
 */
function tuLlegada(
  j: Juicio,
): { readonly antes: DegreeSymbol | null; readonly llega: DegreeSymbol } | null {
  const tuyos = j.original;
  const ultimo = tuyos[tuyos.length - 1]!;
  if (ultimo.funcion !== 'tonica') {
    return tuyos[0]!.funcion === 'tonica'
      ? { antes: distintoAntes(tuyos, tuyos.length - 1), llega: ultimo.degree }
      : null;
  }
  let desde = tuyos.length - 1;
  while (desde > 0 && tuyos[desde - 1]!.funcion === 'tonica') {
    desde -= 1;
  }
  const llega = tuyos[desde - 1]?.degree;
  return llega === undefined ? null : { antes: distintoAntes(tuyos, desde - 1), llega };
}

/** El primer acorde distinto que suena antes del `i`: un acorde que se sostiene es uno. */
function distintoAntes(pasos: readonly Acorde[], i: number): DegreeSymbol | null {
  let k = i - 1;
  while (k >= 0 && pasos[k]!.degree === pasos[i]!.degree) {
    k -= 1;
  }
  return pasos[k]?.degree ?? null;
}

/**
 * Lo que cierra la cadencia con que acaba la salida, antes de mirar dónde cae.
 *
 * Por orden: lo modal tiene su tabla; si lo tuyo llega con una cadencia propia, esa
 * vale lo que la perfecta; y lo demás, lo que cierra en este estilo.
 */
function fuerzaDelCierre(j: Juicio, final: Final, propia: DegreeSymbol | null): number {
  return (
    (j.modal === null ? undefined : FUERZA_EN_MODAL[final.cierre]) ??
    (propia === null
      ? undefined
      : final.cierre === 'perfecta'
        ? FUERZA_PROPIA.perfecta
        : final.antes?.degree === propia
          ? FUERZA_PROPIA.suya
          : undefined) ??
    (final.cierre === 'sin-sensible'
      ? fuerzaSinSensible(j)
      : final.cierre === 'sensible'
        ? fuerzaDeLaSensible(j, final.antes!)
        : FUERZA[final.cierre])
  );
}

/**
 * Si la cadencia es **tu vuelta tocada otra vez**: una cadencia floja solo suena a
 * final por contraste. Si es la misma con la que lo tuyo ya llegaba a casa —o con la
 * que tu bucle da la vuelta—, lo que se oye es otra vuelta más: `I V vi IV` cerrado
 * con `IV I` no acaba, gira. La perfecta no tiene ese problema: cierra por sí misma,
 * y tampoco la que en tu idioma vale lo que ella —el `VII i` de un menor que llega
 * por el VII, el `bVII I` de un riff mixolidio—: es la cadencia fuerte de tu
 * canción, no una floja.
 *
 * **Y solo si de verdad puede venir otra vuelta.** No si lo que se añade es el
 * final —detrás no hay nada, y el `IV I` tras `I V vi IV` es el amén—, ni si la
 * llegada cae dentro de tu última frase, que estaba sin acabar: entonces no empieza
 * otra, completa la tuya. Es lo que pasaba con un rock de 31 compases en `I bVII IV
 * I` que acababa en IV: su compás 32 es la I que cierra la frase como cierran todas
 * las suyas.
 */
function esOtraVuelta(j: Juicio, final: Final, fuerza: number): boolean {
  const terminaAqui = parteConPapel(j)?.papel === 'final';
  const completaTuFrase = final.compas < Math.ceil(j.largoOriginal / j.frase) * j.frase;
  const tuya = tuLlegada(j);
  return (
    j.kind === 'continuar' &&
    !terminaAqui &&
    !completaTuFrase &&
    fuerza < FUERZA.perfecta &&
    final.antes !== undefined &&
    tuya !== null &&
    final.antes.degree === tuya.llega &&
    (tuya.antes === null || distintoAntes(j.cancion, final.desde - 1) === tuya.antes)
  );
}

/**
 * **Lo dudoso no sostiene la llegada**: si lo que lleva a la tónica final es un
 * compás tuyo que el micro oyó con duda y sigue ahí, la canción cierra solo si el
 * micro acertó (lo encontró el corpus final: «de tu VII a la i» sobre un VII
 * dudoso, como cierre seguro).
 */
function llegaPorLoDudoso(j: Juicio, final: Final): boolean {
  const antes = final.desde - 1;
  return (
    antes >= 0 &&
    antes < j.original.length &&
    j.contexto.dudosos?.[antes] === true &&
    j.cancion[antes]!.degree === j.original[antes]!.degree
  );
}

/** La cadencia de una salida que acaba en la tónica. */
function cadenciaQueCierra(j: Juicio, final: Final): Hecho {
  const propia = cadenciaPropia(
    j.mode,
    j.original.map((acorde) => acorde.degree),
  );
  const fuerza = fuerzaDelCierre(j, final, propia);
  // En un vamp sobre la tónica no hay dominante que esperar: su vuelta es la del
  // cuarto (`alCuartoYVuelta`), y cierra como cierra un modo sin sensible.
  const fuerzaAqui =
    alCuartoYVuelta(j) === null ? fuerza : Math.max(fuerza, FUERZA['sin-sensible']);
  const aTiempo = llegaATiempo(j, final);
  const de = final.antes === undefined ? j.tonica : `${final.antes.degree} ${j.tonica}`;
  const donde =
    j.modal !== null && final.cierre === 'perfecta'
      ? 'pero lo tuyo no tiene sensible'
      : propia !== null && final.cierre === 'perfecta'
        ? `pero lo tuyo llega por el ${propia}`
        : aTiempo >= 0.9
          ? 'y llega en el compás fuerte'
          : 'pero llega a destiempo de la frase';
  // Si cerrar sin sensible resta aquí, el motivo dice por qué: el nombre solo no.
  const nombre =
    final.cierre === 'sin-sensible' && j.modal === null && sinSensible(j) < 0
      ? 'cierra sin la sensible que aquí se espera'
      : nombreDelCierre(final.cierre, final.antes);
  const motivo = `${de} en el ${final.compas + 1}: ${nombre}, ${donde}.`;
  // Se dice, y no cuenta más que no decir nada.
  if (llegaPorLoDudoso(j, final)) {
    return {
      valor: Math.min(0, acotar(fuerzaAqui * aTiempo * 1.2 - 0.2)),
      motivo: `${de} en el ${final.compas + 1}: llega desde tu ${final.antes!.degree}, que se oyó con duda: si no era ese, no cierra.`,
    };
  }
  // **Una cadencia que pone la salida y llega a mitad de compás** deja la frase coja:
  // con acordes de dos pulsos, la tónica cae en el 3 del último compás y la frase se
  // queda con medio compás de más o de menos (el quinto examen). Si ya llegabas así,
  // no es culpa de la salida.
  const aMitad = !Number.isInteger(final.compas) && j.cambiados.has(final.desde);
  if (!esOtraVuelta(j, final, fuerza)) {
    return {
      valor: acotar(fuerzaAqui * aTiempo * 1.2 - 0.2),
      motivo,
      ...(aMitad ? { reparo: 'la cadencia llega a mitad de compás' } : {}),
    };
  }
  // Es tu vuelta tocada otra vez, y cierra a medias: vale la mitad. Si además es
  // floja —plagal o de rebote— no hay nada que la haga final, **pero eso es un
  // reparo y no un descarte**: que haya un final mejor es relativo. Lo modal no
  // entra: su cadencia fuerte es justo la que ya tenía.
  const floja = final.cierre === 'plagal' || final.cierre === 'rebote';
  return {
    valor: acotar(fuerza * 0.5 * aTiempo * 1.2 - 0.2),
    motivo: `${motivo} Es la misma llegada que la tuya: suena a otra vuelta más que a un final.`,
    ...(floja && j.modal === null
      ? { reparo: 'cierra con la misma llegada floja que tu vuelta' }
      : {}),
  };
}

/**
 * El V de un flamenco es su reposo (`reposoFrigio`): llega como llega una cadencia
 * sin sensible, por su color, y a tiempo o no según dónde caiga. Nulo si no reposa.
 */
function reposoDelFlamenco(j: Juicio): Hecho | null {
  const frigio = reposoFrigio(
    j.mode,
    j.estilo,
    j.original.map((acorde) => acorde.degree),
    j.cancion.map((acorde) => acorde.degree),
  );
  if (frigio === null) {
    return null;
  }
  const llegada = j.cancion[frigio]!;
  const compas = llegada.inicio / j.pc;
  const aTiempo = llegaATiempo(j, {
    cierre: 'sin-sensible',
    desde: frigio,
    compas,
    antes: j.cancion[frigio - 1],
  });
  return {
    valor: acotar(0.9 * aTiempo * 1.2 - 0.2),
    motivo: `${j.cancion[frigio - 1]!.degree} V en el ${compas + 1}: llega al V, el reposo frigio ${j.estilo === 'flamenco' ? 'del flamenco' : 'de la andaluza'}${aTiempo >= 0.9 ? '' : ', pero a destiempo de la frase'}.`,
  };
}

/** Acaba abierto. Lo que eso vale depende de para qué sea la parte. */
function cadenciaAbierta(j: Juicio, ultimo: Acorde): Hecho {
  const enGrupo = Number.isInteger(j.largo) && j.largo % j.frase === 0;
  let valor: number;
  let motivo: string;
  if (esTension(ultimo)) {
    valor = enGrupo ? 0.2 : -0.2;
    // La semicadencia es la que se para en el V; lo demás que tensa —un vii°, un
    // bVII, una secundaria— deja la frase en tensión, pero no tiene ese nombre.
    const como = ultimo.degree === 'V' ? 'semicadencia' : 'queda en tensión';
    motivo = enGrupo
      ? `Acaba en ${ultimo.degree} en el compás ${j.largo}: ${como}, pide seguir.`
      : `Acaba en ${ultimo.degree} a mitad de un grupo de ${j.frase === 4 ? 'cuatro' : j.frase}.`;
  } else {
    valor = ultimo.funcion === 'subdominante' ? -0.1 : -0.3;
    motivo = `Acaba en ${ultimo.degree}, ni en la tónica ni en la dominante.`;
  }
  const abierta = parteConPapel(j)?.papel;
  if (abierta !== undefined && QUEDAN_ABIERTAS.has(abierta)) {
    const [articulo, abierto] =
      abierta === 'pre' || abierta === 'puente' ? ['Un', 'abierto'] : ['Una', 'abierta'];
    return {
      valor: acotar(valor + 0.5),
      motivo: `${motivo} ${articulo} ${abierta} puede quedar ${abierto}.`,
    };
  }
  return { valor, motivo };
}

export function cadencia(j: Juicio, final: Final | null): Hecho {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  if (j.path === 'contraste') {
    // Lo único que no puede contrastar es un final: detrás no viene otra parte.
    const falta = faltaLaLlegada(j, final);
    return falta === null
      ? vueltaDelContraste(j, ultimo)
      : {
          valor: -1,
          motivo: `La parte nueva acaba en ${ultimo.degree}: ${falta}.`,
          descarte: falta,
        };
  }
  if (final !== null) {
    return cadenciaQueCierra(j, final);
  }
  const reposo = reposoDelFlamenco(j);
  if (reposo !== null) {
    return reposo;
  }
  const falta = faltaLaLlegada(j, final);
  if (falta !== null) {
    // También si tu final ya acababa abierto: retocarlo sin cerrarlo deja un
    // final que no es final, y eso no se ofrece aunque no lo haya traído la salida.
    return { valor: -1, motivo: `Acaba en ${ultimo.degree}: ${falta}.`, descarte: falta };
  }
  // Un bucle que retocas acaba donde acababa lo tuyo, fuera de casa, porque vuelve
  // a empezar: su final es esa vuelta, y se juzga como enlace. Pero solo es un
  // bucle si lo tuyo lo era (`Juicio.bucle`): un pre o un puente van hacia fuera,
  // y su último acorde no prepara su primero sino la parte que viene.
  return j.bucle ? vueltaDelBucle(j, ultimo) : cadenciaAbierta(j, ultimo);
}

/** Cómo vuelve a empezar un bucle retocado: del último compás al primero. */
function vueltaDelBucle(j: Juicio, ultimo: Acorde): Hecho {
  const primero = j.cancion[0]!;
  if (ultimo.degree === primero.degree) {
    return {
      valor: 0,
      motivo: `Tu bucle vuelve a empezar en el mismo ${ultimo.degree} en el que acaba.`,
    };
  }
  const vuelta = enlace({ ...j, cancion: [ultimo, primero] }, 1, true);
  return {
    valor: acotar(vuelta.valor * 0.8),
    motivo: `Tu bucle vuelve a empezar por ${vuelta.motivo}`,
  };
}

/**
 * Un contraste no cierra: lo que importa es **cómo vuelve** al principio.
 *
 * Su último acorde enlaza con tu primero, y ese enlace se juzga como cualquier
 * otro: acabar en V y volver a tu I es la vuelta que suena a vuelta.
 */
function vueltaDelContraste(j: Juicio, ultimo: Acorde): Hecho {
  const vuelta = comoVuelveElContraste(j, ultimo);
  // **Y un contraste que ya ha pasado por casa no tiene vuelta que hacer.** Cada
  // tónica en medio de la parte nueva es una llegada antes de tiempo: un puente
  // `IV V I vi IV I V/V V` resuelve dos veces y luego «vuelve» a donde ya estaba.
  // Solo lo pesaba la novedad, a 0,06, y esos puentes salían primeros; se cuenta
  // aquí, que es la cadencia de la parte, y pesa lo que pesa llegar.
  const tonicas = j.cancion
    .slice(j.original.length, -1)
    .filter((acorde) => acorde.funcion === 'tonica').length;
  if (tonicas === 0 || ultimo.funcion === 'tonica') {
    return vuelta;
  }
  // La vuelta, por buena que sea, ya no suena a vuelta: se queda en la mitad. Y
  // **dos veces es reposar**, no pasar: un contraste que vuelve a casa dos veces
  // por el camino no se ha ido, y solo entra si no hay tres que se vayan.
  return {
    valor: acotar(Math.min(vuelta.valor, 0.5) - 0.5 * tonicas),
    motivo: `La parte nueva ya llega a la ${j.tonica} ${veces(tonicas)} antes de volver: la vuelta se gasta antes de tiempo.`,
    ...(tonicas >= 2 ? { reparo: 'un contraste que reposa en la tónica' } : {}),
  };
}

/** Cómo enlaza el último acorde del contraste con tu primero. */
function comoVuelveElContraste(j: Juicio, ultimo: Acorde): Hecho {
  const primero = j.original[0]!;
  if (ultimo.funcion === 'tonica') {
    return {
      valor: -0.3,
      motivo: `La parte nueva acaba en ${ultimo.degree}: ya ha cerrado y la vuelta no se nota.`,
    };
  }
  if (ultimo.degree === primero.degree) {
    return {
      valor: -0.2,
      motivo: `La parte nueva acaba en ${ultimo.degree}, el acorde con el que empiezas: la vuelta no se oye.`,
    };
  }
  const vuelta = enlace({ ...j, cancion: [ultimo, primero] }, 1, true);
  return {
    valor: acotar(vuelta.valor * 0.8),
    motivo: `Vuelve a tu principio por ${vuelta.motivo}`,
  };
}
